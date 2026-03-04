import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, edited_fields } = body;

        if (!["accept", "dismiss", "edit"].includes(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Get the candidate item
        const { data: candidate, error: fetchError } = await supabase
            .from("candidate_items")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (fetchError || !candidate) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (action === "dismiss") {
            await supabase
                .from("candidate_items")
                .update({ status: "DISMISSED" })
                .eq("id", id);

            return NextResponse.json({ success: true, action: "dismissed" });
        }

        // For accept or edit, merge fields and create commitment
        const extracted = candidate.extracted_json;
        const merged = { ...extracted, ...(edited_fields || {}) };

        // Update candidate status
        await supabase
            .from("candidate_items")
            .update({
                status: "ACCEPTED",
                extracted_json: merged,
            })
            .eq("id", id);

        // Create commitment
        const { data: commitment, error: commitError } = await supabase
            .from("commitments")
            .insert({
                user_id: user.id,
                candidate_item_id: id,
                title: merged.title,
                type: merged.type,
                required_action: merged.required_action,
                start_at: merged.start_at || null,
                end_at: merged.end_at || null,
                due_at: merged.due_at || null,
                duration_mins: merged.duration_mins || null,
                prep_mins: merged.prep_mins || null,
                goal_tags: merged.goal_tags || [],
                commitment_strength: merged.commitment_strength || "likely",
                confidence: merged.confidence || 0.5,
                rationale: merged.rationale || "",
            })
            .select()
            .single();

        if (commitError) {
            console.error("Commitment insert error:", commitError);
            return NextResponse.json({ error: "Failed to create commitment" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            action: action === "edit" ? "edited_and_accepted" : "accepted",
            commitment,
        });
    } catch (err) {
        console.error("Inbox action error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
