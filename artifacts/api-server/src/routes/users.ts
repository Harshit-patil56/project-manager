import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  tasksTable,
  projectsTable,
  projectMembersTable,
  workspaceMembersTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/users/me", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(users[0]);
});

router.get("/users/me/tasks", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.assigneeId, userId));

  if (tasks.length === 0) {
    res.json([]);
    return;
  }

  const projectIds = [...new Set(tasks.map((t) => t.projectId))];
  const projects = await db
    .select()
    .from(projectsTable)
    .where(inArray(projectsTable.id, projectIds));

  const projectMembersRows = await Promise.all(
    projectIds.map((pid) =>
      db
        .select({ pm: projectMembersTable, user: usersTable })
        .from(projectMembersTable)
        .innerJoin(usersTable, eq(projectMembersTable.userId, usersTable.id))
        .where(eq(projectMembersTable.projectId, pid)),
    ),
  );

  const projectMap = new Map(
    projects.map((p, i) => [
      p.id,
      {
        ...p,
        members: projectMembersRows[i].map((r) => ({
          id: r.pm.id,
          userId: r.pm.userId,
          projectId: r.pm.projectId,
          createdAt: r.pm.createdAt,
          user: r.user,
        })),
        tasks: [],
      },
    ]),
  );

  const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId))];
  const assignees = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, assigneeIds));
  const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

  const result = tasks.map((t) => ({
    ...t,
    assignee: assigneeMap.get(t.assigneeId)!,
    comments: [],
    project: projectMap.get(t.projectId)!,
  }));

  res.json(result);
});

export default router;
