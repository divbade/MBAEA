import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { item_type, ref_id, thumbs, goal_tags, winner_tags, loser_tags } = await request.json();

        if (!["CANDIDATE", "PLAN_BLOCK", "PLAN_COMPARISON"].includes(item_type)) {
            return NextResponse.json({ error: "Invalid item_type" }, { status: 400 });
        }

        // Store feedback
        await supabase.from("feedback").insert({
            user_id: user.id,
            item_type,
            ref_id: ref_id || "00000000-0000-0000-0000-000000000000",
            thumbs: thumbs || 1,
        });

        // Update goal weights based on feedback
        let message = "Feedback saved!";
        let updatedWeights = null;

        const { data: prefs } = await supabase
            .from("preferences")
            .select("goal_weights")
            .eq("user_id", user.id)
            .single();

        if (prefs) {
            const weights = { ...prefs.goal_weights };
            const changedTags: string[] = [];

            if (item_type === "PLAN_COMPARISON" && winner_tags && loser_tags) {
                // Boost everything in winner, reduce everything in loser
                for (const tag of winner_tags) {
                    if (tag in weights) {
                        weights[tag] = Math.max(0, Math.min(5, weights[tag] + 0.05));
                        weights[tag] = Math.round(weights[tag] * 100) / 100;
                        if (!changedTags.includes(tag)) changedTags.push(tag);
                    }
                }
                for (const tag of loser_tags) {
                    if (tag in weights && !winner_tags.includes(tag)) {
                        weights[tag] = Math.max(0.1, Math.min(5, weights[tag] - 0.05));
                        weights[tag] = Math.round(weights[tag] * 100) / 100;
                        if (!changedTags.includes(tag)) changedTags.push(tag);
                    }
                }
                message = `Learning! Adjusted priority for ${changedTags.length} categories.`;
            } else if (goal_tags && goal_tags.length > 0) {
                const delta = thumbs === 1 ? 0.1 : -0.1;
                for (const tag of goal_tags) {
                    if (tag in weights) {
                        weights[tag] = Math.max(0, Math.min(5, weights[tag] + delta));
                        weights[tag] = Math.round(weights[tag] * 10) / 10;
                        changedTags.push(tag);
                    }
                }
                const action = thumbs === 1 ? "Boosting" : "Reducing";
                message = `${action} ${changedTags.join(", ")} priority`;
            }

            if (changedTags.length > 0) {
                await supabase
                    .from("preferences")
                    .update({ goal_weights: weights })
                    .eq("user_id", user.id);
                updatedWeights = weights;
            }
        }

        return NextResponse.json({
            success: true,
            message,
            updated_weights: updatedWeights,
        });
    } catch (err) {
        console.error("Feedback error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
