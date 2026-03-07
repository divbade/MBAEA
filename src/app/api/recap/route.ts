import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek, format, parseISO, isToday, isBefore, addDays } from "date-fns";
import OpenAI from "openai";
import type { PlanBlock, GoalWeights } from "@/lib/types";

function getOpenAI() {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get latest plan
        const { data: plan } = await supabase
            .from("plans")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!plan?.plan_json) {
            return NextResponse.json({
                has_plan: false,
                message: "No plan found. Generate a plan first.",
            });
        }

        // Get preferences
        const { data: prefs } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        const goalWeights: GoalWeights = prefs?.goal_weights || {
            recruiting: 3, academics: 3, health: 2, relationships: 2, clubs: 1, admin: 1,
        };

        const blocks = plan.plan_json as PlanBlock[];
        const today = new Date();

        // Get today's blocks
        const todayBlocks = blocks.filter((b) => {
            try {
                return isToday(parseISO(b.start));
            } catch {
                return false;
            }
        });

        // Calculate time spent per goal tag today
        const goalMinutes: Record<string, number> = {};
        let totalMinutesToday = 0;

        for (const block of todayBlocks) {
            const start = parseISO(block.start);
            const end = parseISO(block.end);
            const mins = (end.getTime() - start.getTime()) / (1000 * 60);
            totalMinutesToday += mins;

            const tags = block.goal_tags || [];
            if (tags.length === 0) {
                goalMinutes["untagged"] = (goalMinutes["untagged"] || 0) + mins;
            } else {
                const perTag = mins / tags.length;
                for (const tag of tags) {
                    goalMinutes[tag] = (goalMinutes[tag] || 0) + perTag;
                }
            }
        }

        // Calculate alignment score
        const totalWeight = Object.values(goalWeights).reduce((a, b) => a + b, 0);
        const desiredAllocation: Record<string, number> = {};
        for (const [tag, weight] of Object.entries(goalWeights)) {
            desiredAllocation[tag] = totalWeight > 0 ? weight / totalWeight : 0;
        }

        const actualAllocation: Record<string, number> = {};
        for (const [tag, mins] of Object.entries(goalMinutes)) {
            actualAllocation[tag] = totalMinutesToday > 0 ? mins / totalMinutesToday : 0;
        }

        // Alignment = 1 - average absolute deviation
        let totalDeviation = 0;
        let tagCount = 0;
        for (const tag of Object.keys(goalWeights)) {
            const desired = desiredAllocation[tag] || 0;
            const actual = actualAllocation[tag] || 0;
            totalDeviation += Math.abs(desired - actual);
            tagCount++;
        }
        const alignmentScore = Math.max(0, Math.min(100,
            Math.round((1 - (tagCount > 0 ? totalDeviation / tagCount : 0)) * 100)
        ));

        // Get recent feedback count
        const { count: feedbackCount } = await supabase
            .from("feedback")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

        // Generate recommendations with LLM
        let recommendations: string[] = [];
        try {
            const recapContext = `
Today is ${format(today, "EEEE, MMMM d, yyyy")}.

User's goal priorities (weight 0-5):
${Object.entries(goalWeights).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Today's scheduled blocks:
${todayBlocks.length === 0 ? "No blocks scheduled today." :
                    todayBlocks.map((b) =>
                        `- ${format(parseISO(b.start), "h:mm a")}-${format(parseISO(b.end), "h:mm a")}: ${b.title} [${b.goal_tags?.join(", ") || "no tags"}]`
                    ).join("\n")}

Time spent per goal:
${Object.entries(goalMinutes).map(([k, v]) => `- ${k}: ${Math.round(v)} min`).join("\n") || "No time tracked yet."}

Total scheduled time today: ${Math.round(totalMinutesToday)} min
Alignment score: ${alignmentScore}%
Total feedback given: ${feedbackCount || 0}
`;

            const response = await getOpenAI().chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an MBA executive assistant providing a brief daily recap. Give exactly 3 short, specific, actionable recommendations based on the user's day and goal priorities. Each should be 1 sentence. Focus on what they should do TOMORROW.

Format: Return ONLY a JSON object: {"recommendations": ["rec1", "rec2", "rec3"]}`,
                    },
                    { role: "user", content: recapContext },
                ],
                temperature: 0.4,
                max_tokens: 300,
                response_format: { type: "json_object" },
            });

            const content = response.choices[0]?.message?.content;
            if (content) {
                const parsed = JSON.parse(content);
                recommendations = parsed.recommendations || [];
            }
        } catch (err) {
            console.error("Recap recommendation error:", err);
            recommendations = [
                "Review your goal weights to ensure they match your current priorities.",
                "Consider adding more blocks aligned with your top goals.",
                "Give feedback on plan blocks to help the system learn your preferences.",
            ];
        }

        // Week summary
        const weekBlocks = blocks.filter((b) => {
            try {
                const d = parseISO(b.start);
                return isBefore(d, addDays(today, 1));
            } catch {
                return false;
            }
        });

        const weekGoalMinutes: Record<string, number> = {};
        for (const block of weekBlocks) {
            const start = parseISO(block.start);
            const end = parseISO(block.end);
            const mins = (end.getTime() - start.getTime()) / (1000 * 60);
            const tags = block.goal_tags || [];
            if (tags.length === 0) {
                weekGoalMinutes["untagged"] = (weekGoalMinutes["untagged"] || 0) + mins;
            } else {
                const perTag = mins / tags.length;
                for (const tag of tags) {
                    weekGoalMinutes[tag] = (weekGoalMinutes[tag] || 0) + perTag;
                }
            }
        }

        return NextResponse.json({
            has_plan: true,
            today: {
                date: format(today, "EEEE, MMMM d"),
                blocks: todayBlocks,
                goal_minutes: goalMinutes,
                total_minutes: Math.round(totalMinutesToday),
                alignment_score: alignmentScore,
            },
            week: {
                goal_minutes: weekGoalMinutes,
            },
            goal_weights: goalWeights,
            recommendations,
            feedback_count: feedbackCount || 0,
        });
    } catch (err) {
        console.error("Recap error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
