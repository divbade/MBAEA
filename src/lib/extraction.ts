import OpenAI from "openai";
import { ExtractedCommitmentSchema, type ExtractedCommitmentInput } from "@/lib/schemas/extraction";

function getOpenAI() {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const SYSTEM_PROMPT = `You are a structured data extraction assistant for MBA students. Your job is to parse unstructured text (emails, messages, notes, etc.) and extract commitment/task information into precise JSON.

RULES:
- Extract exactly ONE commitment per input. If multiple are mentioned, pick the most actionable one.
- For dates/times, output ISO 8601 strings. Interpret relative dates based on the current date provided.
- goal_tags must be from: recruiting, academics, health, relationships, clubs, admin
- type must be one of: meeting, deadline, task, invite, fyi
- required_action must be one of: attend, reply, submit, prepare, follow_up, schedule
- commitment_strength: FYI (informational), soft (maybe), likely (probably will do), confirmed (definitely doing)
- confidence: 0-1 float representing how confident you are in the extraction accuracy
- rationale: brief explanation of why you classified it this way
- If you cannot determine a time, omit start_at/end_at/due_at
- Always estimate duration_mins even if not stated (use reasonable defaults: meeting=60, task=30, deadline prep=120)

OUTPUT: Return ONLY valid JSON matching the schema. No markdown, no explanation outside the JSON.`;

function buildUserPrompt(rawText: string, currentDate: string): string {
    return `Current date/time: ${currentDate}

Extract the commitment from this text:

"""
${rawText}
"""

Return JSON with these fields:
{
  "title": string (concise title),
  "type": "meeting"|"deadline"|"task"|"invite"|"fyi",
  "required_action": "attend"|"reply"|"submit"|"prepare"|"follow_up"|"schedule",
  "start_at": ISO string (optional),
  "end_at": ISO string (optional),
  "due_at": ISO string (optional),
  "duration_mins": number (optional, estimate if not stated),
  "prep_mins": number (optional),
  "goal_tags": ["recruiting"|"academics"|"health"|"relationships"|"clubs"|"admin"],
  "commitment_strength": "FYI"|"soft"|"likely"|"confirmed",
  "confidence": number 0-1,
  "rationale": string
}`;
}

const REPAIR_PROMPT = `The previous JSON output had validation errors. Please fix the JSON to match the schema exactly. Common issues:
- goal_tags must contain at least one tag from: recruiting, academics, health, relationships, clubs, admin
- type must be exactly one of: meeting, deadline, task, invite, fyi
- required_action must be exactly one of: attend, reply, submit, prepare, follow_up, schedule
- commitment_strength must be exactly one of: FYI, soft, likely, confirmed
- confidence must be a number between 0 and 1
- title and rationale must be non-empty strings

Return ONLY the corrected JSON.`;

/**
 * Fallback: regex-based extraction when LLM fails
 */
function fallbackExtraction(rawText: string, currentDate: string): ExtractedCommitmentInput {
    const text = rawText.toLowerCase();

    // Detect type from keywords
    let type: ExtractedCommitmentInput["type"] = "task";
    let requiredAction: ExtractedCommitmentInput["required_action"] = "prepare";

    if (text.match(/meet|coffee|chat|lunch|dinner|call|zoom/)) {
        type = "meeting";
        requiredAction = "attend";
    } else if (text.match(/due|submit|deadline|assignment|paper/)) {
        type = "deadline";
        requiredAction = "submit";
    } else if (text.match(/reply|respond|email|message/)) {
        type = "task";
        requiredAction = "reply";
    } else if (text.match(/invite|invitation|rsvp/)) {
        type = "invite";
        requiredAction = "attend";
    }

    // Detect goal tags
    const goalTags: ExtractedCommitmentInput["goal_tags"] = [];
    if (text.match(/recruit|interview|job|career|company|firm|consulting|mck|bcg|bain/)) goalTags.push("recruiting");
    if (text.match(/class|professor|study|exam|assignment|paper|course|grade|academic/)) goalTags.push("academics");
    if (text.match(/gym|workout|health|run|exercise|yoga|meditat/)) goalTags.push("health");
    if (text.match(/friend|family|partner|date|social|dinner|party/)) goalTags.push("relationships");
    if (text.match(/club|board|officer|leadership|organization|event/)) goalTags.push("clubs");
    if (goalTags.length === 0) goalTags.push("admin");

    // Try to extract date/time
    const dateMatch = text.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    const timeMatch = text.match(/(\d{1,2})\s*(am|pm)/);

    let startAt: string | undefined;
    if (dateMatch && timeMatch) {
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const targetDay = days.indexOf(dateMatch[1]);
        const now = new Date(currentDate);
        const currentDay = now.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + daysUntil);

        let hours = parseInt(timeMatch[1]);
        if (timeMatch[2] === "pm" && hours !== 12) hours += 12;
        if (timeMatch[2] === "am" && hours === 12) hours = 0;
        targetDate.setHours(hours, 0, 0, 0);
        startAt = targetDate.toISOString();
    }

    // Title: first 100 chars, capitalized
    const title = rawText.trim().slice(0, 100);

    return {
        title,
        type,
        required_action: requiredAction,
        start_at: startAt,
        end_at: startAt ? new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString() : undefined,
        duration_mins: type === "meeting" ? 60 : 30,
        goal_tags: goalTags,
        commitment_strength: "likely",
        confidence: 0.3,
        rationale: "Extracted using keyword-based fallback. Manual review recommended.",
    };
}

