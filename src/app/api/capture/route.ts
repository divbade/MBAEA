import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractCommitment } from "@/lib/extraction";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { raw_text } = await request.json();

        if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length === 0) {
            return NextResponse.json(
                { error: "raw_text is required" },
                { status: 400 }
            );
        }

        // Extract commitment using LLM
        const { data: extracted, method } = await extractCommitment(
            raw_text.trim(),
            new Date().toISOString()
        );

        // Store candidate item
        const { data: candidate, error } = await supabase
            .from("candidate_items")
            .insert({
                user_id: user.id,
                source: "MANUAL",
                raw_text: raw_text.trim(),
                extracted_json: extracted,
                status: "NEW",
            })
            .select()
            .single();

        if (error) {
            console.error("DB insert error:", error);
            return NextResponse.json({ error: "Failed to save" }, { status: 500 });
        }

        return NextResponse.json({
            candidate,
            extraction_method: method,
        });
    } catch (err) {
        console.error("Capture error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
