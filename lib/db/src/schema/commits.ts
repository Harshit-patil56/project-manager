import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";
import { projectsTable } from "./projects";

export const commitsTable = pgTable("commits", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sha: text("sha").notNull(),
  message: text("message").notNull(),
  author: text("author").notNull(),
  url: text("url").notNull(),
  branch: text("branch"),
  pushedAt: timestamp("pushed_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommitSchema = createInsertSchema(commitsTable);
export const selectCommitSchema = createSelectSchema(commitsTable);
export type InsertCommit = z.infer<typeof insertCommitSchema>;
export type Commit = typeof commitsTable.$inferSelect;
