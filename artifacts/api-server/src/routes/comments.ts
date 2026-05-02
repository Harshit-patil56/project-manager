import { Router } from "express";
import { db } from "@workspace/db";
import {
  commentsTable,
  tasksTable,
  projectsTable,
  workspaceMembersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";

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
