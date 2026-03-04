import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCalendarClient } from "@/lib/google";
import { generateDemoCalendarEvents } from "@/lib/planner";
import { startOfWeek, addDays } from "date-fns";
import type { CalendarEvent } from "@/lib/types";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const demo = searchParams.get("demo") !== "false";

        if (demo) {
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const events = generateDemoCalendarEvents(weekStart);
            return NextResponse.json({ events, demo: true });
        }

        // Get tokens from server-side storage
        const serviceClient = await createServiceClient();
        const { data: tokenData } = await serviceClient
            .from("google_tokens")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!tokenData) {
            return NextResponse.json(
                { error: "Google Calendar not connected", events: [] },
                { status: 400 }
            );
        }

        const calendar = await getCalendarClient(tokenData.access_token);
        const now = new Date();
        const twoWeeksFromNow = addDays(now, 14);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: twoWeeksFromNow.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        });

        const events: CalendarEvent[] = (response.data.items || []).map((e) => ({
            id: e.id || "",
            title: e.summary || "Untitled",
            start: e.start?.dateTime || e.start?.date || "",
            end: e.end?.dateTime || e.end?.date || "",
            description: e.description || undefined,
            location: e.location || undefined,
            is_mbaea: e.description?.includes("MBAEA") || false,
        }));

        return NextResponse.json({ events, demo: false });
    } catch (err) {
        console.error("Calendar events error:", err);
        return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }
}
