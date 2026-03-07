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

        const { item_type, ref_id, thumbs, goal_tags } = await request.json();

        if (!["CANDIDATE", "PLAN_BLOCK"].includes(item_type)) {
            return NextResponse.json({ error: "Invalid item_type" }, { status: 400 });
        }

        if (![1, -1].includes(thumbs)) {
            return NextResponse.json({ error: "thumbs must be 1 or -1" }, { status: 400 });
        }

        // Store feedback
        await supabase.from("feedback").insert({
            user_id: user.id,
            item_type,
            ref_id: ref_id || "00000000-0000-0000-0000-000000000000",
            thumbs,
        });

        // Update goal weights based on feedback
        let message = thumbs === 1 ? "Noted — glad that worked!" : "Got it — will adjust.";
        let updatedWeights = null;

        if (goal_tags && goal_tags.length > 0) {
            const { data: prefs } = await supabase
                .from("preferences")
                .select("goal_weights")
                .eq("user_id", user.id)
                .single();

            if (prefs) {
                const weights = { ...prefs.goal_weights };
                const delta = thumbs === 1 ? 0.1 : -0.1;
                const changedTags: string[] = [];

                for (const tag of goal_tags) {
                    if (tag in weights) {
                        weights[tag] = Math.max(0, Math.min(5, weights[tag] + delta));
                        weights[tag] = Math.round(weights[tag] * 10) / 10;
                        changedTags.push(tag);
                    }
                }

                await supabase
                    .from("preferences")
                    .update({ goal_weights: weights })
                    .eq("user_id", user.id);

                updatedWeights = weights;
                const action = thumbs === 1 ? "Boosting" : "Reducing";
                message = `${action} ${changedTags.join(", ")} priority`;
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
