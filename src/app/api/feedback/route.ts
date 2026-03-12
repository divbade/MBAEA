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

        const body = await request.json();
        const { item_type, ref_id, thumbs, goal_tags, winner_tags, loser_tags } = body;

        // Get current preferences
        const { data: prefs, error: prefsError } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (prefsError || !prefs) {
            return NextResponse.json({ error: "Preferences not found" }, { status: 404 });
        }

        const weights = { ...(prefs.goal_weights || {}) };

        if (item_type === "PLAN_COMPARISON") {
            // Adjust weights based on winner vs loser tags
            (winner_tags as string[]).forEach(tag => {
                weights[tag] = Math.min(2.0, (weights[tag] || 1.0) + 0.1);
            });
            (loser_tags as string[]).forEach(tag => {
                if (!winner_tags.includes(tag)) {
                    weights[tag] = Math.max(0.1, (weights[tag] || 1.0) - 0.05);
                }
            });

            await supabase
                .from("preferences")
                .update({ goal_weights: weights })
                .eq("user_id", user.id);

            return NextResponse.json({
                message: `✨ Learning! Adjusted priority for ${winner_tags.join(", ")} categories.`,
            });
        }

        // Store individual feedback
        await supabase.from("feedback").insert({
            user_id: user.id,
            item_type,
            ref_id: ref_id || "00000000-0000-0000-0000-000000000000",
            thumbs,
        });

        if (goal_tags && goal_tags.length > 0) {
            const adjustment = thumbs === 1 ? 0.02 : -0.02;
            goal_tags.forEach((tag: string) => {
                weights[tag] = Math.max(0.1, Math.min(2.0, (weights[tag] || 1.0) + adjustment));
            });

            await supabase
                .from("preferences")
                .update({ goal_weights: weights })
                .eq("user_id", user.id);
        }

        return NextResponse.json({ message: "Feedback recorded. The model is learning!" });
    } catch (err) {
        console.error("Feedback error:", err);
        return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
    }
}
