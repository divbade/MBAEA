import { addDays, addMinutes, format, isAfter, isBefore, parseISO, startOfWeek, setHours, setMinutes } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { Commitment, PlanBlock, Preferences, CalendarEvent } from "@/lib/types";

interface PlannerInput {
    fixedEvents: CalendarEvent[];
    commitments: Commitment[];
    preferences: Preferences;
    weekStart: Date;
    variation?: "A" | "B";
}

interface TimeSlot {
    start: Date;
    end: Date;
}

/**
 * Parse a work time string (HH:MM) into hours and minutes.
 */
function parseWorkTime(time: string): { hours: number; minutes: number } {
    const [h, m] = time.split(":").map(Number);
    return { hours: h, minutes: m };
}

/**
 * Get available slots for a given day, excluding occupied blocks.
 * Timezone aware.
 */
function getAvailableSlots(
    day: Date,
    workStart: string,
    workEnd: string,
    occupied: TimeSlot[],
    timezone: string = "UTC"
): TimeSlot[] {
    const start = parseWorkTime(workStart);
    const end = parseWorkTime(workEnd);

    // Convert day to the user's timezone to calculate work boundaries
    const zonedDay = toZonedTime(day, timezone);
    
    const dayStartLocal = setMinutes(setHours(zonedDay, start.hours), start.minutes);
    const dayEndLocal = setMinutes(setHours(zonedDay, end.hours), end.minutes);

    // Convert back to UTC dates for internal calculation
    const dayStart = fromZonedTime(dayStartLocal, timezone);
    const dayEnd = fromZonedTime(dayEndLocal, timezone);

    // Sort occupied by start time
    const sortedOccupied = [...occupied]
        .filter(
            (o) =>
                isBefore(o.start, dayEnd) && isAfter(o.end, dayStart)
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const slots: TimeSlot[] = [];
    let cursor = dayStart;

    for (const block of sortedOccupied) {
        const blockStart = isBefore(block.start, dayStart) ? dayStart : block.start;
        if (isAfter(blockStart, cursor)) {
            slots.push({ start: new Date(cursor), end: new Date(blockStart) });
        }
        cursor = isAfter(block.end, cursor) ? block.end : cursor;
    }

    if (isBefore(cursor, dayEnd)) {
        slots.push({ start: new Date(cursor), end: new Date(dayEnd) });
    }

    return slots;
}

/**
 * Find the earliest slot that fits a given duration.
 */
function findSlot(
    slots: TimeSlot[],
    durationMins: number
): TimeSlot | null {
    for (const slot of slots) {
        const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
        if (slotDuration >= durationMins) {
            return {
                start: slot.start,
                end: addMinutes(slot.start, durationMins),
            };
        }
    }
    return null;
}

/**
 * Deterministic planning engine with variation support.
 */
export function generatePlan(input: PlannerInput): {
    blocks: PlanBlock[];
    warnings: string[];
} {
    const { fixedEvents, commitments, preferences, weekStart, variation = "A" } = input;
    const blocks: PlanBlock[] = [];
    const warnings: string[] = [];
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });
    const userTimezone = preferences.timezone || "UTC";

    // Track occupied slots per day (day index 0-6 = Mon-Sun)
    const occupiedByDay: Map<number, TimeSlot[]> = new Map();
    for (let d = 0; d < 7; d++) {
        occupiedByDay.set(d, []);
    }

    // Helper to get day index from date
    const getDayIndex = (date: Date): number => {
        const diff = Math.floor(
            (date.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
        );
        return Math.max(0, Math.min(6, diff));
    };

    // Helper to mark a slot as occupied
    const markOccupied = (dayIndex: number, slot: TimeSlot) => {
        const existing = occupiedByDay.get(dayIndex) || [];
        existing.push(slot);
        occupiedByDay.set(dayIndex, existing);
    };

    // Step 1: Place fixed events
    for (const event of fixedEvents) {
        const start = parseISO(event.start);
        const end = parseISO(event.end);
        const dayIndex = getDayIndex(start);

        if (dayIndex >= 0 && dayIndex < 7) {
            blocks.push({
                start: event.start,
                end: event.end,
                title: event.title,
                block_type: "fixed_event",
                reasoning: "Existing calendar event — immovable.",
                goal_tags: [],
            });
            markOccupied(dayIndex, { start, end });
        }
    }

    // Step 2: Sort commitments by priority (with variation)
    const now = new Date();
    const sortedCommitments = [...commitments].sort((a, b) => {
        // Due-soon items first
        const aDue = a.due_at ? parseISO(a.due_at).getTime() : Infinity;
        const bDue = b.due_at ? parseISO(b.due_at).getTime() : Infinity;
        if (aDue !== bDue) return aDue - bDue;

        // Variation A prefers original order, B reverses equal-priority items
        if (variation === "B") {
            return b.title.localeCompare(a.title);
        }
        return a.title.localeCompare(b.title);
    });

    // Track commitments per day for overload check
    const commitmentsPerDay: Map<number, number> = new Map();

    // Step 3: Schedule commitments
    for (const commitment of sortedCommitments) {
        const duration = commitment.duration_mins || 60;

        // Fixed-time commitments
        if (commitment.start_at) {
            const start = parseISO(commitment.start_at);
            const end = commitment.end_at
                ? parseISO(commitment.end_at)
                : addMinutes(start, duration);
            const dayIndex = getDayIndex(start);

            if (dayIndex >= 0 && dayIndex < 7) {
                const dayCount = commitmentsPerDay.get(dayIndex) || 0;
                if (dayCount >= preferences.max_commitments_per_day) {
                    warnings.push(
                        `⚠️ "${commitment.title}" on ${format(start, "EEEE")} exceeds max commitments (${preferences.max_commitments_per_day}/day).`
                    );
                }

                blocks.push({
                    start: start.toISOString(),
                    end: end.toISOString(),
                    title: commitment.title,
                    block_type: "task",
                    commitment_id: commitment.id,
                    reasoning: `Fixed-time ${commitment.type}: ${commitment.required_action}. ${commitment.goal_tags.length > 0
                            ? `Goals: ${commitment.goal_tags.join(", ")}.`
                            : ""
                        } Strength: ${commitment.commitment_strength}.`,
                    goal_tags: commitment.goal_tags,
                });
                markOccupied(dayIndex, { start, end });
                commitmentsPerDay.set(dayIndex, dayCount + 1);

                // Add prep block if needed
                if (commitment.prep_mins && commitment.prep_mins > 0) {
                    const prepEnd = start;
                    const prepStart = addMinutes(start, -commitment.prep_mins);
                    const occupied = occupiedByDay.get(dayIndex) || [];
                    const available = getAvailableSlots(
                        addDays(monday, dayIndex),
                        preferences.work_start,
                        preferences.work_end,
                        occupied,
                        userTimezone
                    );

                    // Check if prep slot is available
                    const prepSlot = available.find(
                        (s) =>
                            isBefore(s.start, prepStart) || s.start.getTime() === prepStart.getTime()
                    );

                    if (prepSlot) {
                        blocks.push({
                            start: prepStart.toISOString(),
                            end: prepEnd.toISOString(),
                            title: `Prep: ${commitment.title}`,
                            block_type: "prep",
                            commitment_id: commitment.id,
                            reasoning: `${commitment.prep_mins} min preparation for "${commitment.title}". Scheduled before the event.`,
                            goal_tags: commitment.goal_tags,
                        });
                        markOccupied(dayIndex, { start: prepStart, end: prepEnd });
                    }
                }
            }
            continue;
        }

        // Flexible commitments — find best slot
        let scheduled = false;

        // Prefer scheduling before the due date
        const dueDateObj = commitment.due_at ? parseISO(commitment.due_at) : null;
        const urgencyReason = dueDateObj
            ? `Due ${format(dueDateObj, "EEEE, MMM d")}.`
            : "";

        // Variation: Option B tries to schedule from the end of the day or week? 
        // Let's keep it simple: Variation B just changes sort order.
        for (let d = 0; d < 7; d++) {
            if (scheduled) break;

            const dayDate = addDays(monday, d);

            // Skip past days
            if (isBefore(dayDate, now) && getDayIndex(now) > d) continue;

            // If there's a due date, don't schedule after it
            if (dueDateObj && isAfter(dayDate, dueDateObj)) {
                warnings.push(
                    `⚠️ Cannot schedule "${commitment.title}" — it's due ${format(dueDateObj, "MMM d")} and no earlier slots available.`
                );
                break;
            }

            const dayCount = commitmentsPerDay.get(d) || 0;
            if (dayCount >= preferences.max_commitments_per_day) continue;

            const occupied = occupiedByDay.get(d) || [];
            const available = getAvailableSlots(
                dayDate,
                preferences.work_start,
                preferences.work_end,
                occupied,
                userTimezone
            );

            const slot = findSlot(available, duration);
            if (slot) {
                blocks.push({
                    start: slot.start.toISOString(),
                    end: slot.end.toISOString(),
                    title: commitment.title,
                    block_type: "task",
                    commitment_id: commitment.id,
                    reasoning: `Scheduled ${commitment.type} on ${format(slot.start, "EEEE")} (${format(slot.start, "h:mm a")}–${format(slot.end, "h:mm a")}). ${urgencyReason} ${commitment.goal_tags.length > 0
                            ? `Goals: ${commitment.goal_tags.join(", ")}.`
                            : ""
                        }`,
                    goal_tags: commitment.goal_tags,
                });
                markOccupied(d, slot);
                commitmentsPerDay.set(d, dayCount + 1);
                scheduled = true;
            }
        }

        if (!scheduled) {
            warnings.push(
                `⚠️ Cannot schedule "${commitment.title}" (${duration} min) — no available slots within work hours this week.`
            );
        }
    }

    // Step 4: Add focus blocks (2 per day) in morning windows
    const focusDuration = preferences.focus_block_mins;
    const workStartParsed = parseWorkTime(preferences.work_start);
    const morningEndHour = Math.min(workStartParsed.hours + 4, 18); // Increased range to ensure focus blocks fit

    for (let d = 0; d < 5; d++) {
        // Weekdays only
        const dayDate = addDays(monday, d);
        if (isBefore(dayDate, now) && getDayIndex(now) > d) continue;

        const occupied = occupiedByDay.get(d) || [];
        
        // Zoned morning end
        const zonedDay = toZonedTime(dayDate, userTimezone);
        const morningEndLocal = setMinutes(setHours(zonedDay, morningEndHour), 0);
        const morningEnd = fromZonedTime(morningEndLocal, userTimezone);

        const morningSlots = getAvailableSlots(
            dayDate,
            preferences.work_start,
            format(morningEndLocal, "HH:mm"),
            occupied,
            userTimezone
        );

        // Try to place up to 2 focus blocks
        let focusCount = 0;
        for (const slot of morningSlots) {
            if (focusCount >= (variation === "B" ? 1 : 2)) break; // Variation B has fewer focus blocks to differentiate
            const slotDuration = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
            if (slotDuration >= focusDuration) {
                const focusEnd = addMinutes(slot.start, focusDuration);
                blocks.push({
                    start: slot.start.toISOString(),
                    end: focusEnd.toISOString(),
                    title: "Focus Block",
                    block_type: "focus_block",
                    reasoning: `${focusDuration}-min focus block in morning window (${format(slot.start, "h:mm a")}–${format(focusEnd, "h:mm a")}). Morning hours are optimal for deep work.`,
                    goal_tags: [],
                });
                markOccupied(d, { start: slot.start, end: focusEnd });
                focusCount++;
            }
        }
    }

    // Sort blocks by start time
    blocks.sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    return { blocks, warnings };
}

