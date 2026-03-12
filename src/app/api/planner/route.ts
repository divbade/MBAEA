import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePlan, generateDemoCalendarEvents } from "@/lib/planner";
import { startOfWeek } from "date-fns";
import type { Commitment, Preferences, CalendarEvent } from "@/lib/types";

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

        // Generate two plan options
        const planA = generatePlan({
            fixedEvents: calendarEvents,
            commitments: (commitments || []) as Commitment[],
            preferences: preferences as Preferences,
            weekStart,
            variation: "A",
        });

        const planB = generatePlan({
            fixedEvents: calendarEvents,
            commitments: (commitments || []) as Commitment[],
            preferences: preferences as Preferences,
            weekStart,
            variation: "B",
        });

        // Save plan A as the default draft for now (to maintain compatibility if needed)
        const { data: plan, error: saveError } = await supabase
            .from("plans")
            .insert({
                user_id: user.id,
                week_start: weekStart.toISOString().split("T")[0],
                plan_json: planA.blocks,
                status: "DRAFT",
            })
            .select()
            .single();

        if (saveError) {
            console.error("Plan save error:", saveError);
            return NextResponse.json(
                { error: "Failed to save plan" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            plan,
            options: {
                A: planA.blocks,
                B: planB.blocks,
            },
            warnings: planA.warnings, // Using A's warnings for simplicity
            demo_mode: useDemoEvents,
        });
    } catch (err) {
        console.error("Planner error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
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
            .from("plans")
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
