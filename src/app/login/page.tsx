"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        if (mode === "signup") {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: email.split("@")[0] },
                },
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            // Immediately sign in after sign-up
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setLoading(false);
                return;
            }

            router.push("/auth/callback?next=/inbox");
            router.refresh();
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(error.message);
            } else {
                router.push("/auth/callback?next=/inbox");
                router.refresh();
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background gradient orbs */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
                style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15 blur-3xl"
                style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />

            <div className="glass-card p-10 max-w-md w-full mx-4 animate-fade-in text-center">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse-glow"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                    >
                        <Sparkles size={32} className="text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold gradient-text mb-2">MBAEA</h1>
                <p className="text-foreground-muted text-sm mb-8 leading-relaxed">
                    Your intelligent executive assistant for MBA life.<br />
                    Extract commitments, plan your week, stay on top.
                </p>

                {/* Email/password form */}
                <form onSubmit={handleEmailAuth} className="space-y-3 mb-5 text-left">
                    <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted opacity-50" />
                        <input
                            id="email"
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-field pl-11"
                            required
                        />
                    </div>
                    <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted opacity-50" />
                        <input
                            id="password"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field pl-11"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-danger text-xs p-3 rounded-xl"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <AlertCircle size={14} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary w-full justify-center text-base py-3"
                        disabled={loading}
                    >
                        {loading
                            ? (mode === "signup" ? "Creating account..." : "Signing in...")
                            : (mode === "signup" ? "Create Account" : "Sign In")}
                        <ArrowRight size={16} />
                    </button>
                </form>

                {/* Toggle sign-in / sign-up */}
                <p className="text-xs text-foreground-muted mb-5">
                    {mode === "signin" ? (
                        <>Don&apos;t have an account?{" "}
                            <button
                                type="button"
                                onClick={() => { setMode("signup"); setError(null); }}
                                className="text-accent hover:text-accent-hover font-medium transition-colors"
                            >
                                Sign up
                            </button>
                        </>
                    ) : (
                        <>Already have an account?{" "}
                            <button
                                type="button"
                                onClick={() => { setMode("signin"); setError(null); }}
                                className="text-accent hover:text-accent-hover font-medium transition-colors"
                            >
                                Sign in
                            </button>
                        </>
                    )}
                </p>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-xs text-foreground-muted uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>

                {/* Google sign-in */}
                <button
                    onClick={handleGoogleLogin}
                    className="btn-secondary w-full justify-center text-sm py-3"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <p className="text-xs text-foreground-muted mt-6">
                    Google Calendar access is optional and requested separately.
                </p>
            </div>
        </div>
    );
}
