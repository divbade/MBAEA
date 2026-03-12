import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyAndExtract } from "@/lib/extraction";

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

        // Smart capture: classify + extract/decompose
        const result = await classifyAndExtract(
            raw_text.trim(),
            new Date().toISOString()
        );

        // Store all candidate items
        const candidates = [];
        for (const item of result.items) {
            const { data: candidate, error } = await supabase
                .from("candidate_items")
                .insert({
                    user_id: user.id,
                    source: "MANUAL",
                    raw_text: raw_text.trim(),
                    extracted_json: item.data,
                    status: "NEW",
                })
                .select()
                .single();

            if (error) {
                console.error("DB insert error:", error);
                continue;
            }

            candidates.push({
                ...candidate,
                extraction_method: item.method,
            });
        }

        if (candidates.length === 0) {
            return NextResponse.json({ error: "Failed to save" }, { status: 500 });
        }

        return NextResponse.json({
            candidates,
            input_type: result.input_type,
            classification_reasoning: result.classification_reasoning,
            count: candidates.length,
        });
    } catch (err) {
        console.error("Capture error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
