import { Router } from "express";
import { db } from "@workspace/db";
import {
  labelsTable,
  taskLabelsTable,
  tasksTable,
  projectsTable,
  workspaceMembersTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const router = Router();

async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(workspaceMembersTable)
    .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

router.get("/projects/:projectId/labels", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { projectId } = req.params;

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }

  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const labels = await db.select().from(labelsTable).where(eq(labelsTable.projectId, projectId));
  res.json(labels);
});

router.post("/projects/:projectId/labels", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { projectId } = req.params;
  const { name, color } = req.body;

  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }

  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const id = randomUUID();
  await db.insert(labelsTable).values({ id, name, color: color ?? "#6366f1", projectId });
  const rows = await db.select().from(labelsTable).where(eq(labelsTable.id, id)).limit(1);
  res.status(201).json(rows[0]);
});

router.delete("/labels/:labelId", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { labelId } = req.params;

  const labels = await db.select().from(labelsTable).where(eq(labelsTable.id, labelId)).limit(1);
  if (labels.length === 0) { res.status(404).json({ error: "Label not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, labels[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(labelsTable).where(eq(labelsTable.id, labelId));
  res.json({ ok: true });
});

router.get("/tasks/:taskId/labels", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId } = req.params;

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, tasks[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const rows = await db
    .select({ tl: taskLabelsTable, l: labelsTable })
    .from(taskLabelsTable)
    .innerJoin(labelsTable, eq(taskLabelsTable.labelId, labelsTable.id))
    .where(eq(taskLabelsTable.taskId, taskId));

  res.json(rows.map((r) => r.l));
});

router.post("/tasks/:taskId/labels", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId } = req.params;
  const { labelId } = req.body;

  if (!labelId) { res.status(400).json({ error: "labelId is required" }); return; }

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, tasks[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  const existing = await db
    .select()
    .from(taskLabelsTable)
    .where(and(eq(taskLabelsTable.taskId, taskId), eq(taskLabelsTable.labelId, labelId)))
    .limit(1);

  if (existing.length > 0) { res.status(409).json({ error: "Label already applied" }); return; }

  const id = randomUUID();
  await db.insert(taskLabelsTable).values({ id, taskId, labelId });

  const label = await db.select().from(labelsTable).where(eq(labelsTable.id, labelId)).limit(1);
  res.status(201).json(label[0]);
});

router.delete("/tasks/:taskId/labels/:labelId", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const { taskId, labelId } = req.params;

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
  if (tasks.length === 0) { res.status(404).json({ error: "Task not found" }); return; }

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, tasks[0].projectId)).limit(1);
  const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
  if (!membership) { res.status(403).json({ error: "Forbidden" }); return; }

  await db
    .delete(taskLabelsTable)
    .where(and(eq(taskLabelsTable.taskId, taskId), eq(taskLabelsTable.labelId, labelId)));
  res.json({ ok: true });
});

export default router;
