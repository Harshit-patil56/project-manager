import { pgEnum, pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const taskStatusEnum = pgEnum("task_status", ["TODO", "IN_PROGRESS", "DONE"]);

export const taskTypeEnum = pgEnum("task_type", [
  "TASK",
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "OTHER",
]);

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  taskNumber: integer("task_number").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("TODO"),
  type: taskTypeEnum("type").notNull().default("TASK"),
  priority: text("priority").notNull().default("MEDIUM"),
  assigneeId: text("assignee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date").notNull(),
  calendarStartEventId: text("calendar_start_event_id"),
  calendarDueEventId: text("calendar_due_event_id"),
  estimatedMinutes: integer("estimated_minutes"),
  loggedMinutes: integer("logged_minutes").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertTaskSchema = createInsertSchema(tasksTable);
export const selectTaskSchema = createSelectSchema(tasksTable);
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
