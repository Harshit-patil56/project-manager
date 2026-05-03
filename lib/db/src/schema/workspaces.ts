import { pgEnum, pgTable, text, timestamp, json, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const workspaceRoleEnum = pgEnum("workspace_role", ["ADMIN", "MEMBER"]);

export const workspacesTable = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  settings: json("settings").notNull().default({}),
  ownerId: text("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const workspaceMembersTable = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    message: text("message").notNull().default(""),
    role: workspaceRoleEnum("role").notNull().default("MEMBER"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("workspace_members_user_workspace_unique").on(t.userId, t.workspaceId)],
);

export const insertWorkspaceSchema = createInsertSchema(workspacesTable);
export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembersTable);
export const selectWorkspaceSchema = createSelectSchema(workspacesTable);
export const selectWorkspaceMemberSchema = createSelectSchema(workspaceMembersTable);

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
export type Workspace = typeof workspacesTable.$inferSelect;
export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;
