import { db } from "@workspace/db";
import { notificationsTable, tasksTable, projectsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "./logger.js";
import { eq } from "drizzle-orm";

// Will be set by notifications route
let pushToSubscriber: ((userId: string, notification: any) => void) | null = null;

export function registerPushFunction(fn: (userId: string, notification: any) => void) {
  pushToSubscriber = fn;
}

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
    const notificationId = randomUUID();
    
    await db.insert(notificationsTable).values({
      id: notificationId,
      userId,
      type,
      title,
      body: body ?? null,
      taskId: taskId ?? null,
    });

    // Get task and project info for SSE push
    let projectId = null;
    if (taskId) {
      const taskRows = await db.select({ projectId: tasksTable.projectId }).from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
      if (taskRows.length > 0) {
        projectId = taskRows[0].projectId;
      }
    }

    // Push to subscriber if connected
    if (pushToSubscriber) {
      pushToSubscriber(userId, {
        id: notificationId,
        type,
        title,
        body: body ?? null,
        taskId: taskId ?? null,
        projectId,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}
