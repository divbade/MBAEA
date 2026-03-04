import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/inbox";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Check if user has completed onboarding
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                // Create profile if it doesn't exist
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("onboarded")
                    .eq("id", user.id)
                    .single();

                if (!profile) {
                    // First time user - create profile
                    await supabase.from("profiles").insert({
                        id: user.id,
                        display_name:
                            user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
                        avatar_url: user.user_metadata?.avatar_url || null,
                        onboarded: false,
                    });
                    return NextResponse.redirect(`${origin}/onboarding`);
                }

                if (!profile.onboarded) {
                    return NextResponse.redirect(`${origin}/onboarding`);
                }
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Auth error - redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
