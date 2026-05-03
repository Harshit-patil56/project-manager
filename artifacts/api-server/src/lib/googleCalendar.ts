import { google } from "googleapis";
import { db } from "@workspace/db";
import { googleTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const STATE_SECRET = process.env.SESSION_SECRET ?? "fallback-secret";

function getRedirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const domain = process.env.REPLIT_DOMAINS
    ? process.env.REPLIT_DOMAINS.split(",")[0]
    : process.env.REPLIT_DEV_DOMAIN;
  return `https://${domain}/api/auth/google/callback`;
}

function makeOAuthClient(accessToken?: string, refreshToken?: string | null) {
  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getRedirectUri(),
  );
  if (accessToken) {
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
    });
  }
  return client;
}

export function isConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

export function getAuthUrl(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId })).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(payload).digest("hex");
  const state = `${payload}.${sig}`;

  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
    prompt: "consent",
  });
}

export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", STATE_SECRET).update(payload).digest("hex");
  if (expected !== sig) return null;
  try {
    const { userId } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string) {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

async function getCalendar(userId: string) {
  const rows = await db
    .select()
    .from(googleTokensTable)
    .where(eq(googleTokensTable.userId, userId))
    .limit(1);
  if (!rows[0]) return null;

  const { accessToken, refreshToken, expiresAt } = rows[0];
  const client = makeOAuthClient(accessToken, refreshToken);

  client.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await db
        .update(googleTokensTable)
        .set({
          accessToken: newTokens.access_token,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : expiresAt,
        })
        .where(eq(googleTokensTable.userId, userId));
    }
  });

  return google.calendar({ version: "v3", auth: client });
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function nextDay(d: Date): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + 1);
  return toDateStr(copy);
}

export interface TaskEventParams {
  taskKey: string;
  title: string;
  description: string;
  date: Date;
  label: "starts" | "due";
}

export async function createTaskEvent(
  userId: string,
  params: TaskEventParams,
): Promise<string | null> {
  try {
    const cal = await getCalendar(userId);
    if (!cal) return null;
    const res = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `${params.taskKey}: ${params.title} — ${params.label}`,
        description: params.description,
        start: { date: toDateStr(params.date) },
        end: { date: nextDay(params.date) },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 1440 },
            { method: "email", minutes: 1440 },
          ],
        },
      },
    });
    return res.data.id ?? null;
  } catch {
    return null;
  }
}

export async function updateTaskEvent(
  userId: string,
  eventId: string,
  params: Partial<TaskEventParams>,
): Promise<void> {
  try {
    const cal = await getCalendar(userId);
    if (!cal) return;
    const patch: Record<string, unknown> = {};
    if (params.taskKey && params.title && params.label) {
      patch.summary = `${params.taskKey}: ${params.title} — ${params.label}`;
    }
    if (params.description !== undefined) patch.description = params.description;
    if (params.date) {
      patch.start = { date: toDateStr(params.date) };
      patch.end = { date: nextDay(params.date) };
    }
    await cal.events.patch({ calendarId: "primary", eventId, requestBody: patch });
  } catch {
    // Silently fail — calendar is optional
  }
}

export async function deleteTaskEvent(userId: string, eventId: string): Promise<void> {
  try {
    const cal = await getCalendar(userId);
    if (!cal) return;
    await cal.events.delete({ calendarId: "primary", eventId });
  } catch {
    // Silently fail
  }
}