/**
 * Extract a commitment from raw text using OpenAI, with Zod validation,
 * retry on failure, and regex fallback.
 */
export async function extractCommitment(
    rawText: string,
    currentDate?: string
): Promise<{ data: ExtractedCommitmentInput; method: "llm" | "llm_repair" | "fallback" }> {
    const now = currentDate || new Date().toISOString();

    // Attempt 1: LLM extraction
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: buildUserPrompt(rawText, now) },
            ],
            temperature: 0.1,
            max_tokens: 500,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            const validated = ExtractedCommitmentSchema.parse(parsed);
            return { data: validated, method: "llm" };
        }
    } catch (firstError) {
        // Attempt 2: Repair prompt
        try {
            const errorMessage = firstError instanceof Error ? firstError.message : "Unknown validation error";
            const response = await getOpenAI().chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: buildUserPrompt(rawText, now) },
                    { role: "assistant", content: "I'll fix the JSON." },
                    {
                        role: "user",
                        content: `${REPAIR_PROMPT}\n\nError: ${errorMessage}`,
                    },
                ],
                temperature: 0,
                max_tokens: 500,
                response_format: { type: "json_object" },
            });

            const content = response.choices[0]?.message?.content;
            if (content) {
                const parsed = JSON.parse(content);
                const validated = ExtractedCommitmentSchema.parse(parsed);
                return { data: validated, method: "llm_repair" };
            }
        } catch {
            // Fall through to fallback
        }
    }

    // Attempt 3: Regex fallback
    const fallback = fallbackExtraction(rawText, now);
    return { data: fallback, method: "fallback" };
}

// ============================================
// SMART CAPTURE — Goal Decomposition
// ============================================

type InputClassification = "event" | "goal" | "intent";

const CLASSIFY_PROMPT = `You are classifying user input for an MBA executive assistant. Determine if the text is:

- "event": A specific, concrete commitment with a time/date or clear action (e.g., "Coffee chat with recruiter Friday 3pm", "Strategy case study due Wednesday", "Reply to professor by Thursday")
- "goal": A higher-level objective that needs to be broken into tasks (e.g., "Prepare for McKinsey interviews by end of March", "Improve my GPA this semester", "Get in shape for summer", "Network with 10 alumni this month")  
- "intent": Vague or unclear input that could mean multiple things (e.g., "recruiting stuff", "need to do something about finance class")

Return ONLY a JSON object: {"classification": "event"|"goal"|"intent", "reasoning": "brief explanation"}`;

const DECOMPOSE_PROMPT = `You are an expert executive assistant for MBA students. The user has described a HIGH-LEVEL GOAL. Your job is to break it down into 3-6 concrete, actionable sub-tasks that they can schedule and complete this week or next.

RULES:
- Each sub-task must be specific enough to schedule (e.g., "Block 2 hours to practice case interviews" not "do case prep")
- Estimate realistic duration_mins for each task
- Assign goal_tags from: recruiting, academics, health, relationships, clubs, admin
- Set appropriate commitment_strength: "soft" for flexible tasks, "likely" for important ones, "confirmed" for must-do
- Set due_at if there's a natural deadline, otherwise omit
- Set confidence to reflect how certain you are this sub-task is needed (0.7-0.95 range)
- Include a brief rationale for each explaining WHY this task helps achieve the goal
- Order tasks by suggested priority/sequence
- Tasks should be completable within 30-180 minutes each

OUTPUT: Return ONLY valid JSON: {"tasks": [...array of task objects...]}

Each task object must have:
{
  "title": string,
  "type": "meeting"|"deadline"|"task"|"invite"|"fyi",
  "required_action": "attend"|"reply"|"submit"|"prepare"|"follow_up"|"schedule",
  "start_at": ISO string (optional),
  "end_at": ISO string (optional),
  "due_at": ISO string (optional),
  "duration_mins": number,
  "prep_mins": number (optional),
  "goal_tags": ["recruiting"|"academics"|"health"|"relationships"|"clubs"|"admin"],
  "commitment_strength": "FYI"|"soft"|"likely"|"confirmed",
  "confidence": number 0-1,
  "rationale": string
}`;

