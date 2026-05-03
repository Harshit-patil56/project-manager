import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable, tasksTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/notifications", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const rows = await db
    .select({ n: notificationsTable, t: tasksTable })
    .from(notificationsTable)
    .leftJoin(tasksTable, eq(notificationsTable.taskId, tasksTable.id))
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(
    rows.map((r) => ({
      id: r.n.id,
      type: r.n.type,
      title: r.n.title,
      body: r.n.body,
      taskId: r.n.taskId,
      taskTitle: r.t?.title ?? null,
      read: r.n.read,
      createdAt: r.n.createdAt,
    })),
  );
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

export default router;
