import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  projectsTable,
  usersTable,
  workspaceMembersTable,
} from "@workspace/db/schema";
import { eq, and, inArray, ilike, isNull, or } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/search", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const q = ((req.query.q as string) ?? "").trim();

  if (!q) {
    res.json({ tasks: [], projects: [], members: [] });
    return;
  }

  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  if (memberships.length === 0) {
    res.json({ tasks: [], projects: [], members: [] });
    return;
  }

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const pattern = `%${q}%`;

  const [projects, allProjectIds, members] = await Promise.all([
    db
      .select()
      .from(projectsTable)
      .where(
        and(
          inArray(projectsTable.workspaceId, workspaceIds),
          isNull(projectsTable.deletedAt),
          or(ilike(projectsTable.name, pattern), ilike(projectsTable.description ?? "", pattern)),
        ),
      )
      .limit(5),
    db
      .select({ id: projectsTable.id, name: projectsTable.name, slug: projectsTable.slug })
      .from(projectsTable)
      .where(and(inArray(projectsTable.workspaceId, workspaceIds), isNull(projectsTable.deletedAt))),
    db
      .select({ wm: workspaceMembersTable, user: usersTable })
      .from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(
        and(
          inArray(workspaceMembersTable.workspaceId, workspaceIds),
          or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern)),
        ),
      )
      .limit(5),
  ]);

  const projectMap = new Map(allProjectIds.map((p) => [p.id, p]));
  const projectIds = allProjectIds.map((p) => p.id);

  const tasks =
    projectIds.length > 0
      ? await db
          .select({ t: tasksTable, u: usersTable })
          .from(tasksTable)
          .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
          .where(
            and(
              inArray(tasksTable.projectId, projectIds),
              isNull(tasksTable.deletedAt),
              or(ilike(tasksTable.title, pattern), ilike(tasksTable.description ?? "", pattern)),
            ),
          )
          .limit(5)
      : [];

  res.json({
    tasks: tasks.map((r) => ({
      id: r.t.id,
      title: r.t.title,
      status: r.t.status,
      priority: r.t.priority,
      projectId: r.t.projectId,
      taskNumber: r.t.taskNumber,
      projectName: projectMap.get(r.t.projectId)?.name ?? "",
      projectSlug: projectMap.get(r.t.projectId)?.slug ?? "",
      assignee: r.u ?? null,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      workspaceId: p.workspaceId,
    })),
    members: members.map((r) => ({
      id: r.wm.userId,
      name: r.user.name,
      email: r.user.email,
      image: r.user.image,
      role: r.wm.role,
    })),
  });
});

export default router;
