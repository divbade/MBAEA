import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePlan, generateDemoCalendarEvents } from "@/lib/planner";
import { startOfWeek } from "date-fns";
import type { Commitment, Preferences, CalendarEvent } from "@/lib/types";

const DEFAULT_PREFERENCES: Preferences = {
    work_start: "08:00",
    work_end: "18:00",
    max_commitments_per_day: 5,
    focus_block_mins: 90,
    timezone: "UTC",
    goal_weights: {},
};

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
        const useDemoEvents = body.demo_mode !== false; // Default to demo mode

        // Get preferences
        const { data: preferences } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!preferences) {
            return NextResponse.json(
                { error: "Complete onboarding first" },
                { status: 400 }
            );
        }

        // Get commitments
        const { data: commitments } = await supabase
            .from("commitments")
            .select("*")
            .eq("user_id", user.id);

        // Get calendar events
        let calendarEvents: CalendarEvent[] = [];
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

        if (useDemoEvents) {
            calendarEvents = generateDemoCalendarEvents(weekStart);
        } else {
            // TODO: Fetch from Google Calendar when connected
            calendarEvents = [];
        }

        // 4. Generate the plan twice (Variation A and B)
        const planA = generatePlan({
            fixedEvents: calendarEvents,
            commitments: (commitments || []) as Commitment[],
            preferences: preferences as Preferences || DEFAULT_PREFERENCES,
            weekStart,
            variation: "A"
        });

        const planB = generatePlan({
            fixedEvents: calendarEvents,
            commitments: (commitments || []) as Commitment[],
            preferences: preferences as Preferences || DEFAULT_PREFERENCES,
            weekStart,
            variation: "B"
        });

        // 5. Save default plan (A) to DB
        const { error: saveError } = await supabase
            .from("weekly_plans")
            .insert({
                user_id: user.id,
                week_start: weekStart.toISOString().split("T")[0],
                plan_json: planA.blocks,
                status: "draft",
            });

        if (saveError) {
            console.error("Save plan error:", saveError);
        }

        return NextResponse.json({
            plan: { plan_json: planA.blocks },
            options: {
                A: planA.blocks,
                B: planB.blocks
            },
            warnings: Array.from(new Set([...planA.warnings, ...planB.warnings])),
        });
    } catch (err) {
        console.error("Planner API error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
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

        const { data: plan } = await supabase
            .from("weekly_plans")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        return NextResponse.json({ plan });
    } catch {
        return NextResponse.json({ plan: null });
    }
}
