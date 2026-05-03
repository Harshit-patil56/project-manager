import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  projectMembersTable,
  workspaceMembersTable,
  usersTable,
  tasksTable,
  commentsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { authenticate, requireWorkspaceMember, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";

const router = Router();

router.get(
  "/workspaces/:workspaceId/projects",
  authenticate,
  requireWorkspaceMember((r) => r.params.workspaceId),
  async (req, res): Promise<void> => {
    const { workspaceId } = req.params;
    const projects = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.workspaceId, workspaceId), isNull(projectsTable.deletedAt)));

    const result = await Promise.all(
      projects.map(async (p) => {
        const members = await db
          .select({ pm: projectMembersTable, user: usersTable })
          .from(projectMembersTable)
          .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
          .where(eq(projectMembersTable.projectId, p.id));
        return {
          ...p,
          members: members.map((r) => ({
            id: r.pm.id,
            userId: r.pm.userId,
            projectId: r.pm.projectId,
            createdAt: r.pm.createdAt,
            user: r.user,
          })),
        };
      }),
    );
    res.json(result);
  },
);

router.post(
  "/workspaces/:workspaceId/projects",
  authenticate,
  requireWorkspaceMember((r) => r.params.workspaceId),
  async (req, res): Promise<void> => {
    const { workspaceId } = req.params;
    const userId = (req as AuthedRequest).userId;
    const { name, description, priority, status, startDate, endDate } = req.body;

    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const projectId = randomUUID();
    const [project] = await db
      .insert(projectsTable)
      .values({
        id: projectId,
        name,
        description,
        priority: priority ?? "MEDIUM",
        status: status ?? "PLANNING",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        teamLead: userId,
        workspaceId,
        progress: 0,
      })
      .returning();

    await db.insert(projectMembersTable).values({
      id: randomUUID(),
      userId,
      projectId,
    });

    const members = await db
      .select({ pm: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(eq(projectMembersTable.projectId, projectId));

    res.status(201).json({
      ...project,
      members: members.map((r) => ({
        id: r.pm.id,
        userId: r.pm.userId,
        projectId: r.pm.projectId,
        createdAt: r.pm.createdAt,
        user: r.user,
      })),
    });
  },
);

router.get(
  "/projects/:projectId",
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
    const project = projects[0];

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, project.workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const members = await db
      .select({ pm: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(eq(projectMembersTable.projectId, projectId));

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

    const commentsByTask = new Map<string, (typeof allComments)[0][]>();
    for (const row of allComments) {
      const list = commentsByTask.get(row.c.taskId) ?? [];
      list.push(row);
      commentsByTask.set(row.c.taskId, list);
    }

    res.json({
      ...project,
      members: members.map((r) => ({
        id: r.pm.id,
        userId: r.pm.userId,
        projectId: r.pm.projectId,
        createdAt: r.pm.createdAt,
        user: r.user,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        assignee: assigneeMap.get(t.assigneeId)!,
        comments: (commentsByTask.get(t.id) ?? []).map((r) => ({
          id: r.c.id,
          content: r.c.content,
          userId: r.c.userId,
          taskId: r.c.taskId,
          createdAt: r.c.createdAt,
          user: r.user,
        })),
      })),
    });
  },
);

router.patch(
  "/projects/:projectId",
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
    const project = projects[0];

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, project.workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const isAdmin = membership[0].role === "ADMIN";
    const isTeamLead = project.teamLead === userId;

    if (!isAdmin && !isTeamLead) {
      res.status(403).json({ error: "Only the team lead or an admin can update this project" });
      return;
    }

    const { name, description, priority, status, startDate, endDate, teamLead, progress } =
      req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (teamLead !== undefined) updateData.teamLead = teamLead;
    if (progress !== undefined) updateData.progress = Math.max(0, Math.min(100, Number(progress)));

    const [updated] = await db
      .update(projectsTable)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateData as any)
      .where(eq(projectsTable.id, projectId))
      .returning();

    const members = await db
      .select({ pm: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(eq(projectMembersTable.projectId, projectId));

    res.json({
      ...updated,
      members: members.map((r) => ({
        id: r.pm.id,
        userId: r.pm.userId,
        projectId: r.pm.projectId,
        createdAt: r.pm.createdAt,
        user: r.user,
      })),
    });
  },
);

router.delete(
  "/projects/:projectId",
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
    const project = projects[0];

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, project.workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.update(projectsTable).set({ deletedAt: new Date() }).where(eq(projectsTable.id, projectId));
    res.json({ message: "Project archived" });
  },
);

router.get(
  "/projects/:projectId/members",
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

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, projects[0].workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const members = await db
      .select({ pm: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(eq(projectMembersTable.projectId, projectId));

    res.json(
      members.map((r) => ({
        id: r.pm.id,
        userId: r.pm.userId,
        projectId: r.pm.projectId,
        createdAt: r.pm.createdAt,
        user: r.user,
      })),
    );
  },
);

router.post(
  "/projects/:projectId/members",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { projectId } = req.params;
    const { userId: targetUserId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (projects.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const project = projects[0];

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, project.workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (membership[0].role !== "ADMIN" && project.teamLead !== userId) {
      res.status(403).json({ error: "Only the team lead or an admin can add members" });
      return;
    }

    const id = randomUUID();
    await db
      .insert(projectMembersTable)
      .values({ id, userId: targetUserId, projectId })
      .onConflictDoNothing();

    const rows = await db
      .select({ pm: projectMembersTable, user: usersTable })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
      .where(and(eq(projectMembersTable.userId, targetUserId), eq(projectMembersTable.projectId, projectId)))
      .limit(1);

    res.status(201).json({
      id: rows[0].pm.id,
      userId: rows[0].pm.userId,
      projectId: rows[0].pm.projectId,
      createdAt: rows[0].pm.createdAt,
      user: rows[0].user,
    });
  },
);

router.delete(
  "/projects/:projectId/members/:userId",
  authenticate,
  async (req, res): Promise<void> => {
    const callerId = (req as AuthedRequest).userId;
    const { projectId, userId: targetUserId } = req.params;

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (projects.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const project = projects[0];

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, callerId),
          eq(workspaceMembersTable.workspaceId, project.workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (membership[0].role !== "ADMIN" && project.teamLead !== callerId) {
      res.status(403).json({ error: "Only the team lead or an admin can remove members" });
      return;
    }

    await db
      .delete(projectMembersTable)
      .where(
        and(
          eq(projectMembersTable.userId, targetUserId),
          eq(projectMembersTable.projectId, projectId),
        ),
      );

    res.json({ message: "Member removed" });
  },
);

export default router;
