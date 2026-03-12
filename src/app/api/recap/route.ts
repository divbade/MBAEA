import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startOfWeek, format, parseISO, isSameDay, isBefore, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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

        // 1. Get latest plan from weekly_plans (matching Planner API)
        const { data: plan } = await supabase
            .from("weekly_plans")
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

        // 2. Get preferences for timezone and goal weights
        const { data: prefs } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        const userTimezone = prefs?.timezone || "UTC";
        const goalWeights: GoalWeights = prefs?.goal_weights || {
            recruiting: 3, academics: 3, health: 2, relationships: 2, clubs: 1, admin: 1,
        };

        const blocks = plan.plan_json as PlanBlock[];
        const now = new Date();
        const zonedNow = toZonedTime(now, userTimezone);

        // 3. Filter blocks for "today" in user's timezone
        const todayBlocks = blocks.filter((b) => {
            try {
                const blockStartUTC = parseISO(b.start);
                const blockStartLocal = toZonedTime(blockStartUTC, userTimezone);
                return isSameDay(blockStartLocal, zonedNow);
            } catch {
                return false;
            }
        });

        // 4. Calculate alignment and time metrics
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

        // Calculate alignment score based on deviation from desired allocation
        const totalWeight = Object.values(goalWeights).reduce((a, b) => a + b, 0);
        const alignmentScore = (() => {
            if (totalMinutesToday === 0) return 0;
            
            let deviation = 0;
            const tags = Object.keys(goalWeights);
            
            for (const tag of tags) {
                const desired = (goalWeights[tag as keyof GoalWeights] || 0) / totalWeight;
                const actual = (goalMinutes[tag] || 0) / totalMinutesToday;
                deviation += Math.abs(desired - actual);
            }
            
            // Score from 0 to 100
            return Math.round(Math.max(0, (1 - (deviation / 2)) * 100));
        })();

        // 5. Get feedback count
        const { count: feedbackCount } = await supabase
            .from("feedback")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

        // 6. Generate AI recommendations
        let recommendations: string[] = [];
        try {
            const recapContext = `
Today is ${format(zonedNow, "EEEE, MMMM d")}.
Zone: ${userTimezone}

Priorities: ${Object.entries(goalWeights).map(([k, v]) => `${k}: ${v}`).join(", ")}
Today's blocks: ${todayBlocks.map(b => `${b.title} (${Math.round((parseISO(b.end).getTime() - parseISO(b.start).getTime())/(1000*60))}m)`).join(", ")}
Time per goal: ${Object.entries(goalMinutes).map(([k, v]) => `${k}: ${Math.round(v)}m`).join(", ")}
Alignment: ${alignmentScore}%
`;

            const response = await getOpenAI().chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an MBA assistant. Provide 3 brief, actionable recs for tomorrow based on today's alignment. JSON format: {"recommendations": ["...", "...", "..."]}`,
                    },
                    { role: "user", content: recapContext },
                ],
                response_format: { type: "json_object" },
            });

            const content = response.choices[0]?.message?.content;
            if (content) {
                recommendations = JSON.parse(content).recommendations || [];
            }
        } catch (err) {
            console.error("AI Recommendation error:", err);
            recommendations = [
                "Great work today! Try to block more time for recruiting tomorrow.",
                "Give feedback on your schedule to improve future recommendations.",
                "Review your goal weights if your focus areas have shifted."
            ];
        }

        // 7. Calculate week-to-date stats
        const weekGoalMinutes: Record<string, number> = {};
        const startOfThisWeekUTC = startOfWeek(zonedNow, { weekStartsOn: 1 }); // Actually need to calculate based on zoned time
        
        blocks.forEach(block => {
            const bStart = parseISO(block.start);
            const bStartLocal = toZonedTime(bStart, userTimezone);
            
            // If block is in the past week up to end of today
            if (isBefore(bStartLocal, addDays(zonedNow, 1))) {
                const mins = (parseISO(block.end).getTime() - bStart.getTime()) / (1000 * 60);
                (block.goal_tags || ["untagged"]).forEach(tag => {
                    weekGoalMinutes[tag] = (weekGoalMinutes[tag] || 0) + (mins / (block.goal_tags?.length || 1));
                });
            }
        });

        return NextResponse.json({
            has_plan: true,
            today: {
                date: format(zonedNow, "EEEE, MMMM d"),
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
