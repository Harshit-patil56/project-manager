import { Router } from "express";
import { db } from "@workspace/db";
import {
  workspacesTable,
  workspaceMembersTable,
  projectsTable,
  tasksTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, inArray, isNotNull, isNull } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/trash", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId, role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  const workspaceIds = memberships.map((m) => m.workspaceId);

  if (workspaceIds.length === 0) {
    res.json({ workspaces: [], projects: [], tasks: [] });
    return;
  }

  const [deletedWorkspaces, deletedProjects, activeProjects] = await Promise.all([
    db
      .select()
      .from(workspacesTable)
      .where(and(inArray(workspacesTable.id, workspaceIds), isNotNull(workspacesTable.deletedAt))),
    db
      .select()
      .from(projectsTable)
      .where(and(inArray(projectsTable.workspaceId, workspaceIds), isNotNull(projectsTable.deletedAt))),
    db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(inArray(projectsTable.workspaceId, workspaceIds), isNull(projectsTable.deletedAt))),
  ]);

  const activeProjectIds = activeProjects.map((p) => p.id);

  const deletedTasks =
    activeProjectIds.length > 0
      ? await db
          .select({ t: tasksTable, assignee: usersTable })
          .from(tasksTable)
          .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(and(inArray(tasksTable.projectId, activeProjectIds), isNotNull(tasksTable.deletedAt)))
      : [];

  const membershipMap = new Map(memberships.map((m) => [m.workspaceId, m.role]));

  res.json({
    workspaces: deletedWorkspaces.map((ws) => ({
      ...ws,
      userRole: membershipMap.get(ws.id) ?? "MEMBER",
    })),
    projects: deletedProjects.map((p) => ({
      ...p,
      userRole: membershipMap.get(p.workspaceId) ?? "MEMBER",
    })),
    tasks: deletedTasks.map((r) => ({
      ...r.t,
      assignee: r.assignee ?? null,
    })),
  });
});

router.post(
  "/workspaces/:workspaceId/restore",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { workspaceId } = req.params;

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)))
      .limit(1);

    if (!membership.length || membership[0].role !== "ADMIN") {
      res.status(403).json({ error: "Only admins can restore a workspace" });
      return;
    }

    const [ws] = await db
      .update(workspacesTable)
      .set({ deletedAt: null })
      .where(eq(workspacesTable.id, workspaceId))
      .returning();

    res.json(ws);
  },
);

router.post(
  "/projects/:projectId/restore",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { projectId } = req.params;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (!projects.length) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, projects[0].workspaceId)))
      .limit(1);

    if (!membership.length) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [restored] = await db
      .update(projectsTable)
      .set({ deletedAt: null })
      .where(eq(projectsTable.id, projectId))
      .returning();

    res.json(restored);
  },
);

router.post(
  "/tasks/:taskId/restore",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { taskId } = req.params;

    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId)).limit(1);
    if (!tasks.length) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, tasks[0].projectId))
      .limit(1);

    if (!projects.length) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, projects[0].workspaceId)))
      .limit(1);

    if (!membership.length) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [restored] = await db
      .update(tasksTable)
      .set({ deletedAt: null })
      .where(eq(tasksTable.id, taskId))
      .returning();

    res.json(restored);
  },
);

export default router;
