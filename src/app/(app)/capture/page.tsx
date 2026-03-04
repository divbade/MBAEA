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
} from "lucide-react";
import type { ExtractedCommitment } from "@/lib/types";

const EXAMPLES = [
    "Coffee chat with McKinsey recruiter Friday 3pm",
    "Strategy case study due next Wednesday",
    "Reply to professor about RA position by Thursday",
    "MBA Tech Club board meeting Monday 6pm",
    "Gym workout Tuesday and Thursday mornings 7am",
];

export default function CapturePage() {
    const router = useRouter();
    const [rawText, setRawText] = useState("");
    const [extracting, setExtracting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [extracted, setExtracted] = useState<ExtractedCommitment | null>(null);
    const [method, setMethod] = useState<string>("");
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    const handleExtract = async () => {
        if (!rawText.trim()) return;
        setExtracting(true);
        setExtracted(null);
        setError("");
        setSaved(false);

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
            setExtracted(data.candidate.extracted_json);
            setMethod(data.extraction_method);
            setSaved(true); // auto-saved to inbox
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setExtracting(false);
        }
    };

    const goalTagClass = (tag: string) => `tag-${tag}`;

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
                        <h1 className="text-2xl font-bold">Capture</h1>
                        <p className="text-foreground-muted text-sm">
                            Paste anything — we&apos;ll extract the commitment
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
                            placeholder="Paste an email snippet, type a task, or jot down a commitment..."
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
                                    Extracting...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    Extract Commitment
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
                    {extracted ? (
                        <div className="glass-card p-6 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-sm">Extracted Commitment</h3>
                                <span className={`badge ${method === "llm" ? "bg-success/15 text-success" : method === "llm_repair" ? "bg-warning/15 text-warning" : "bg-foreground-muted/15 text-foreground-muted"}`}>
                                    {method === "llm" ? "✨ AI" : method === "llm_repair" ? "🔧 AI Repaired" : "📏 Fallback"}
                                </span>
                            </div>

                            {/* Title */}
                            <h2 className="text-lg font-bold mb-4">{extracted.title}</h2>

                            {/* Meta rows */}
                            <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-3 text-sm">
                                    <Tag size={14} className="text-foreground-muted" />
                                    <span className="text-foreground-muted">Type:</span>
                                    <span className="badge bg-accent/15 text-accent">{extracted.type}</span>
                                    <span className="badge bg-accent/15 text-accent">{extracted.required_action}</span>
                                </div>

                                {(extracted.start_at || extracted.due_at) && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Clock size={14} className="text-foreground-muted" />
                                        <span className="text-foreground-muted">
                                            {extracted.start_at
                                                ? `Starts: ${new Date(extracted.start_at).toLocaleString()}`
                                                : `Due: ${new Date(extracted.due_at!).toLocaleString()}`}
                                        </span>
                                    </div>
                                )}

                                {extracted.duration_mins && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <Clock size={14} className="text-foreground-muted" />
                                        <span className="text-foreground-muted">Duration: {extracted.duration_mins} min</span>
                                        {extracted.prep_mins ? (
                                            <span className="text-foreground-muted">+ {extracted.prep_mins} min prep</span>
                                        ) : null}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-sm">
                                    <Target size={14} className="text-foreground-muted" />
                                    <span className="text-foreground-muted">Goals:</span>
                                    <div className="flex gap-1.5">
                                        {extracted.goal_tags.map((tag) => (
                                            <span key={tag} className={`badge ${goalTagClass(tag)}`}>{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Confidence bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-foreground-muted mb-1">
                                    <span>Confidence</span>
                                    <span>{Math.round(extracted.confidence * 100)}%</span>
                                </div>
                                <div className="confidence-bar">
                                    <div
                                        className="confidence-fill"
                                        style={{
                                            width: `${extracted.confidence * 100}%`,
                                            background:
                                                extracted.confidence > 0.7
                                                    ? "var(--success)"
                                                    : extracted.confidence > 0.4
                                                        ? "var(--warning)"
                                                        : "var(--danger)",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Strength */}
                            <div className="flex items-center gap-2 text-sm mb-4">
                                <span className="text-foreground-muted">Strength:</span>
                                <span className={`badge ${extracted.commitment_strength === "confirmed" ? "bg-success/15 text-success" :
                                        extracted.commitment_strength === "likely" ? "bg-accent/15 text-accent" :
                                            extracted.commitment_strength === "soft" ? "bg-warning/15 text-warning" :
                                                "bg-foreground-muted/15 text-foreground-muted"
                                    }`}>
                                    {extracted.commitment_strength}
                                </span>
                            </div>

                            {/* Rationale */}
                            <div className="p-3 rounded-xl bg-white/[0.02] border border-border text-xs text-foreground-muted">
                                <span className="font-medium text-foreground">Rationale:</span>{" "}
                                {extracted.rationale}
                            </div>

                            {/* Actions */}
                            {saved && (
                                <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2 text-sm text-success">
                                    <CheckCircle2 size={16} />
                                    Saved to inbox
                                    <button
                                        onClick={() => router.push("/inbox")}
                                        className="ml-auto flex items-center gap-1 text-success hover:underline"
                                    >
                                        Go to inbox <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Capture another */}
                            <button
                                onClick={() => {
                                    setRawText("");
                                    setExtracted(null);
                                    setSaved(false);
                                }}
                                className="btn-secondary w-full justify-center mt-3"
                            >
                                Capture another
                            </button>
                        </div>
                    ) : (
                        <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[300px] text-center opacity-50">
                            <Sparkles size={32} className="text-foreground-muted mb-3" />
                            <p className="text-foreground-muted text-sm">
                                Paste text on the left and hit Extract.<br />
                                We&apos;ll parse it into a structured commitment.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
