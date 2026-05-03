import { Router } from "express";
import { db } from "@workspace/db";
import {
  taskAssigneesTable,
  tasksTable,
  projectsTable,
  workspaceMembersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";
import { createNotification } from "../lib/notifications.js";

const router = Router();

async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

router.get("/tasks/:taskId/assignees", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId } = req.params;

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, tasks[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db
    .select({ ta: taskAssigneesTable, user: usersTable })
    .from(taskAssigneesTable)
    .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
    .where(eq(taskAssigneesTable.taskId, taskId));

  res.json(rows.map((r) => r.user));
});

router.post("/tasks/:taskId/assignees", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId } = req.params;
  const { userId: targetUserId } = req.body;

  if (!targetUserId) { res.status(400).json({ error: "userId is required" }); return; }

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }
  const task = tasks[0];

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, task.projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const existing = await db
    .select()
    .from(taskAssigneesTable)
    .where(and(eq(taskAssigneesTable.taskId, taskId), eq(taskAssigneesTable.userId, targetUserId)))
    .limit(1);
  if (existing.length > 0) { res.status(409).json({ error: "User already assigned" }); return; }

  const count = await db.select().from(taskAssigneesTable).where(eq(taskAssigneesTable.taskId, taskId));
  if (count.length >= 5) { res.status(400).json({ error: "Maximum 5 assignees allowed" }); return; }

  await db.insert(taskAssigneesTable).values({ id: randomUUID(), taskId, userId: targetUserId });

  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId)).limit(1);
  const assignedUser = userRows[0];

  if (targetUserId !== userId && assignedUser) {
    await createNotification({
      userId: targetUserId,
      type: "TASK_ASSIGNED",
      title: `You were assigned to "${task.title}"`,
      body: `Assigned by another team member`,
      taskId,
    });
  }

  res.status(201).json(assignedUser);
});

router.delete("/tasks/:taskId/assignees/:targetUserId", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId, targetUserId } = req.params;

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, tasks[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .delete(taskAssigneesTable)
    .where(and(eq(taskAssigneesTable.taskId, taskId), eq(taskAssigneesTable.userId, targetUserId)));
  res.json({ ok: true });
});

export default router;
