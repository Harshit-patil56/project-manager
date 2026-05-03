import { Router } from "express";
import { db } from "@workspace/db";
import {
  commentsTable,
  tasksTable,
  projectsTable,
  workspaceMembersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";
import { createNotification } from "../lib/notifications.js";

const router = Router();

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
  "/tasks/:taskId/comments",
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

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, tasks[0].projectId))
      .limit(1);

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const comments = await db
      .select({ c: commentsTable, user: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.taskId, taskId));

    res.json(
      comments.map((r) => ({
        id: r.c.id,
        content: r.c.content,
        userId: r.c.userId,
        taskId: r.c.taskId,
        createdAt: r.c.createdAt,
        user: r.user,
      })),
    );
  },
);

router.post(
  "/tasks/:taskId/comments",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

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

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const commentId = randomUUID();
    await db.insert(commentsTable).values({
      id: commentId,
      content,
      userId,
      taskId,
    });

    const rows = await db
      .select({ c: commentsTable, user: usersTable })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(eq(commentsTable.id, commentId))
      .limit(1);

    const commenter = rows[0].user;

    // Notify the task assignee if they're not the commenter
    if (task.assigneeId !== userId) {
      createNotification({
        userId: task.assigneeId,
        type: "COMMENT_ON_TASK",
        title: `New comment on "${task.title}"`,
        body: `${commenter.name ?? "Someone"}: ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`,
        taskId,
      }).catch(() => {});
    }

    // Parse @mentions and notify mentioned users
    const mentionPattern = /@([a-zA-Z0-9._-]+)/g;
    const mentions = [...content.matchAll(mentionPattern)].map((m) => m[1].toLowerCase());
    if (mentions.length > 0) {
      // Get all workspace members
      const members = await db
        .select({ wm: workspaceMembersTable, user: usersTable })
        .from(workspaceMembersTable)
        .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
        .where(eq(workspaceMembersTable.workspaceId, projects[0].workspaceId));

      for (const member of members) {
        const memberName = (member.user.name ?? "").toLowerCase().replace(/\s+/g, "");
        const memberEmail = (member.user.email ?? "").toLowerCase().split("@")[0];
        if (
          member.user.id !== userId &&
          member.user.id !== task.assigneeId && // already notified above
          (mentions.some((m) => memberName.includes(m) || m.includes(memberName) || memberEmail === m))
        ) {
          createNotification({
            userId: member.user.id,
            type: "MENTION",
            title: `${commenter.name ?? "Someone"} mentioned you`,
            body: `In "${task.title}": ${content.slice(0, 80)}${content.length > 80 ? "…" : ""}`,
            taskId,
          }).catch(() => {});
        }
      }
    }

    res.status(201).json({
      id: rows[0].c.id,
      content: rows[0].c.content,
      userId: rows[0].c.userId,
      taskId: rows[0].c.taskId,
      createdAt: rows[0].c.createdAt,
      user: rows[0].user,
    });
  },
);

router.delete(
  "/comments/:commentId",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { commentId } = req.params;

    const comments = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, commentId))
      .limit(1);

    if (comments.length === 0) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }
    const comment = comments[0];

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, comment.taskId))
      .limit(1);

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, tasks[0].projectId))
      .limit(1);

    const membership = await getWorkspaceMembership(userId, projects[0].workspaceId);
    if (!membership) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (membership.role !== "ADMIN" && comment.userId !== userId) {
      res.status(403).json({ error: "Only the author or an admin can delete this comment" });
      return;
    }

    await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
    res.json({ message: "Comment deleted" });
  },
);

export default router;
