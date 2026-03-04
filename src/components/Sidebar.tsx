"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Inbox,
    PenSquare,
    CalendarDays,
    Settings,
    Sun,
    Sparkles,
    LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
    { href: "/capture", label: "Capture", icon: PenSquare },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/planner", label: "Planner", icon: CalendarDays },
    { href: "/brief", label: "Daily Brief", icon: Sun },
    { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <aside className="fixed left-0 top-0 h-screen flex flex-col justify-between py-6 px-4 border-r border-border"
            style={{ width: 'var(--sidebar-width)', background: 'var(--background-secondary)' }}
        >
            {/* Logo */}
            <div>
                <Link href="/inbox" className="flex items-center gap-2.5 px-3 mb-8">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                    >
                        <Sparkles size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold gradient-text tracking-tight">MBAEA</h1>
                        <p className="text-[10px] text-foreground-muted -mt-0.5">Executive Assistant</p>
                    </div>
                </Link>

                {/* Nav */}
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? "text-white"
                                        : "text-foreground-muted hover:text-foreground hover:bg-white/5"
                                    }`}
                                style={isActive ? {
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))',
                                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)',
                                } : {}}
                            >
                                <item.icon size={18} />
                                {item.label}
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom */}
            <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
          text-foreground-muted hover:text-danger transition-all duration-200 hover:bg-white/5"
            >
                <LogOut size={18} />
                Sign Out
            </button>
        </aside>
    );
}
