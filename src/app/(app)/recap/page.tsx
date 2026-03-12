"use client";

import { useState, useEffect } from "react";
import {
    BarChart3,
    Target,
    TrendingUp,
    Lightbulb,
    Loader2,
    Clock,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";

const GOAL_COLORS: Record<string, string> = {
    recruiting: "#6366f1",
    academics: "#10b981",
    health: "#f59e0b",
    relationships: "#ec4899",
    clubs: "#8b5cf6",
    admin: "#6b7280",
    untagged: "#374151",
};

type RecapData = {
    has_plan: boolean;
    message?: string;
    today: {
        date: string;
        blocks: unknown[];
        goal_minutes: Record<string, number>;
        total_minutes: number;
        alignment_score: number;
    };
    week: {
        goal_minutes: Record<string, number>;
    };
    goal_weights: Record<string, number>;
    recommendations: string[];
    feedback_count: number;
};

export default function RecapPage() {
    const [data, setData] = useState<RecapData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/recap");
                if (!res.ok) throw new Error("Failed to load recap");
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Something went wrong");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const maxMinutes = data?.today
        ? Math.max(...Object.values(data.today.goal_minutes), 1)
        : 1;

    const weekMaxMinutes = data?.week
        ? Math.max(...Object.values(data.week.goal_minutes), 1)
        : 1;

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))' }}
                    >
                        <BarChart3 size={20} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Daily Recap</h1>
                        <p className="text-foreground-muted text-sm">
                            {data?.today?.date || "How you're spending your time vs. your goals"}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 text-center">
                    <Loader2 size={40} className="text-foreground-muted mx-auto mb-4 animate-spin opacity-30" />
                    <p className="text-foreground-muted text-sm">Loading your recap...</p>
                </div>
            ) : error ? (
                <div className="glass-card p-12 text-center">
                    <AlertCircle size={40} className="text-danger mx-auto mb-4 opacity-50" />
                    <p className="text-danger text-sm">{error}</p>
                </div>
            ) : !data?.has_plan ? (
                <div className="glass-card p-12 text-center">
                    <BarChart3 size={40} className="text-foreground-muted mx-auto mb-4 opacity-30" />
                    <p className="text-foreground-muted mb-2">No plan data yet.</p>
                    <p className="text-foreground-muted text-sm">
                        Generate a plan in the{" "}
                        <a href="/planner" className="text-accent hover:underline">Planner</a>{" "}
                        to see your daily recap.
                    </p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-6">
                        {/* Alignment Score */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Target size={16} className="text-accent" />
                                <h3 className="font-semibold text-sm">Goal Alignment</h3>
                            </div>

                            <div className="flex items-center gap-6">
                                <div className="relative w-24 h-24">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        <circle cx="50" cy="50" r="40" fill="none"
                                            stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                        <circle cx="50" cy="50" r="40" fill="none"
                                            stroke={data.today.alignment_score >= 70 ? "#10b981" : data.today.alignment_score >= 40 ? "#f59e0b" : "#ef4444"}
                                            strokeWidth="8"
                                            strokeDasharray={`${data.today.alignment_score * 2.51} 251`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-xl font-bold">{data.today.alignment_score}%</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-foreground-muted mb-1">
                                        {data.today.alignment_score >= 70
                                            ? "Great alignment with your priorities!"
                                            : data.today.alignment_score >= 40
                                                ? "Moderate alignment — room for improvement"
                                                : "Low alignment — consider rebalancing"}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                                        <Clock size={12} />
                                        {data.today.total_minutes} min scheduled today
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-foreground-muted mt-1">
                                        <CheckCircle2 size={12} />
                                        {data.feedback_count} feedback items given
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Today's Goal Breakdown */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Clock size={16} className="text-accent" />
                                <h3 className="font-semibold text-sm">Today&apos;s Time by Goal</h3>
                            </div>

                            {Object.keys(data.today.goal_minutes).length === 0 ? (
                                <p className="text-xs text-foreground-muted opacity-50 py-2">
                                    No blocks scheduled for today
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(data.today.goal_minutes)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([tag, mins]) => (
                                            <div key={tag}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="capitalize font-medium">{tag}</span>
                                                    <span className="text-foreground-muted">{Math.round(mins)} min</span>
                                                </div>
                                                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${(mins / maxMinutes) * 100}%`,
                                                            background: GOAL_COLORS[tag] || GOAL_COLORS.admin,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Week Summary */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp size={16} className="text-accent" />
                                <h3 className="font-semibold text-sm">This Week So Far</h3>
                            </div>

                            {Object.keys(data.week.goal_minutes).length === 0 ? (
                                <p className="text-xs text-foreground-muted opacity-50 py-2">
                                    No data yet for this week
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(data.week.goal_minutes)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([tag, mins]) => (
                                            <div key={tag}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="capitalize font-medium">{tag}</span>
                                                    <span className="text-foreground-muted">{Math.round(mins)} min</span>
                                                </div>
                                                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${(mins / weekMaxMinutes) * 100}%`,
                                                            background: GOAL_COLORS[tag] || GOAL_COLORS.admin,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column — Recommendations */}
                    <div className="space-y-6">
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Lightbulb size={16} style={{ color: '#f59e0b' }} />
                                <h3 className="font-semibold text-sm">Recommendations for Tomorrow</h3>
                            </div>

                            <div className="space-y-3">
                                {data.recommendations.map((rec, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-border text-sm text-foreground-muted animate-fade-in"
                                        style={{ animationDelay: `${i * 150}ms` }}
                                    >
                                        <span className="text-accent font-medium mr-2">{i + 1}.</span>
                                        {rec}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Goal Weights */}
                        <div className="glass-card p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Target size={16} className="text-foreground-muted" />
                                <h3 className="font-semibold text-sm">Your Goal Priorities</h3>
                                <span className="text-xs text-foreground-muted ml-auto">
                                    Updated by feedback
                                </span>
                            </div>

                            <div className="space-y-2">
                                {Object.entries(data.goal_weights)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([tag, weight]) => (
                                        <div key={tag} className="flex items-center gap-3">
                                            <span className="capitalize text-xs w-24 font-medium">{tag}</span>
                                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${(weight / 5) * 100}%`,
                                                        background: GOAL_COLORS[tag] || GOAL_COLORS.admin,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs text-foreground-muted w-8 text-right">{weight}</span>
                                        </div>
                                    ))}
                            </div>

                            <p className="text-[10px] text-foreground-muted mt-3 opacity-50">
                                Weights adjust automatically when you give thumbs up/down feedback on plan blocks.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
