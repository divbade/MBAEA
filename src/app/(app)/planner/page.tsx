"use client";

import { useState, useEffect } from "react";
import {
    CalendarDays,
    Sparkles,
    AlertTriangle,
    Info,
    ThumbsUp,
    ThumbsDown,
    Loader2,
    Play,
    Calendar,
} from "lucide-react";
import type { PlanBlock } from "@/lib/types";
import { format, parseISO, startOfWeek, addDays } from "date-fns";

const BLOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    fixed_event: { bg: "rgba(107, 114, 128, 0.15)", border: "rgba(107, 114, 128, 0.3)", text: "#9ca3af" },
    task: { bg: "rgba(99, 102, 241, 0.15)", border: "rgba(99, 102, 241, 0.3)", text: "#818cf8" },
    focus_block: { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)", text: "#34d399" },
    prep: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)", text: "#fbbf24" },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PlannerPage() {
    const [plan, setPlan] = useState<PlanBlock[] | null>(null);
    const [options, setOptions] = useState<{ A: PlanBlock[]; B: PlanBlock[] } | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [selectedBlock, setSelectedBlock] = useState<PlanBlock | null>(null);
    const [demoMode, setDemoMode] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "up" | "down" | "info" } | null>(null);
    const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null);

    // Load the latest saved plan on mount
    useEffect(() => {
        const loadSavedPlan = async () => {
            try {
                const res = await fetch("/api/planner");
                if (res.ok) {
                    const data = await res.json();
                    if (data.plan?.plan_json) {
                        setPlan(data.plan.plan_json);
                    }
                }
            } catch (err) {
                console.error("Failed to load saved plan:", err);
            } finally {
                setInitialLoading(false);
            }
        };
        loadSavedPlan();
    }, []);

    const generatePlan = async () => {
        setLoading(true);
        setOptions(null);
        setPlan(null);
        setSelectedOption(null);
        try {
            const res = await fetch("/api/planner", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ demo_mode: demoMode }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to generate plan");
            }

            const data = await res.json();
            if (data.options) {
                setOptions(data.options);
            } else {
                setPlan(data.plan.plan_json);
            }
            setWarnings(data.warnings || []);
        } catch (err) {
            console.error("Plan generation error:", err);
        } finally {
            setLoading(false);
        }
    };

    const selectPlan = async (option: "A" | "B") => {
        if (!options) return;
        setSelectedOption(option);
        const winner = options[option];
        const loser = options[option === "A" ? "B" : "A"];

        // Extract all goal tags to send to feedback
        const winnerTags = Array.from(new Set(winner.flatMap(b => b.goal_tags || [])));
        const loserTags = Array.from(new Set(loser.flatMap(b => b.goal_tags || [])));

        setPlan(winner);
        
        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    item_type: "PLAN_COMPARISON",
                    winner_tags: winnerTags,
                    loser_tags: loserTags,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setToast({ message: data.message, type: "info" });
                setTimeout(() => setToast(null), 4000);
            }
        } catch (err) {
            console.error("Feedback error:", err);
        }
    };

    // Group blocks by day
    const getBlocksByDay = (blocks: PlanBlock[]) => blocks.reduce(
        (acc, block) => {
            const day = format(parseISO(block.start), "EEEE");
            if (!acc[day]) acc[day] = [];
            acc[day].push(block);
            return acc;
        },
        {} as Record<string, PlanBlock[]>
    );

    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });

    const ScheduleView = ({ blocks, title, onSelect, isSelected }: { blocks: PlanBlock[], title?: string, onSelect?: () => void, isSelected?: boolean }) => {
        const dayBlocks = getBlocksByDay(blocks);
        return (
            <div className={`flex flex-col gap-4 transition-all duration-300 ${onSelect ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-accent' : ''}`} onClick={onSelect}>
                {title && (
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            {title}
                            {isSelected && <Sparkles size={16} className="text-accent animate-pulse" />}
                        </h2>
                        {onSelect && !isSelected && (
                            <button className="text-xs font-medium text-accent hover:underline">Choose this one</button>
                        )}
                    </div>
                )}
                <div className="grid gap-3">
                    {DAYS.map((day, dayIndex) => {
                        const dayDate = addDays(monday, dayIndex);
                        const currentDayBlocks = dayBlocks[day] || [];
                        if (currentDayBlocks.length === 0) return null;

                        return (
                            <div key={day} className="glass-card p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-xs">{day}</h3>
                                        <span className="text-[10px] text-foreground-muted">
                                            {format(dayDate, "MMM d")}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    {currentDayBlocks.map((block, blockIdx) => {
                                        const colors = BLOCK_COLORS[block.block_type] || BLOCK_COLORS.task;
                                        return (
                                            <div key={blockIdx} className="p-2 rounded-lg border border-border/50 text-[11px]" style={{ background: colors.bg }}>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono opacity-70" style={{ color: colors.text }}>
                                                        {format(parseISO(block.start), "h:mm")}
                                                    </span>
                                                    <span className="font-medium truncate">{block.title}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05))' }}
                    >
                        <CalendarDays size={20} className="text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Weekly Planner</h1>
                        <p className="text-foreground-muted text-sm">
                            Week of {format(monday, "MMM d, yyyy")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-foreground-muted">
                        <input
                            type="checkbox"
                            checked={demoMode}
                            onChange={(e) => setDemoMode(e.target.checked)}
                            className="accent-accent"
                        />
                        Demo events
                    </label>
                    <button onClick={generatePlan} disabled={loading} className="btn-primary">
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Generating...</>
                        ) : (
                            <><Sparkles size={16} /> Generate Plan</>
                        )}
                    </button>
                </div>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && !options && (
                <div className="mb-6 space-y-2">
                    {warnings.map((w, i) => (
                        <div key={i} className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-sm text-warning flex items-center gap-2">
                            <AlertTriangle size={16} />
                            {w}
                        </div>
                    ))}
                </div>
            )}

            {!plan && !options ? (
                initialLoading ? (
                    <div className="glass-card p-12 text-center">
                        <Loader2 size={40} className="text-foreground-muted mx-auto mb-4 animate-spin opacity-30" />
                        <p className="text-foreground-muted text-sm">Loading your plan...</p>
                    </div>
                ) : (
                    <div className="glass-card p-12 text-center">
                        <CalendarDays size={40} className="text-foreground-muted mx-auto mb-4 opacity-30" />
                        <p className="text-foreground-muted mb-2">No plan generated yet.</p>
                        <p className="text-foreground-muted text-sm">
                            Accept some items in your{" "}
                            <a href="/inbox" className="text-accent hover:underline">Inbox</a>{" "}
                            first, then click Generate Plan.
                        </p>
                    </div>
                )
            ) : options && !selectedOption ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center bg-accent/10 border border-accent/20 p-4 rounded-2xl">
                        <h2 className="text-lg font-semibold mb-1">Choose your preference</h2>
                        <p className="text-sm text-foreground-muted">I've generated two different approaches based on your goals. Which one feels better?</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <ScheduleView blocks={options.A} title="Option A" onSelect={() => selectPlan("A")} />
                        <ScheduleView blocks={options.B} title="Option B" onSelect={() => selectPlan("B")} />
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 animate-fade-in">
                    {DAYS.map((day, dayIndex) => {
                        const dayDate = addDays(monday, dayIndex);
                        const currentBlocksByDay = getBlocksByDay(plan || []);
                        const dayBlocks = currentBlocksByDay[day] || [];

                        return (
                            <div key={day} className="glass-card p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm">{day}</h3>
                                        <span className="text-xs text-foreground-muted">
                                            {format(dayDate, "MMM d")}
                                        </span>
                                    </div>
                                    <span className="text-xs text-foreground-muted">
                                        {dayBlocks.length} block{dayBlocks.length !== 1 ? "s" : ""}
                                    </span>
                                </div>

                                {dayBlocks.length === 0 ? (
                                    <p className="text-xs text-foreground-muted opacity-50 py-2">
                                        No blocks scheduled
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {dayBlocks.map((block, blockIdx) => {
                                            const colors = BLOCK_COLORS[block.block_type] || BLOCK_COLORS.task;
                                            const isSelected = selectedBlock === block;

                                            return (
                                                <div key={blockIdx}>
                                                    <div
                                                        className="p-3 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                                                        style={{
                                                            background: colors.bg,
                                                            border: `1px solid ${colors.border}`,
                                                        }}
                                                        onClick={() => setSelectedBlock(isSelected ? null : block)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-xs font-mono" style={{ color: colors.text }}>
                                                                    {format(parseISO(block.start), "h:mm a")} –{" "}
                                                                    {format(parseISO(block.end), "h:mm a")}
                                                                </div>
                                                                <span className="font-medium text-sm">{block.title}</span>
                                                                <span className="badge text-[10px]" style={{
                                                                    background: `${colors.bg}`,
                                                                    color: colors.text,
                                                                    border: `1px solid ${colors.border}`,
                                                                }}>
                                                                    {block.block_type.replace("_", " ")}
                                                                </span>
                                                                {block.goal_tags?.map((tag) => (
                                                                    <span key={tag} className={`badge tag-${tag}`}>{tag}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Reasoning tooltip */}
                                                    {isSelected && (
                                                        <div className="mt-1 ml-4 p-3 rounded-xl bg-white/[0.03] border border-border text-xs text-foreground-muted animate-fade-in">
                                                            <div className="flex items-center gap-1.5 mb-1 text-accent font-medium">
                                                                <Info size={12} />
                                                                Why this block?
                                                            </div>
                                                            {block.reasoning}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Legend */}
            {plan && (
                <div className="mt-6 glass-card p-4">
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(BLOCK_COLORS).map(([type, colors]) => (
                            <div key={type} className="flex items-center gap-2 text-xs">
                                <div className="w-3 h-3 rounded" style={{ background: colors.bg, border: `1px solid ${colors.border}` }} />
                                <span className="text-foreground-muted capitalize">{type.replace("_", " ")}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Feedback toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-in z-50 flex items-center gap-2 ${
                        toast.type === "info" ? "bg-accent/20 text-accent border border-accent/30" :
                        toast.type === "up" ? "bg-success/20 text-success border border-success/30" :
                        "bg-warning/20 text-warning border border-warning/30"
                    }`} style={{ backdropFilter: 'blur(12px)' }}>
                    {toast.type === "info" ? "✨" : toast.type === "up" ? "👍" : "👎"} {toast.message}
                </div>
            )}
        </div>
    );
}
