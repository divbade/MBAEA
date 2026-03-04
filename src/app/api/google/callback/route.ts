import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(`${origin}/settings?error=no_code`);
    }

    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.redirect(`${origin}/login`);
        }

        const client = getOAuth2Client();
        const { tokens } = await client.getToken(code);

        // Store tokens server-side using service role (bypasses RLS)
        const serviceClient = await createServiceClient();
        await serviceClient.from("google_tokens").upsert({
            user_id: user.id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expiry: tokens.expiry_date
                ? new Date(tokens.expiry_date).toISOString()
                : null,
            scopes: tokens.scope?.split(" ") || [],
        });

        return NextResponse.redirect(`${origin}/settings?calendar=connected`);
    } catch (err) {
        console.error("Google callback error:", err);
        return NextResponse.redirect(`${origin}/settings?error=google_auth`);
    }
}