/**
 * Classify user input as event, goal, or intent.
 */
async function classifyInput(
    rawText: string
): Promise<{ classification: InputClassification; reasoning: string }> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: CLASSIFY_PROMPT },
                { role: "user", content: rawText },
            ],
            temperature: 0,
            max_tokens: 100,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            if (["event", "goal", "intent"].includes(parsed.classification)) {
                return {
                    classification: parsed.classification,
                    reasoning: parsed.reasoning || "",
                };
            }
        }
    } catch {
        // Fall through to default
    }

    // Default: treat as event (backward compatible)
    return { classification: "event", reasoning: "Classification failed, defaulting to event." };
}

/**
 * Decompose a high-level goal into concrete sub-tasks.
 */
async function decomposeGoal(
    rawText: string,
    currentDate: string
): Promise<ExtractedCommitmentInput[]> {
    try {
        const response = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: DECOMPOSE_PROMPT },
                {
                    role: "user",
                    content: `Current date/time: ${currentDate}\n\nGoal: "${rawText}"\n\nBreak this into 3-6 concrete, schedulable sub-tasks for this week.`,
                },
            ],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
            const parsed = JSON.parse(content);
            const tasks: ExtractedCommitmentInput[] = [];

            for (const task of parsed.tasks || []) {
                try {
                    const validated = ExtractedCommitmentSchema.parse(task);
                    tasks.push(validated);
                } catch {
                    // Skip invalid tasks but continue
                }
            }

            if (tasks.length > 0) return tasks;
        }
    } catch (err) {
        console.error("Goal decomposition error:", err);
    }

    // Fallback: create a single generic task
    return [fallbackExtraction(rawText, currentDate)];
}

export type SmartCaptureResult = {
    input_type: InputClassification;
    items: { data: ExtractedCommitmentInput; method: "llm" | "llm_repair" | "fallback" | "decomposed" }[];
    classification_reasoning: string;
};

/**
 * Smart capture: classify input, then extract or decompose accordingly.
 */
export async function classifyAndExtract(
    rawText: string,
    currentDate?: string
): Promise<SmartCaptureResult> {
    const now = currentDate || new Date().toISOString();

    // Step 1: Classify
    const { classification, reasoning } = await classifyInput(rawText);

    // Step 2: Route based on classification
    switch (classification) {
        case "goal": {
            const tasks = await decomposeGoal(rawText, now);
            return {
                input_type: "goal",
                items: tasks.map((t) => ({ data: t, method: "decomposed" as const })),
                classification_reasoning: reasoning,
            };
        }

        case "intent": {
            // For vague intent, still try to decompose but with fewer tasks
            const tasks = await decomposeGoal(rawText, now);
            return {
                input_type: "intent",
                items: tasks.map((t) => ({ data: t, method: "decomposed" as const })),
                classification_reasoning: reasoning,
            };
        }

        case "event":
        default: {
            const result = await extractCommitment(rawText, now);
            const items: SmartCaptureResult["items"] = [result];

            // If it's a deadline, auto-generate a work/prep block
            if (result.data.type === "deadline" || result.data.required_action === "submit") {
                const workDuration = Math.max(result.data.duration_mins || 120, 60);

                // Calculate a work deadline: 1 day before the due date, or today if no due date
                let workDueAt: string | undefined;
                if (result.data.due_at) {
                    const dueDate = new Date(result.data.due_at);
                    dueDate.setDate(dueDate.getDate() - 1);
                    workDueAt = dueDate.toISOString();
                }

                const workBlock: ExtractedCommitmentInput = {
                    title: `Work on: ${result.data.title}`,
                    type: "task",
                    required_action: "prepare",
                    due_at: workDueAt,
                    duration_mins: workDuration,
                    goal_tags: result.data.goal_tags,
                    commitment_strength: result.data.commitment_strength,
                    confidence: Math.min(result.data.confidence, 0.85),
                    rationale: `Auto-generated work block for "${result.data.title}". You'll need time to actually complete this before the deadline.`,
                };

                items.push({ data: workBlock, method: "llm" });
            }

            return {
                input_type: "event",
                items,
                classification_reasoning: reasoning,
            };
        }
    }
}
