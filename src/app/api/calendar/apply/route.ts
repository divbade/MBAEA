import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCalendarClient } from "@/lib/google";
import type { PlanBlock } from "@/lib/types";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plan_id } = await request.json();

        // Get the plan
        const { data: plan } = await supabase
            .from("plans")
            .select("*")
            .eq("id", plan_id)
            .eq("user_id", user.id)
            .single();

        if (!plan) {
            return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }

        // Get Google tokens
        const serviceClient = await createServiceClient();
        const { data: tokenData } = await serviceClient
            .from("google_tokens")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!tokenData) {
            return NextResponse.json(
                { error: "Google Calendar not connected" },
                { status: 400 }
            );
        }

        const calendar = await getCalendarClient(tokenData.access_token);
        const blocks = plan.plan_json as PlanBlock[];
        const createdEvents: string[] = [];

        // Only write non-fixed blocks (tasks, focus blocks, prep)
        const writableBlocks = blocks.filter(
            (b) => b.block_type !== "fixed_event"
        );

        for (const block of writableBlocks) {
            try {
                const event = await calendar.events.insert({
                    calendarId: "primary",
                    requestBody: {
                        summary: block.title,
                        description: `[MBAEA] ${block.reasoning}\n\nBlock type: ${block.block_type}${block.goal_tags?.length ? `\nGoals: ${block.goal_tags.join(", ")}` : ""
                            }`,
                        start: {
                            dateTime: block.start,
                        },
                        end: {
                            dateTime: block.end,
                        },
                        colorId: block.block_type === "focus_block" ? "2" : block.block_type === "prep" ? "5" : "9",
                    },
                });

                if (event.data.id) {
                    createdEvents.push(event.data.id);
                }
            } catch (err) {
                console.error(`Failed to create event "${block.title}":`, err);
            }
        }

        // Mark plan as applied
        await supabase
            .from("plans")
            .update({ status: "APPLIED" })
            .eq("id", plan_id);

        return NextResponse.json({
            success: true,
            created_count: createdEvents.length,
            total_blocks: writableBlocks.length,
        });
    } catch (err) {
        console.error("Apply plan error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
