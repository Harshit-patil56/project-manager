import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tasksTable } from "./tasks";

export const commentsTable = pgTable("comments", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable);
export const selectCommentSchema = createSelectSchema(commentsTable);
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
