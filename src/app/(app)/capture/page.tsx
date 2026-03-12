"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    PenSquare,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Tag,
    Clock,
    Target,
    Lightbulb,
    ListTodo,
} from "lucide-react";
import type { ExtractedCommitment } from "@/lib/types";

const EXAMPLES = [
    "Coffee chat with McKinsey recruiter Friday 3pm",
    "Strategy case study due next Wednesday",
    "Prepare for consulting interviews by end of March",
    "I want to improve my networking this quarter",
    "Gym workout Tuesday and Thursday mornings 7am",
];

type CaptureResult = {
    candidates: { id: string; extracted_json: ExtractedCommitment; extraction_method: string }[];
    input_type: "event" | "goal" | "intent";
    classification_reasoning: string;
    count: number;
};

export default function CapturePage() {
    const router = useRouter();
    const [rawText, setRawText] = useState("");
    const [extracting, setExtracting] = useState(false);
    const [result, setResult] = useState<CaptureResult | null>(null);
    const [error, setError] = useState("");

    const handleExtract = async () => {
        if (!rawText.trim()) return;
        setExtracting(true);
        setResult(null);
        setError("");

        try {
            const res = await fetch("/api/capture", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ raw_text: rawText }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Extraction failed");
            }

            const data = await res.json();
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setExtracting(false);
        }
    };

    const goalTagClass = (tag: string) => `tag-${tag}`;

    const inputTypeLabel = {
        event: { icon: <Tag size={14} />, text: "Event", color: "bg-accent/15 text-accent" },
        goal: { icon: <Lightbulb size={14} />, text: "Goal → Sub-tasks", color: "bg-success/15 text-success" },
        intent: { icon: <ListTodo size={14} />, text: "Intent → Tasks", color: "bg-warning/15 text-warning" },
    };

    const renderCommitmentCard = (
        item: ExtractedCommitment,
        method: string,
        index: number,
        total: number
    ) => (
        <div key={index} className="glass-card p-5 animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">
                    {total > 1 ? `Task ${index + 1} of ${total}` : "Extracted Commitment"}
                </h3>
                <span className={`badge ${method === "llm" || method === "decomposed" ? "bg-success/15 text-success" : method === "llm_repair" ? "bg-warning/15 text-warning" : "bg-foreground-muted/15 text-foreground-muted"}`}>
                    {method === "decomposed" ? "🎯 Decomposed" : method === "llm" ? "✨ AI" : method === "llm_repair" ? "🔧 Repaired" : "📏 Fallback"}
                </span>
            </div>

            <h2 className="text-base font-bold mb-3">{item.title}</h2>

            <div className="space-y-2 mb-3">
                <div className="flex items-center gap-3 text-sm">
                    <Tag size={13} className="text-foreground-muted shrink-0" />
                    <span className="badge bg-accent/15 text-accent text-[10px]">{item.type}</span>
                    <span className="badge bg-accent/15 text-accent text-[10px]">{item.required_action}</span>
                </div>

                {(item.start_at || item.due_at) && (
                    <div className="flex items-center gap-3 text-sm">
                        <Clock size={13} className="text-foreground-muted shrink-0" />
                        <span className="text-foreground-muted text-xs">
                            {item.start_at
                                ? `Starts: ${new Date(item.start_at).toLocaleString()}`
                                : `Due: ${new Date(item.due_at!).toLocaleString()}`}
                        </span>
                    </div>
                )}

                {item.duration_mins && (
                    <div className="flex items-center gap-3 text-sm">
                        <Clock size={13} className="text-foreground-muted shrink-0" />
                        <span className="text-foreground-muted text-xs">
                            {item.duration_mins} min
                            {item.prep_mins ? ` + ${item.prep_mins} min prep` : ""}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                    <Target size={13} className="text-foreground-muted shrink-0" />
                    <div className="flex gap-1.5 flex-wrap">
                        {item.goal_tags.map((tag) => (
                            <span key={tag} className={`badge text-[10px] ${goalTagClass(tag)}`}>{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Rationale */}
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-border text-xs text-foreground-muted">
                <span className="font-medium text-foreground">Why:</span>{" "}
                {item.rationale}
            </div>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05))' }}
                    >
                        <PenSquare size={20} className="text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Smart Capture</h1>
                        <p className="text-foreground-muted text-sm">
                            Paste a task, describe a goal, or share what&apos;s on your mind — we&apos;ll figure it out
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Input Column */}
                <div>
                    <div className="glass-card p-6">
                        <label className="text-xs text-foreground-muted mb-2 block uppercase tracking-wider font-medium">
                            What do you need to capture?
                        </label>
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Type anything — a specific event, a high-level goal, or just what's on your mind..."
                            rows={6}
                            className="input-field resize-none mb-4 font-mono text-sm"
                        />

                        <button
                            onClick={handleExtract}
                            disabled={!rawText.trim() || extracting}
                            className="btn-primary w-full justify-center"
                        >
                            {extracting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    Extract & Plan
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-center gap-2 text-sm text-danger">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Examples */}
                    <div className="mt-4">
                        <p className="text-xs text-foreground-muted mb-2 uppercase tracking-wider font-medium">
                            Try an example
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {EXAMPLES.map((ex, i) => (
                                <button
                                    key={i}
                                    onClick={() => setRawText(ex)}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-foreground-muted
                    border border-border hover:border-accent/30 hover:text-accent transition-all"
                                >
                                    {ex}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Preview Column */}
                <div>
                    {result ? (
                        <div className="space-y-4">
                            {/* Classification badge */}
                            <div className="flex items-center gap-3">
                                <span className={`badge ${inputTypeLabel[result.input_type].color} flex items-center gap-1.5`}>
                                    {inputTypeLabel[result.input_type].icon}
                                    {inputTypeLabel[result.input_type].text}
                                </span>
                                {result.count > 1 && (
                                    <span className="text-xs text-foreground-muted">
                                        Decomposed into {result.count} tasks
                                    </span>
                                )}
                            </div>

                            {/* Classification reasoning */}
                            {result.input_type !== "event" && (
                                <div className="p-3 rounded-xl bg-accent/5 border border-accent/10 text-xs text-foreground-muted">
                                    <span className="font-medium text-accent">🧠 Classification:</span>{" "}
                                    {result.classification_reasoning}
                                </div>
                            )}

                            {/* Commitment cards */}
                            {result.candidates.map((c, i) =>
                                renderCommitmentCard(
                                    c.extracted_json,
                                    c.extraction_method,
                                    i,
                                    result.candidates.length
                                )
                            )}

                            {/* Success message */}
                            <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2 text-sm text-success">
                                <CheckCircle2 size={16} />
                                {result.count > 1
                                    ? `${result.count} tasks saved to inbox`
                                    : "Saved to inbox"}
                                <button
                                    onClick={() => router.push("/inbox")}
                                    className="ml-auto flex items-center gap-1 text-success hover:underline"
                                >
                                    Go to inbox <ArrowRight size={14} />
                                </button>
                            </div>

                            {/* Capture another */}
                            <button
                                onClick={() => {
                                    setRawText("");
                                    setResult(null);
                                }}
                                className="btn-secondary w-full justify-center"
                            >
                                Capture another
                            </button>
                        </div>
                    ) : (
                        <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px] text-center opacity-50">
                            <Sparkles size={32} className="text-foreground-muted mb-3" />
                            <p className="text-foreground-muted text-sm">
                                Type or paste anything on the left.<br />
                                Events get parsed. Goals get decomposed into tasks.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
