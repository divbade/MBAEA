"use client";

import { createClient } from "@/lib/supabase/client";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
    const handleGoogleLogin = async () => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
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

                <button
                    onClick={handleGoogleLogin}
                    className="btn-primary w-full justify-center text-base py-3.5 mb-4"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                </button>

                <p className="text-xs text-foreground-muted mt-6">
                    We only access your calendar with explicit permission.
                </p>
            </div>
        </div>
    );
}
