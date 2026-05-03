import { Router } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import {
  projectsTable,
  tasksTable,
  commitsTable,
} from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { eventBus } from "../lib/eventBus.js";

const router = Router();

// GET /projects/:projectId/github-config — fetch GitHub integration settings
router.get("/projects/:projectId/github-config", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }
  const p = projects[0];
  res.json({ githubRepo: p.githubRepo ?? "", githubWebhookSecret: p.githubWebhookSecret ?? "", slug: p.slug });
});

// PATCH /projects/:projectId/github-config — save repo URL, generate secret if needed
router.patch("/projects/:projectId/github-config", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const { githubRepo } = req.body as { githubRepo?: string };

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (projects.length === 0) { res.status(404).json({ error: "Project not found" }); return; }

  const existing = projects[0];
  const secret = existing.githubWebhookSecret || randomUUID().replace(/-/g, "");

  await db.update(projectsTable)
    .set({ githubRepo: githubRepo ?? existing.githubRepo, githubWebhookSecret: secret, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));

  res.json({ githubRepo: githubRepo ?? existing.githubRepo, githubWebhookSecret: secret });
});

// POST /github/webhook — receives push events from GitHub
router.post("/github/webhook", async (req, res): Promise<void> => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = req.body as Buffer;

  if (!signature || !rawBody) { res.status(400).json({ error: "Missing signature or body" }); return; }

  // Try to find which project this webhook belongs to by trying all secrets
  const projects = await db.select().from(projectsTable).where(isNull(projectsTable.deletedAt));
  let matchedProject: typeof projects[0] | null = null;

  for (const project of projects) {
    if (!project.githubWebhookSecret) continue;
    const expected = "sha256=" + createHmac("sha256", project.githubWebhookSecret)
      .update(rawBody)
      .digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        matchedProject = project;
        break;
      }
    } catch { continue; }
  }

  if (!matchedProject) { res.status(401).json({ error: "Invalid signature" }); return; }

  const event = req.headers["x-github-event"] as string;
  if (event !== "push") { res.json({ message: "ignored" }); return; }

  const payload = JSON.parse(rawBody.toString("utf-8")) as {
    commits?: { id: string; message: string; author: { name: string }; url: string; timestamp: string }[];
  };

  const commits = payload.commits ?? [];
  const slug = matchedProject.slug.toUpperCase();
  const keyPattern = new RegExp(`${slug}-([0-9]+)`, "gi");

  // Load all tasks for this project
  const tasks = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.projectId, matchedProject.id), isNull(tasksTable.deletedAt)));

  const taskMap = new Map(tasks.map((t) => [t.taskNumber, t]));
  const savedCommits: typeof commitsTable.$inferSelect[] = [];

  for (const commit of commits) {
    const matches = [...commit.message.matchAll(keyPattern)];
    for (const match of matches) {
      const taskNumber = parseInt(match[1], 10);
      const task = taskMap.get(taskNumber);
      if (!task) continue;

      const saved = await db.insert(commitsTable).values({
        id: randomUUID(),
        taskId: task.id,
        projectId: matchedProject.id,
        sha: commit.id.substring(0, 7),
        message: commit.message,
        author: commit.author.name,
        url: commit.url,
        pushedAt: new Date(commit.timestamp),
      }).returning();

      if (saved[0]) {
        savedCommits.push(saved[0]);
        eventBus.emit(`task:${task.id}:commit`, saved[0]);
      }
    }
  }

  res.json({ matched: savedCommits.length });
});

// GET /projects/:projectId/commits — list all commits for a project with task info
router.get("/projects/:projectId/commits", async (req, res): Promise<void> => {
  const { projectId } = req.params;
  const rows = await db
    .select({ commit: commitsTable, task: tasksTable })
    .from(commitsTable)
    .innerJoin(tasksTable, eq(commitsTable.taskId, tasksTable.id))
    .where(eq(commitsTable.projectId, projectId))
    .orderBy(commitsTable.pushedAt);
  res.json(
    rows.reverse().map((r) => ({
      ...r.commit,
      task: {
        id: r.task.id,
        title: r.task.title,
        taskNumber: r.task.taskNumber,
        status: r.task.status,
      },
    })),
  );
});

// GET /tasks/:taskId/commits — list all commits for a task
router.get("/tasks/:taskId/commits", async (req, res): Promise<void> => {
  const { taskId } = req.params;
  const rows = await db.select().from(commitsTable)
    .where(eq(commitsTable.taskId, taskId))
    .orderBy(commitsTable.pushedAt);
  res.json(rows.reverse());
});

// GET /tasks/:taskId/commit-events — SSE stream for real-time commits
router.get("/tasks/:taskId/commit-events", (req, res): void => {
  const { taskId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const listener = (commit: unknown) => {
    res.write(`data: ${JSON.stringify(commit)}\n\n`);
  };

  const channel = `task:${taskId}:commit`;
  eventBus.on(channel, listener);

  req.on("close", () => {
    eventBus.off(channel, listener);
  });
});

export default router;
