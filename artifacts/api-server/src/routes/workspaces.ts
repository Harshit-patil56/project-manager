import { Router } from "express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { workspacesTable, workspaceMembersTable, usersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { authenticate, requireWorkspaceMember, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/workspaces", authenticate, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const memberships = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId));

  if (memberships.length === 0) {
    res.json([]);
    return;
  }

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const workspaces = await db
    .select()
    .from(workspacesTable)
    .where(inArray(workspacesTable.id, workspaceIds));

  res.json(workspaces);
});

router.get(
  "/workspaces/:workspaceId",
  authenticate,
  requireWorkspaceMember((r) => r.params.workspaceId),
  async (req, res): Promise<void> => {
    const { workspaceId } = req.params;

    const workspaces = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);

    if (workspaces.length === 0) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const members = await db
      .select({ wm: workspaceMembersTable, user: usersTable })
      .from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(eq(workspaceMembersTable.workspaceId, workspaceId));

    res.json({
      ...workspaces[0],
      members: members.map((r) => ({
        id: r.wm.id,
        userId: r.wm.userId,
        workspaceId: r.wm.workspaceId,
        role: r.wm.role,
        message: r.wm.message,
        createdAt: r.wm.createdAt,
        user: r.user,
      })),
    });
  },
);

router.get(
  "/workspaces/:workspaceId/members",
  authenticate,
  requireWorkspaceMember((r) => r.params.workspaceId),
  async (req, res): Promise<void> => {
    const { workspaceId } = req.params;

    const members = await db
      .select({ wm: workspaceMembersTable, user: usersTable })
      .from(workspaceMembersTable)
      .innerJoin(usersTable, eq(workspaceMembersTable.userId, usersTable.id))
      .where(eq(workspaceMembersTable.workspaceId, workspaceId));

    res.json(
      members.map((r) => ({
        id: r.wm.id,
        userId: r.wm.userId,
        workspaceId: r.wm.workspaceId,
        role: r.wm.role,
        message: r.wm.message,
        createdAt: r.wm.createdAt,
        user: r.user,
      })),
    );
  },
);

router.post(
  "/workspaces/:workspaceId/invite",
  authenticate,
  requireWorkspaceMember((r) => r.params.workspaceId),
  async (req, res): Promise<void> => {
    const { workspaceId } = req.params;
    const { emailAddress, role } = req.body;

    if (!emailAddress) {
      res.status(400).json({ error: "emailAddress is required" });
      return;
    }

    try {
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      await clerk.organizations.createOrganizationInvitation({
        organizationId: workspaceId,
        emailAddress,
        role: role || "org:member",
        inviterUserId: (req as AuthedRequest).userId,
      });
      res.json({ message: "Invitation sent" });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[]; message?: string };
      res.status(400).json({
        error: clerkErr.errors?.[0]?.message || clerkErr.message || "Failed to send invitation",
      });
    }
  },
);

export default router;
