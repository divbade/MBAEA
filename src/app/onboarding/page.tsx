"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Target, Clock, Zap } from "lucide-react";
import type { GoalTag } from "@/lib/types";

const GOALS: { tag: GoalTag; label: string; emoji: string; desc: string }[] = [
    { tag: "recruiting", label: "Recruiting", emoji: "💼", desc: "Job search, networking, interviews" },
    { tag: "academics", label: "Academics", emoji: "📚", desc: "Classes, assignments, exams" },
    { tag: "health", label: "Health", emoji: "🏃", desc: "Exercise, wellness, sleep" },
    { tag: "relationships", label: "Relationships", emoji: "❤️", desc: "Friends, family, social" },
    { tag: "clubs", label: "Clubs", emoji: "🎯", desc: "Student orgs, leadership" },
    { tag: "admin", label: "Admin", emoji: "📋", desc: "Bills, errands, logistics" },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Step 1: Goals
    const [selectedGoals, setSelectedGoals] = useState<Record<GoalTag, number>>({
        recruiting: 3,
        academics: 3,
        health: 2,
        relationships: 2,
        clubs: 1,
        admin: 1,
    });

    // Step 2: Constraints
    const [workStart, setWorkStart] = useState("08:00");
    const [workEnd, setWorkEnd] = useState("18:00");
    const [maxCommitments, setMaxCommitments] = useState(6);
    const [focusBlockMins, setFocusBlockMins] = useState(90);

    const toggleGoal = (tag: GoalTag) => {
        setSelectedGoals((prev) => ({
            ...prev,
            [tag]: prev[tag] > 0 ? 0 : 3,
        }));
    };

    const setWeight = (tag: GoalTag, weight: number) => {
        setSelectedGoals((prev) => ({ ...prev, [tag]: weight }));
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            // Upsert preferences
            await supabase.from("preferences").upsert({
                user_id: user.id,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                work_start: workStart,
                work_end: workEnd,
                max_commitments_per_day: maxCommitments,
                focus_block_mins: focusBlockMins,
                goal_weights: selectedGoals,
            }, { onConflict: "user_id" });

            // Mark onboarded
            await supabase
                .from("profiles")
                .update({ onboarded: true })
                .eq("id", user.id);

            router.push("/inbox");
        } catch (err) {
            console.error("Onboarding error:", err);
        } finally {
            setLoading(false);
        }
    };

    const activeGoals = Object.entries(selectedGoals).filter(([, w]) => w > 0);

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
                style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

            <div className="glass-card p-8 max-w-lg w-full mx-4 animate-fade-in">
                {/* Progress */}
                <div className="flex gap-2 mb-8">
                    {[0, 1].map((s) => (
                        <div
                            key={s}
                            className="flex-1 h-1 rounded-full transition-all duration-500"
                            style={{
                                background: s <= step
                                    ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                                    : 'rgba(255,255,255,0.05)',
                            }}
                        />
                    ))}
                </div>

                {step === 0 && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-3 mb-2">
                            <Target size={22} className="text-accent" />
                            <h2 className="text-xl font-bold">What are your priorities?</h2>
                        </div>
                        <p className="text-foreground-muted text-sm mb-6">
                            Select your goals and adjust importance (1-5). This helps us prioritize your inbox.
                        </p>

                        <div className="grid gap-3">
                            {GOALS.map((goal) => {
                                const isActive = selectedGoals[goal.tag] > 0;
                                return (
                                    <div
                                        key={goal.tag}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${isActive
                                                ? "border-accent/30 bg-accent/5"
                                                : "border-border bg-white/[0.02] opacity-50"
                                            }`}
                                        onClick={() => toggleGoal(goal.tag)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{goal.emoji}</span>
                                                <div>
                                                    <p className="font-medium text-sm">{goal.label}</p>
                                                    <p className="text-xs text-foreground-muted">{goal.desc}</p>
                                                </div>
                                            </div>
                                            {isActive && (
                                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                                    {[1, 2, 3, 4, 5].map((w) => (
                                                        <button
                                                            key={w}
                                                            className={`w-6 h-6 rounded-md text-xs font-bold transition-all ${selectedGoals[goal.tag] >= w
                                                                    ? "bg-accent text-white"
                                                                    : "bg-white/5 text-foreground-muted"
                                                                }`}
                                                            onClick={() => setWeight(goal.tag, w)}
                                                        >
                                                            {w}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            className="btn-primary w-full justify-center mt-6"
                            onClick={() => setStep(1)}
                            disabled={activeGoals.length === 0}
                        >
                            Continue
                            <Zap size={16} />
                        </button>
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-3 mb-2">
                            <Clock size={22} className="text-accent" />
                            <h2 className="text-xl font-bold">Set your constraints</h2>
                        </div>
                        <p className="text-foreground-muted text-sm mb-6">
                            When do you work and how much can you take on?
                        </p>

                        <div className="space-y-5">
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

                            <div>
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

                            <div>
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

                        <div className="flex gap-3 mt-8">
                            <button className="btn-secondary flex-1 justify-center" onClick={() => setStep(0)}>
                                Back
                            </button>
                            <button
                                className="btn-primary flex-1 justify-center"
                                onClick={handleComplete}
                                disabled={loading}
                            >
                                {loading ? "Setting up..." : "Get Started"}
                                <Sparkles size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
