"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    Inbox as InboxIcon,
    Check,
    X,
    Edit3,
    ChevronDown,
    ChevronUp,
    Tag,
    Clock,
    Target,
    Loader2,
    Zap,
    AlertCircle,
} from "lucide-react";
import type { CandidateItem, ExtractedCommitment, GoalTag, Preferences } from "@/lib/types";
import { calculateRankScore } from "@/lib/ranking";

export default function InboxPage() {
    const [candidates, setCandidates] = useState<(CandidateItem & { rank_score: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<Partial<ExtractedCommitment>>({});
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [preferences, setPreferences] = useState<Preferences | null>(null);

    const fetchData = useCallback(async () => {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch preferences
        const { data: prefs } = await supabase
            .from("preferences")
            .select("*")
            .eq("user_id", user.id)
            .single();

        setPreferences(prefs);

        // Fetch candidates
        const { data: items } = await supabase
            .from("candidate_items")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "NEW")
            .order("created_at", { ascending: false });

        if (items && prefs) {
            // Get today's commitment count
            const { count } = await supabase
                .from("commitments")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id);

            const ranked = (items as CandidateItem[])
                .map((item) => ({
                    ...item,
                    rank_score: calculateRankScore(item, {
                        goalWeights: prefs.goal_weights,
                        maxCommitmentsPerDay: prefs.max_commitments_per_day,
                        existingCommitmentsToday: count || 0,
                        now: new Date(),
                    }),
                }))
                .sort((a, b) => b.rank_score - a.rank_score);

            setCandidates(ranked);
        } else {
            setCandidates((items || []).map((item) => ({
                ...(item as CandidateItem),
                rank_score: 0,
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAction = async (id: string, action: "accept" | "dismiss" | "edit", editedFields?: Partial<ExtractedCommitment>) => {
        setActionLoading(id);
        try {
            const res = await fetch(`/api/inbox/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, edited_fields: editedFields }),
            });

            if (res.ok) {
                setCandidates((prev) => prev.filter((c) => c.id !== id));
                setEditingId(null);
                setEditFields({});
            }
        } catch (err) {
            console.error("Action failed:", err);
        } finally {
            setActionLoading(null);
        }
    };

    const startEdit = (item: CandidateItem) => {
        setEditingId(item.id);
        setEditFields(item.extracted_json);
    };

    const goalTagClass = (tag: string) => `tag-${tag}`;

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
                        <InboxIcon size={20} className="text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Inbox</h1>
                        <p className="text-foreground-muted text-sm">
                            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} to review
                        </p>
                    </div>
                </div>
            </div>

            {candidates.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <InboxIcon size={40} className="text-foreground-muted mx-auto mb-4 opacity-30" />
                    <p className="text-foreground-muted">
                        Your inbox is empty. Go to{" "}
                        <a href="/capture" className="text-accent hover:underline">Capture</a>{" "}
                        to add items.
                    </p>
                </div>
            ) : (
                <div className="space-y-3 stagger-children">
                    {candidates.map((item) => {
                        const ext = item.extracted_json;
                        const isExpanded = expandedId === item.id;
                        const isEditing = editingId === item.id;

                        return (
                            <div
                                key={item.id}
                                className="glass-card p-5 transition-all duration-200"
                            >
                                {/* Main row */}
                                <div className="flex items-start gap-4">
                                    {/* Score badge */}
                                    <div className="flex flex-col items-center gap-1 min-w-[48px]">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                                            style={{
                                                background: item.rank_score >= 5
                                                    ? 'rgba(16, 185, 129, 0.15)'
                                                    : item.rank_score >= 2
                                                        ? 'rgba(99, 102, 241, 0.15)'
                                                        : 'rgba(255, 255, 255, 0.05)',
                                                color: item.rank_score >= 5
                                                    ? 'var(--success)'
                                                    : item.rank_score >= 2
                                                        ? 'var(--accent)'
                                                        : 'var(--foreground-muted)',
                                            }}
                                        >
                                            {item.rank_score.toFixed(1)}
                                        </div>
                                        <span className="text-[10px] text-foreground-muted">score</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-sm truncate">{ext.title}</h3>
                                            <span className={`badge ${ext.commitment_strength === "confirmed" ? "bg-success/15 text-success" :
                                                    ext.commitment_strength === "likely" ? "bg-accent/15 text-accent" :
                                                        ext.commitment_strength === "soft" ? "bg-warning/15 text-warning" :
                                                            "bg-foreground-muted/15 text-foreground-muted"
                                                }`}>
                                                {ext.commitment_strength}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="badge bg-accent/10 text-accent">{ext.type}</span>
                                            <span className="badge bg-white/5 text-foreground-muted">{ext.required_action}</span>
                                            {ext.goal_tags.map((tag) => (
                                                <span key={tag} className={`badge ${goalTagClass(tag)}`}>{tag}</span>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-foreground-muted">
                                            {ext.start_at && (
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(ext.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </span>
                                            )}
                                            {ext.due_at && (
                                                <span className="flex items-center gap-1">
                                                    <AlertCircle size={12} />
                                                    Due {new Date(ext.due_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </span>
                                            )}
                                            {ext.duration_mins && (
                                                <span>{ext.duration_mins}min</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleAction(item.id, "accept")}
                                            disabled={actionLoading === item.id}
                                            className="btn-success py-2 px-3"
                                            title="Accept"
                                        >
                                            {actionLoading === item.id ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Check size={14} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => startEdit(item)}
                                            className="btn-secondary py-2 px-3"
                                            title="Edit"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleAction(item.id, "dismiss")}
                                            disabled={actionLoading === item.id}
                                            className="btn-danger py-2 px-3"
                                            title="Dismiss"
                                        >
                                            <X size={14} />
                                        </button>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                            className="p-2 text-foreground-muted hover:text-foreground transition-colors"
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && !isEditing && (
                                    <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-foreground-muted text-xs">Raw text</span>
                                                <p className="mt-1 p-2 rounded-lg bg-white/[0.02] text-xs font-mono">{item.raw_text}</p>
                                            </div>
                                            <div>
                                                <span className="text-foreground-muted text-xs">Rationale</span>
                                                <p className="mt-1 text-xs text-foreground-muted">{ext.rationale}</p>
                                                <div className="mt-2">
                                                    <div className="flex justify-between text-xs text-foreground-muted mb-1">
                                                        <span>Confidence</span>
                                                        <span>{Math.round(ext.confidence * 100)}%</span>
                                                    </div>
                                                    <div className="confidence-bar">
                                                        <div className="confidence-fill" style={{
                                                            width: `${ext.confidence * 100}%`,
                                                            background: ext.confidence > 0.7 ? 'var(--success)' : ext.confidence > 0.4 ? 'var(--warning)' : 'var(--danger)',
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Score breakdown */}
                                        <div className="mt-3 p-3 rounded-lg bg-white/[0.02]">
                                            <div className="flex items-center gap-2 text-xs font-medium mb-2">
                                                <Zap size={12} className="text-accent" />
                                                Score Breakdown
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-xs text-foreground-muted">
                                                <div>
                                                    <span className="block text-foreground">Goal weight</span>
                                                    {ext.goal_tags.map((tag) => (
                                                        <span key={tag}>{tag}: {preferences?.goal_weights?.[tag] ?? '?'} </span>
                                                    ))}
                                                </div>
                                                <div>
                                                    <span className="block text-foreground">Urgency</span>
                                                    {ext.due_at || ext.start_at ? 'Applied' : 'None'}
                                                </div>
                                                <div>
                                                    <span className="block text-foreground">Strength</span>
                                                    {ext.commitment_strength}
                                                </div>
                                                <div>
                                                    <span className="block text-foreground">Confidence</span>
                                                    {Math.round(ext.confidence * 100)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Edit mode */}
                                {isEditing && (
                                    <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-foreground-muted mb-1 block">Title</label>
                                                <input
                                                    className="input-field text-sm"
                                                    value={editFields.title || ""}
                                                    onChange={(e) => setEditFields((f) => ({ ...f, title: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-foreground-muted mb-1 block">Type</label>
                                                <select
                                                    className="input-field text-sm"
                                                    value={editFields.type || ""}
                                                    onChange={(e) => setEditFields((f) => ({ ...f, type: e.target.value as ExtractedCommitment["type"] }))}
                                                >
                                                    <option value="meeting">Meeting</option>
                                                    <option value="deadline">Deadline</option>
                                                    <option value="task">Task</option>
                                                    <option value="invite">Invite</option>
                                                    <option value="fyi">FYI</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-foreground-muted mb-1 block">Goal Tags</label>
                                                <div className="flex flex-wrap gap-1">
                                                    {(["recruiting", "academics", "health", "relationships", "clubs", "admin"] as GoalTag[]).map((tag) => (
                                                        <button
                                                            key={tag}
                                                            className={`badge cursor-pointer ${editFields.goal_tags?.includes(tag) ? goalTagClass(tag) : "bg-white/5 text-foreground-muted"
                                                                }`}
                                                            onClick={() => {
                                                                const current = editFields.goal_tags || [];
                                                                setEditFields((f) => ({
                                                                    ...f,
                                                                    goal_tags: current.includes(tag)
                                                                        ? current.filter((t) => t !== tag)
                                                                        : [...current, tag],
                                                                }));
                                                            }}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-foreground-muted mb-1 block">Duration (mins)</label>
                                                <input
                                                    type="number"
                                                    className="input-field text-sm"
                                                    value={editFields.duration_mins || ""}
                                                    onChange={(e) => setEditFields((f) => ({ ...f, duration_mins: parseInt(e.target.value) || undefined }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                className="btn-success flex-1 justify-center"
                                                onClick={() => handleAction(item.id, "edit", editFields)}
                                            >
                                                <Check size={14} /> Accept with edits
                                            </button>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditFields({});
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
