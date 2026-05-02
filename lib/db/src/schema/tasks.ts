import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("TODO"),
  type: taskTypeEnum("type").notNull().default("TASK"),
  priority: text("priority").notNull().default("MEDIUM"),
  assigneeId: text("assignee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dueDate: timestamp("due_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable);
export const selectTaskSchema = createSelectSchema(tasksTable);
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
