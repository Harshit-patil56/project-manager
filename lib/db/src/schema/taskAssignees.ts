import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";
import { usersTable } from "./users";

export const taskAssigneesTable = pgTable(
  "task_assignees",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("task_assignees_task_user_unique").on(t.taskId, t.userId)],
);

export const insertTaskAssigneeSchema = createInsertSchema(taskAssigneesTable);
export const selectTaskAssigneeSchema = createSelectSchema(taskAssigneesTable);
export type InsertTaskAssignee = z.infer<typeof insertTaskAssigneeSchema>;
export type TaskAssignee = typeof taskAssigneesTable.$inferSelect;
