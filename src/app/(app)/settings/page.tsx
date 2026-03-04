"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Settings as SettingsIcon,
    Save,
    Loader2,
    Calendar,
    ExternalLink,
    CheckCircle2,
} from "lucide-react";
import type { GoalTag, GoalWeights, Preferences } from "@/lib/types";

const GOALS: { tag: GoalTag; label: string; emoji: string }[] = [
    { tag: "recruiting", label: "Recruiting", emoji: "💼" },
    { tag: "academics", label: "Academics", emoji: "📚" },
    { tag: "health", label: "Health", emoji: "🏃" },
    { tag: "relationships", label: "Relationships", emoji: "❤️" },
    { tag: "clubs", label: "Clubs", emoji: "🎯" },
    { tag: "admin", label: "Admin", emoji: "📋" },
];

export default function SettingsPage() {
    const [preferences, setPreferences] = useState<Preferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(false);

    const [workStart, setWorkStart] = useState("08:00");
    const [workEnd, setWorkEnd] = useState("18:00");
    const [maxCommitments, setMaxCommitments] = useState(6);
    const [focusBlockMins, setFocusBlockMins] = useState(90);
    const [goalWeights, setGoalWeights] = useState<GoalWeights>({
        recruiting: 3, academics: 3, health: 2, relationships: 2, clubs: 1, admin: 1,
    });

    const fetchSettings = useCallback(async () => {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prefs } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (prefs) {
            setPreferences(prefs);
            setWorkStart(prefs.work_start);
            setWorkEnd(prefs.work_end);
            setMaxCommitments(prefs.max_commitments_per_day);
            setFocusBlockMins(prefs.focus_block_mins);
            setGoalWeights(prefs.goal_weights);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
                .from("preferences")
                .update({
                    work_start: workStart,
                    work_end: workEnd,
                    max_commitments_per_day: maxCommitments,
                    focus_block_mins: focusBlockMins,
                    goal_weights: goalWeights,
                })
                .eq("user_id", user.id);

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setSaving(false);
        }
    };

    const connectGoogleCalendar = () => {
        window.location.href = "/api/google/auth";
    };

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
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05))' }}
                    >
                        <SettingsIcon size={20} className="text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Settings</h1>
                        <p className="text-foreground-muted text-sm">Manage your preferences and integrations</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Goal Weights */}
                <div className="glass-card p-6">
                    <h2 className="font-semibold text-lg mb-4">Goal Priorities</h2>
                    <p className="text-foreground-muted text-sm mb-4">
                        Adjust how much weight each goal gets in ranking and planning.
                        These weights are also updated automatically by your thumbs up/down feedback.
                    </p>
                    <div className="space-y-3">
                        {GOALS.map(({ tag, label, emoji }) => (
                            <div key={tag} className="flex items-center gap-4">
                                <span className="text-lg w-8">{emoji}</span>
                                <span className="text-sm font-medium w-28">{label}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={5}
                                    step={0.1}
                                    value={goalWeights[tag]}
                                    onChange={(e) =>
                                        setGoalWeights((w) => ({ ...w, [tag]: parseFloat(e.target.value) }))
                                    }
                                    className="flex-1 accent-accent"
                                />
                                <span className="text-sm font-mono text-accent w-8 text-right">
                                    {goalWeights[tag].toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Work Schedule */}
                <div className="glass-card p-6">
                    <h2 className="font-semibold text-lg mb-4">Work Schedule</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-foreground-muted mb-1.5 block">Work Start</label>
                            <input
                                type="time"
                                value={workStart}
                                onChange={(e) => setWorkStart(e.target.value)}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-foreground-muted mb-1.5 block">Work End</label>
                            <input
                                type="time"
                                value={workEnd}
                                onChange={(e) => setWorkEnd(e.target.value)}
                                className="input-field"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="text-xs text-foreground-muted mb-1.5 block">
                            Max commitments per day: <span className="text-accent font-bold">{maxCommitments}</span>
                        </label>
                        <input
                            type="range"
                            min={2}
                            max={12}
                            value={maxCommitments}
                            onChange={(e) => setMaxCommitments(parseInt(e.target.value))}
                            className="w-full accent-accent"
                        />
                    </div>

                    <div className="mt-4">
                        <label className="text-xs text-foreground-muted mb-1.5 block">
                            Focus block length: <span className="text-accent font-bold">{focusBlockMins} min</span>
                        </label>
                        <div className="flex gap-2">
                            {[30, 60, 90, 120].map((mins) => (
                                <button
                                    key={mins}
                                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${focusBlockMins === mins
                                            ? "bg-accent text-white"
                                            : "bg-white/5 text-foreground-muted border border-border"
                                        }`}
                                    onClick={() => setFocusBlockMins(mins)}
                                >
                                    {mins}m
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Google Calendar */}
                <div className="glass-card p-6">
                    <h2 className="font-semibold text-lg mb-4">Google Calendar</h2>
                    {calendarConnected ? (
                        <div className="flex items-center gap-2 text-success text-sm">
                            <CheckCircle2 size={16} />
                            Connected
                        </div>
                    ) : (
                        <div>
                            <p className="text-foreground-muted text-sm mb-4">
                                Connect your Google Calendar to sync events and apply plans.
                            </p>
                            <button onClick={connectGoogleCalendar} className="btn-secondary">
                                <Calendar size={16} />
                                Connect Google Calendar
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Save */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary"
                    >
                        {saving ? (
                            <><Loader2 size={16} className="animate-spin" /> Saving...</>
                        ) : saved ? (
                            <><CheckCircle2 size={16} /> Saved!</>
                        ) : (
                            <><Save size={16} /> Save Settings</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
