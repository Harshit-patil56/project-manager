import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";

export async function createNotification({
  userId,
  type,
  title,
  body,
  taskId,
}: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  taskId?: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      id: randomUUID(),
      userId,
      type,
      title,
      body: body ?? null,
      taskId: taskId ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}
