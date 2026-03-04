import { google } from "googleapis";

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
];

export function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
    );
}

export function getAuthUrl(): string {
    const client = getOAuth2Client();
    return client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });
}

export async function getCalendarClient(accessToken: string) {
    const client = getOAuth2Client();
    client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: client });
}
