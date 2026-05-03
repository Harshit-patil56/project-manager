import { Router } from "express";
import { db } from "@workspace/db";
import { googleTokensTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import {
  isConfigured,
  getAuthUrl,
  verifyState,
  exchangeCode,
} from "../lib/googleCalendar.js";

const router = Router();

router.get("/auth/google", authenticate, (req, res): void => {
  const userId = (req as AuthedRequest).userId;
  if (!isConfigured()) {
    res.status(503).json({ error: "Google Calendar integration is not configured" });
    return;
  }
  const url = getAuthUrl(userId);
  res.json({ url });
});

router.get("/auth/google/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;

  const appBase = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : `https://${process.env.REPLIT_DEV_DOMAIN}`;

  if (error || !code || !state) {
    res.redirect(`${appBase}/integrations?google=error`);
    return;
  }

  const userId = verifyState(state);
  if (!userId) {
    res.redirect(`${appBase}/integrations?google=error`);
    return;
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await exchangeCode(code);
    await db
      .insert(googleTokensTable)
      .values({ userId, accessToken, refreshToken, expiresAt })
      .onConflictDoUpdate({
        target: googleTokensTable.userId,
        set: { accessToken, refreshToken, expiresAt },
      });
    res.redirect(`${appBase}/integrations?google=connected`);
  } catch {
    res.redirect(`${appBase}/integrations?google=error`);
  }
});

router.get("/auth/google/status", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const rows = await db
    .select({ userId: googleTokensTable.userId })
    .from(googleTokensTable)
    .where(eq(googleTokensTable.userId, userId))
    .limit(1);
  res.json({ connected: rows.length > 0, configured: isConfigured() });
});

router.delete("/auth/google/disconnect", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await db.delete(googleTokensTable).where(eq(googleTokensTable.userId, userId));
  res.json({ message: "Disconnected" });
});

export default router;
