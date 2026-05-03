import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { tasksTable } from "./tasks";

export const labelsTable = pgTable(
  "labels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#6366f1"),
    projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("labels_name_project_unique").on(t.name, t.projectId)],
);

export const taskLabelsTable = pgTable(
  "task_labels",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
    labelId: text("label_id").notNull().references(() => labelsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("task_labels_task_label_unique").on(t.taskId, t.labelId)],
);

export const insertLabelSchema = createInsertSchema(labelsTable);
export const insertTaskLabelSchema = createInsertSchema(taskLabelsTable);
export const selectLabelSchema = createSelectSchema(labelsTable);
export type InsertLabel = z.infer<typeof insertLabelSchema>;
export type Label = typeof labelsTable.$inferSelect;
export type TaskLabel = typeof taskLabelsTable.$inferSelect;
