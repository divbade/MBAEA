"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Sun,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
} from "lucide-react";
import type { PlanBlock, Commitment } from "@/lib/types";
import { format, parseISO, isToday, isTomorrow, addDays } from "date-fns";

export default function BriefPage() {
    const [todayBlocks, setTodayBlocks] = useState<PlanBlock[]>([]);
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<Commitment[]>([]);
    const [loading, setLoading] = useState(true);
    const [commitmentCount, setCommitmentCount] = useState(0);

    const fetchBriefData = useCallback(async () => {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get latest plan
        const { data: plan } = await supabase
            .from("plans")
            .select("plan_json")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (plan?.plan_json) {
            const blocks = plan.plan_json as PlanBlock[];
            const today = new Date();
            const todaysBlocks = blocks.filter((b) =>
                isToday(parseISO(b.start))
            );
            setTodayBlocks(todaysBlocks);
        }

        // Get upcoming deadlines
        const { data: commitments } = await supabase
            .from("commitments")
            .select("*")
            .eq("user_id", user.id)
            .not("due_at", "is", null)
            .order("due_at", { ascending: true })
            .limit(5);

        if (commitments) {
            setUpcomingDeadlines(
                commitments.filter((c) => new Date(c.due_at!) > new Date())
            );
        }

        // Get total commitments
        const { count } = await supabase
            .from("commitments")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
        setCommitmentCount(count || 0);

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchBriefData();
    }, [fetchBriefData]);

    const now = new Date();
    const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={24} className="animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.05))' }}
                    >
                        <Sun size={20} className="text-warning" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{greeting}!</h1>
                        <p className="text-foreground-muted text-sm">
                            {format(now, "EEEE, MMMM d, yyyy")}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Today's Schedule */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar size={16} className="text-accent" />
                        <h2 className="font-semibold">Today&apos;s Schedule</h2>
                        <span className="badge bg-accent/15 text-accent ml-auto">
                            {todayBlocks.length} blocks
                        </span>
                    </div>

                    {todayBlocks.length === 0 ? (
                        <div className="text-center py-6 text-foreground-muted text-sm">
                            <p>No blocks for today.</p>
                            <p className="text-xs mt-1">
                                <a href="/planner" className="text-accent hover:underline">Generate a plan</a> to see your schedule.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {todayBlocks.map((block, i) => {
                                const isPast = new Date(block.end) < now;
                                return (
                                    <div
                                        key={i}
                                        className={`p-3 rounded-xl border transition-all ${isPast
                                                ? "opacity-40 border-border bg-white/[0.02]"
                                                : "border-accent/20 bg-accent/5"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {isPast ? (
                                                    <CheckCircle2 size={14} className="text-success" />
                                                ) : (
                                                    <Clock size={14} className="text-accent" />
                                                )}
                                                <span className="text-sm font-medium">{block.title}</span>
                                            </div>
                                            <span className="text-xs font-mono text-foreground-muted">
                                                {format(parseISO(block.start), "h:mm a")} – {format(parseISO(block.end), "h:mm a")}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="glass-card p-6">
                        <h2 className="font-semibold mb-4">Quick Stats</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl bg-white/[0.03]">
                                <p className="text-2xl font-bold gradient-text">{commitmentCount}</p>
                                <p className="text-xs text-foreground-muted">Total commitments</p>
                            </div>
                            <div className="p-3 rounded-xl bg-white/[0.03]">
                                <p className="text-2xl font-bold gradient-text">{todayBlocks.length}</p>
                                <p className="text-xs text-foreground-muted">Today&apos;s blocks</p>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming deadlines */}
                    <div className="glass-card p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle size={16} className="text-warning" />
                            <h2 className="font-semibold">Upcoming Deadlines</h2>
                        </div>

                        {upcomingDeadlines.length === 0 ? (
                            <p className="text-foreground-muted text-sm text-center py-4">No upcoming deadlines</p>
                        ) : (
                            <div className="space-y-2">
                                {upcomingDeadlines.map((deadline) => {
                                    const dueDate = new Date(deadline.due_at!);
                                    const isUrgent = dueDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000;
                                    return (
                                        <div
                                            key={deadline.id}
                                            className={`p-3 rounded-xl border ${isUrgent
                                                    ? "border-danger/20 bg-danger/5"
                                                    : "border-border bg-white/[0.02]"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{deadline.title}</span>
                                                <span className={`text-xs ${isUrgent ? "text-danger" : "text-foreground-muted"}`}>
                                                    {isToday(dueDate) ? "Today" :
                                                        isTomorrow(dueDate) ? "Tomorrow" :
                                                            format(dueDate, "MMM d")}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