/**
 * Generate mock calendar events for demo mode.
 */
export function generateDemoCalendarEvents(weekStart: Date): CalendarEvent[] {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 });

    return [
        {
            id: "demo-1",
            title: "MBA Strategy Class",
            start: setMinutes(setHours(addDays(monday, 0), 10), 0).toISOString(),
            end: setMinutes(setHours(addDays(monday, 0), 11), 30).toISOString(),
            description: "Section A - Professor Smith",
        },
        {
            id: "demo-2",
            title: "Finance Lecture",
            start: setMinutes(setHours(addDays(monday, 1), 14), 0).toISOString(),
            end: setMinutes(setHours(addDays(monday, 1), 15), 30).toISOString(),
            description: "Corporate Finance - Room 201",
        },
        {
            id: "demo-3",
            title: "Study Group",
            start: setMinutes(setHours(addDays(monday, 2), 16), 0).toISOString(),
            end: setMinutes(setHours(addDays(monday, 2), 17), 30).toISOString(),
            description: "Case study prep",
        },
        {
            id: "demo-4",
            title: "Career Services Workshop",
            start: setMinutes(setHours(addDays(monday, 3), 12), 0).toISOString(),
            end: setMinutes(setHours(addDays(monday, 3), 13), 0).toISOString(),
            description: "Resume review session",
        },
        {
            id: "demo-5",
            title: "Team Project Meeting",
            start: setMinutes(setHours(addDays(monday, 4), 9), 0).toISOString(),
            end: setMinutes(setHours(addDays(monday, 4), 10), 0).toISOString(),
            description: "Strategy capstone",
        },
    ];
}
