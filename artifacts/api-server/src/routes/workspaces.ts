import { Router } from "express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { workspacesTable, workspaceMembersTable, usersTable } from "@workspace/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { authenticate, requireWorkspaceMember, type AuthedRequest } from "../middleware/auth.js";
import { createNotification } from "../lib/notifications.js";

const router = Router();

router.get("/workspaces/sync", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    res.status(403).json({ error: "Only available in development" });
    return;
  }

  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    
    // 1. Fetch users
    const users = await clerk.users.getUserList();
    for (const user of users.data) {
      const email = user.emailAddresses[0]?.emailAddress ?? "";
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email || "Unknown";
      await db
        .insert(usersTable)
        .values({
          id: user.id,
          name,
          email,
          image: user.imageUrl,
          updatedAt: new Date(user.updatedAt),
        })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { name, email, image: user.imageUrl, updatedAt: new Date() },
        });
    }

    // 2. Fetch orgs
    const orgs = await clerk.organizations.getOrganizationList();
    for (const org of orgs.data) {
      await db
        .insert(workspacesTable)
        .values({
          id: org.id,
          name: org.name,
          slug: org.slug || org.id,
          imageUrl: org.imageUrl,
          ownerId: org.createdBy || "",
          settings: {},
          updatedAt: new Date(org.updatedAt),
        })
        .onConflictDoUpdate({
          target: workspacesTable.id,
          set: { name: org.name, slug: org.slug || org.id, imageUrl: org.imageUrl, updatedAt: new Date() },
        });

      // 3. Memberships
      const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: org.id });
      for (const mem of memberships.data) {
        const role = mem.role === "org:admin" ? "ADMIN" : "MEMBER";
        await db
          .insert(workspaceMembersTable)
          .values({
            id: mem.id,
            userId: mem.publicUserData?.userId || "",
            workspaceId: org.id,
            role,
          })
          .onConflictDoNothing();
      }
    }

    res.json({ message: "Sync complete", organizations: orgs.data.length });
  } catch (err) {
    console.error("Sync failed:", err);
    res.status(500).json({ error: "Sync failed", detail: String(err) });
  }
});

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
    .where(and(inArray(workspacesTable.id, workspaceIds), isNull(workspacesTable.deletedAt)));

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
        redirectUrl: req.headers.origin ? `${req.headers.origin}/` : "http://localhost:25075/",
      });

      // Notify the user if they already exist in our database
      const invitedUsers = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, emailAddress))
        .limit(1);

      if (invitedUsers.length > 0) {
        const ws = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
        const wsName = ws.length > 0 ? ws[0].name : "a workspace";
        
        await createNotification({
          userId: invitedUsers[0].id,
          type: "WORKSPACE_INVITE",
          title: "Workspace Invitation",
          body: `You have been invited to join the ${wsName} workspace.`,
        });
      }

      res.json({ message: "Invitation sent" });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[]; message?: string };
      res.status(400).json({
        error: clerkErr.errors?.[0]?.message || clerkErr.message || "Failed to send invitation",
      });
    }
  },
);

router.delete(
  "/workspaces/:workspaceId",
  authenticate,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const { workspaceId } = req.params;

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, workspaceId)))
      .limit(1);

    if (!membership.length || membership[0].role !== "ADMIN") {
      res.status(403).json({ error: "Only admins can archive a workspace" });
      return;
    }

    await db.update(workspacesTable).set({ deletedAt: new Date() }).where(eq(workspacesTable.id, workspaceId));
    res.json({ message: "Workspace archived" });
  },
);

export default router;
