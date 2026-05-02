import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  projectsTable,
  workspaceMembersTable,
  usersTable,
  commentsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const router = Router();

async function getTaskWithComments(taskId: string) {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .limit(1);

  if (tasks.length === 0) return null;
  const task = tasks[0];

  const [assignees, commentRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId)),
    db
      .select({ c: commentsTable, user: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.taskId, taskId)),
  ]);

  return {
    ...task,
    assignee: assignees[0] ?? null,
    comments: commentRows.map((r) => ({
      id: r.c.id,
      content: r.c.content,
      userId: r.c.userId,
      taskId: r.c.taskId,
      createdAt: r.c.createdAt,
      user: r.user,
    })),
  };
}

async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.userId, userId),
        eq(workspaceMembersTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

router.get(
  "/projects/:projectId/tasks",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { projectId } = req.params;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (projects.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.projectId, projectId));

    const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId))];
    const assignees =
      assigneeIds.length > 0
        ? await db.select().from(usersTable).where(inArray(usersTable.id, assigneeIds))
        : [];
    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

    const taskIds = tasks.map((t) => t.id);
    const allComments =
      taskIds.length > 0
        ? await db
            .select({ c: commentsTable, user: usersTable })
            .from(commentsTable)
            .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
            .where(inArray(commentsTable.taskId, taskIds))
        : [];

    const commentsByTask = new Map<string, typeof allComments>();
    for (const row of allComments) {
      const list = commentsByTask.get(row.c.taskId) ?? [];
      list.push(row);
      commentsByTask.set(row.c.taskId, list);
    }

    res.json(
      tasks.map((t) => ({
        ...t,
        assignee: assigneeMap.get(t.assigneeId) ?? null,
        comments: (commentsByTask.get(t.id) ?? []).map((r) => ({
          id: r.c.id,
          content: r.c.content,
          userId: r.c.userId,
          taskId: r.c.taskId,
          createdAt: r.c.createdAt,
          user: r.user,
        })),
      })),
    );
  },
);

router.post(
  "/projects/:projectId/tasks",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { projectId } = req.params;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (projects.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { title, description, status, type, priority, assigneeId, dueDate } = req.body;

    if (!title || !assigneeId || !dueDate) {
      res.status(400).json({ error: "title, assigneeId, and dueDate are required" });
      return;
    }

    const taskId = randomUUID();
    await db.insert(tasksTable).values({
      id: taskId,
      projectId,
      title,
      description,
      status: status ?? "TODO",
      type: type ?? "TASK",
      priority: priority ?? "MEDIUM",
      assigneeId,
      dueDate: new Date(dueDate),
    });

    const task = await getTaskWithComments(taskId);
    res.status(201).json(task);
  },
);

router.get(
  "/tasks/:taskId",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { taskId } = req.params;

    const task = await getTaskWithComments(taskId);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, task.projectId))
      .limit(1);

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(task);
  },
);

router.patch(
  "/tasks/:taskId",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { taskId } = req.params;

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const task = tasks[0];

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, task.projectId))
      .limit(1);

    const project = projects[0];
    const membership = await getWorkspaceMembership(userId, project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const isAdmin = membership.role === "ADMIN";
    const isAssignee = task.assigneeId === userId;
    const isTeamLead = project.teamLead === userId;

    if (!isAdmin && !isAssignee && !isTeamLead) {
      res.status(403).json({ error: "Only the assignee, team lead, or admin can update this task" });
      return;
    }

    const { title, description, status, type, priority, assigneeId, dueDate } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (type !== undefined) updateData.type = type;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);

    await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, taskId));

    const updated = await getTaskWithComments(taskId);
    res.json(updated);
  },
);

router.delete(
  "/tasks/:taskId",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { taskId } = req.params;

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const task = tasks[0];

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, task.projectId))
      .limit(1);

    const project = projects[0];
    const membership = await getWorkspaceMembership(userId, project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (membership.role !== "ADMIN" && task.assigneeId !== userId && project.teamLead !== userId) {
      res.status(403).json({ error: "Only the assignee, team lead, or admin can delete this task" });
      return;
    }

    await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
    res.json({ message: "Task deleted" });
  },
);

export default router;
