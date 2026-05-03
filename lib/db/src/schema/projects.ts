import { pgEnum, pgTable, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

export const projectStatusEnum = pgEnum("project_status", [
  "ACTIVE",
  "PLANNING",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
]);

export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH"]);

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priority: priorityEnum("priority").notNull().default("MEDIUM"),
  status: projectStatusEnum("status").notNull().default("ACTIVE"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  teamLead: text("team_lead").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  workspaceId: text("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  slug: text("slug").notNull().default(""),
  githubRepo: text("github_repo"),
  githubWebhookSecret: text("github_webhook_secret"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const projectMembersTable = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("project_members_user_project_unique").on(t.userId, t.projectId)],
);

export const insertProjectSchema = createInsertSchema(projectsTable);
export const insertProjectMemberSchema = createInsertSchema(projectMembersTable);
export const selectProjectSchema = createSelectSchema(projectsTable);
export const selectProjectMemberSchema = createSelectSchema(projectMembersTable);

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectMember = typeof projectMembersTable.$inferSelect;
