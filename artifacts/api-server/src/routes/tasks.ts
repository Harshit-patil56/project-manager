import { Router } from "express";
import { db } from "@workspace/db";
import {
  tasksTable,
  projectsTable,
  workspaceMembersTable,
  usersTable,
  commentsTable,
  taskAssigneesTable,
} from "@workspace/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { randomUUID } from "crypto";
import {
  createTaskEvent,
  updateTaskEvent,
  deleteTaskEvent,
} from "../lib/googleCalendar.js";
import { createNotification } from "../lib/notifications.js";

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

function buildCalendarDescription(
  projectName: string,
  type: string,
  priority: string,
  status: string,
  description?: string | null,
): string {
  const lines = [
    `Project: ${projectName}`,
    `Type: ${type}`,
    `Priority: ${priority}`,
    `Status: ${status}`,
  ];
  if (description) lines.push(`\n${description}`);
  return lines.join("\n");
}

async function syncCalendarEvents(
  assigneeId: string,
  taskKey: string,
  title: string,
  description: string,
  startDate: Date | null | undefined,
  dueDate: Date,
  existingStartEventId?: string | null,
  existingDueEventId?: string | null,
): Promise<{ calendarStartEventId: string | null; calendarDueEventId: string | null }> {
  const params = { taskKey, title, description };

  // Handle start event
  let calendarStartEventId: string | null = existingStartEventId ?? null;
  if (startDate) {
    if (existingStartEventId) {
      await updateTaskEvent(assigneeId, existingStartEventId, {
        ...params,
        date: startDate,
        label: "starts",
      });
    } else {
      calendarStartEventId = await createTaskEvent(assigneeId, {
        ...params,
        date: startDate,
        label: "starts",
      });
    }
  } else if (existingStartEventId) {
    // start date removed — delete the event
    await deleteTaskEvent(assigneeId, existingStartEventId);
    calendarStartEventId = null;
  }

  // Handle due event
  let calendarDueEventId: string | null = existingDueEventId ?? null;
  if (existingDueEventId) {
    await updateTaskEvent(assigneeId, existingDueEventId, {
      ...params,
      date: dueDate,
      label: "due",
    });
  } else {
    calendarDueEventId = await createTaskEvent(assigneeId, {
      ...params,
      date: dueDate,
      label: "due",
    });
  }

  return { calendarStartEventId, calendarDueEventId };
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
      .where(and(eq(tasksTable.projectId, projectId), isNull(tasksTable.deletedAt)));

    const assigneeIds = [...new Set(tasks.map((t) => t.assigneeId))];
    const assignees =
      assigneeIds.length > 0
        ? await db.select().from(usersTable).where(inArray(usersTable.id, assigneeIds))
        : [];
    const assigneeMap = new Map(assignees.map((u) => [u.id, u]));

    const taskIds = tasks.map((t) => t.id);
    
    // Fetch extra assignees
    const extraAssigneeRows =
      taskIds.length > 0
        ? await db
            .select({ ta: taskAssigneesTable, user: usersTable })
            .from(taskAssigneesTable)
            .innerJoin(usersTable, eq(taskAssigneesTable.userId, usersTable.id))
            .where(inArray(taskAssigneesTable.taskId, taskIds))
        : [];
    
    const extraAssigneesByTask = new Map<string, typeof usersTable.$inferSelect[]>();
    for (const row of extraAssigneeRows) {
      const list = extraAssigneesByTask.get(row.ta.taskId) ?? [];
      list.push(row.user);
      extraAssigneesByTask.set(row.ta.taskId, list);
    }

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
        extraAssignees: extraAssigneesByTask.get(t.id) ?? [],
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

    const { title, description, status, type, priority, assigneeId, startDate, dueDate } =
      req.body;

    if (!title || !assigneeId || !dueDate) {
      res.status(400).json({ error: "title, assigneeId, and dueDate are required" });
      return;
    }

    const existingTasks = await db
      .select({ taskNumber: tasksTable.taskNumber })
      .from(tasksTable)
      .where(eq(tasksTable.projectId, projectId));
    const nextNumber =
      existingTasks.length > 0
        ? Math.max(...existingTasks.map((t) => t.taskNumber)) + 1
        : 1;

    const taskId = randomUUID();
    const parsedDueDate = new Date(dueDate);
    const parsedStartDate = startDate ? new Date(startDate) : null;
    const project = projects[0];

    await db.insert(tasksTable).values({
      id: taskId,
      projectId,
      taskNumber: nextNumber,
      title,
      description,
      status: status ?? "TODO",
      type: type ?? "TASK",
      priority: priority ?? "MEDIUM",
      assigneeId,
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
    });

    // Notify assignee if they didn't create the task
    if (assigneeId !== userId) {
      createNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: `You were assigned to "${title}"`,
        body: `In project "${project.name}"`,
        taskId,
      }).catch(() => {});
    }

    // Create calendar events for the assignee (fire-and-forget, non-blocking)
    const taskKey = `${project.slug.toUpperCase()}-${nextNumber}`;
    const calDesc = buildCalendarDescription(
      project.name,
      type ?? "TASK",
      priority ?? "MEDIUM",
      status ?? "TODO",
      description,
    );
    syncCalendarEvents(
      assigneeId,
      taskKey,
      title,
      calDesc,
      parsedStartDate,
      parsedDueDate,
    ).then(({ calendarStartEventId, calendarDueEventId }) => {
      if (calendarStartEventId || calendarDueEventId) {
        db.update(tasksTable)
          .set({ calendarStartEventId, calendarDueEventId })
          .where(eq(tasksTable.id, taskId))
          .catch(() => {});
      }
    }).catch(() => {});

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
      res
        .status(403)
        .json({ error: "Only the assignee, team lead, or admin can update this task" });
      return;
    }

    const {
      title,
      description,
      status,
      type,
      priority,
      assigneeId,
      startDate,
      dueDate,
      estimatedMinutes,
      loggedMinutes,
    } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (type !== undefined) updateData.type = type;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (startDate !== undefined)
      updateData.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = estimatedMinutes;
    if (loggedMinutes !== undefined) updateData.loggedMinutes = loggedMinutes;

    await db.update(tasksTable).set(updateData).where(eq(tasksTable.id, taskId));

    // Notifications for status/assignee changes
    const newAssigneeForNotif = assigneeId ?? task.assigneeId;
    if (status === "DONE" && task.status !== "DONE" && newAssigneeForNotif !== userId) {
      createNotification({
        userId: newAssigneeForNotif,
        type: "TASK_DONE",
        title: `"${task.title}" was marked Done`,
        body: `In project "${project.name}"`,
        taskId,
      }).catch(() => {});
    }
    if (assigneeId && assigneeId !== task.assigneeId && assigneeId !== userId) {
      createNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: `You were assigned to "${task.title}"`,
        body: `In project "${project.name}"`,
        taskId,
      }).catch(() => {});
    }

    // Sync calendar events if task is not DONE (done = delete events)
    const newStatus = status ?? task.status;
    const newAssigneeId = assigneeId ?? task.assigneeId;
    const newTitle = title ?? task.title;
    const newDescription = description !== undefined ? description : task.description;
    const newDueDate = dueDate ? new Date(dueDate) : task.dueDate;
    const newStartDate =
      startDate !== undefined
        ? startDate
          ? new Date(startDate)
          : null
        : task.startDate;

    const calendarRelatedChanged =
      title !== undefined ||
      description !== undefined ||
      assigneeId !== undefined ||
      startDate !== undefined ||
      dueDate !== undefined ||
      status !== undefined;

    if (calendarRelatedChanged) {
      if (newStatus === "DONE") {
        // Delete events when task is marked done
        if (task.calendarStartEventId) {
          deleteTaskEvent(task.assigneeId, task.calendarStartEventId).catch(() => {});
        }
        if (task.calendarDueEventId) {
          deleteTaskEvent(task.assigneeId, task.calendarDueEventId).catch(() => {});
        }
        db.update(tasksTable)
          .set({ calendarStartEventId: null, calendarDueEventId: null })
          .where(eq(tasksTable.id, taskId))
          .catch(() => {});
      } else {
        const taskKey = `${project.slug.toUpperCase()}-${task.taskNumber}`;
        const calDesc = buildCalendarDescription(
          project.name,
          type ?? task.type,
          priority ?? task.priority,
          newStatus,
          newDescription,
        );

        // If assignee changed, delete old events first
        if (assigneeId && assigneeId !== task.assigneeId) {
          if (task.calendarStartEventId) {
            deleteTaskEvent(task.assigneeId, task.calendarStartEventId).catch(() => {});
          }
          if (task.calendarDueEventId) {
            deleteTaskEvent(task.assigneeId, task.calendarDueEventId).catch(() => {});
          }
          // Create fresh events for new assignee
          syncCalendarEvents(
            newAssigneeId,
            taskKey,
            newTitle,
            calDesc,
            newStartDate,
            newDueDate,
          ).then(({ calendarStartEventId, calendarDueEventId }) => {
            db.update(tasksTable)
              .set({ calendarStartEventId, calendarDueEventId })
              .where(eq(tasksTable.id, taskId))
              .catch(() => {});
          }).catch(() => {});
        } else {
          // Update existing events
          syncCalendarEvents(
            newAssigneeId,
            taskKey,
            newTitle,
            calDesc,
            newStartDate,
            newDueDate,
            task.calendarStartEventId,
            task.calendarDueEventId,
          ).then(({ calendarStartEventId, calendarDueEventId }) => {
            db.update(tasksTable)
              .set({ calendarStartEventId, calendarDueEventId })
              .where(eq(tasksTable.id, taskId))
              .catch(() => {});
          }).catch(() => {});
        }
      }
    }

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

    // Delete calendar events
    if (task.calendarStartEventId) {
      deleteTaskEvent(task.assigneeId, task.calendarStartEventId).catch(() => {});
    }
    if (task.calendarDueEventId) {
      deleteTaskEvent(task.assigneeId, task.calendarDueEventId).catch(() => {});
    }

    await db.update(tasksTable).set({ deletedAt: new Date() }).where(eq(tasksTable.id, taskId));
    res.json({ message: "Task archived" });
  },
);

export default router;
