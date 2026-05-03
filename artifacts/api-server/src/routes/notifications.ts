import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, tasksTable, projectsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { registerPushFunction } from "../lib/notifications.js";

const router = Router();

router.get("/notifications", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || 15;

  const rows = await db
    .select({ n: notificationsTable, t: tasksTable, p: projectsTable })
    .from(notificationsTable)
    .leftJoin(tasksTable, eq(notificationsTable.taskId, tasksTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .offset(offset)
    .limit(limit);

  const totalRows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId));

  res.json({
    notifications: rows.map((r) => ({
      id: r.n.id,
      type: r.n.type,
      title: r.n.title,
      body: r.n.body,
      taskId: r.n.taskId,
      taskTitle: r.t?.title ?? null,
      projectId: r.p?.id ?? null,
      read: r.n.read,
      createdAt: r.n.createdAt,
    })),
    total: totalRows.length,
    hasMore: offset + limit < totalRows.length,
  });
});

router.patch("/notifications/read-all", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  res.json({ ok: true });
});

router.patch("/notifications/:notificationId/read", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { notificationId } = req.params;

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, notificationId));
  res.json({ ok: true });
});

// SSE endpoint for real-time notifications
// Uses ?token= query param because browser EventSource cannot send custom headers
const subscribers: Map<string, (data: any) => void> = new Map();

router.get("/notifications/events", async (req, res): Promise<void> => {
  // Accept token from either Authorization header or ?token= query param
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const queryToken = req.query.token as string | undefined;
  const token = headerToken || queryToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Verify token
  let userId: string;
  try {
    const { verifyToken } = await import("@clerk/backend");
    const secretKey = process.env.CLERK_SECRET_KEY!;
    const payload = await verifyToken(token, { secretKey });
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send a heartbeat immediately so the client knows it's connected
  res.write(`:ok\n\n`);

  subscribers.set(userId, send);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers.delete(userId);
    res.end();
  });
});

// Helper to push notifications to subscribers
function pushNotificationToUser(userId: string, notification: any) {
  const send = subscribers.get(userId);
  if (send) {
    send(notification);
  }
}

// Register push function for notifications library
registerPushFunction(pushNotificationToUser);

export default router;
