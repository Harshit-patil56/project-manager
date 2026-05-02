import { Router } from "express";
import { Webhook } from "svix";
import { db } from "@workspace/db";
import {
  usersTable,
  workspacesTable,
  workspaceMembersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

if (!process.env.CLERK_WEBHOOK_SECRET) {
  throw new Error("CLERK_WEBHOOK_SECRET must be set");
}

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

router.post("/webhooks/clerk", async (req: Request, res: Response): Promise<void> => {
  const svixId = req.headers["svix-id"] as string;
  const svixTimestamp = req.headers["svix-timestamp"] as string;
  const svixSignature = req.headers["svix-signature"] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: "Missing svix headers" });
    return;
  }

  const wh = new Webhook(webhookSecret);
  let event: { type: string; data: Record<string, unknown> };

  try {
    // express.raw() gives us a Buffer; convert to string for svix verification
    const payload = Buffer.isBuffer(req.body)
      ? req.body.toString("utf-8")
      : JSON.stringify(req.body);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  const { type, data } = event;

  try {
    if (type === "user.created" || type === "user.updated") {
      const d = data as {
        id: string;
        first_name?: string;
        last_name?: string;
        email_addresses?: { email_address: string }[];
        image_url?: string;
        created_at?: number;
        updated_at?: number;
      };
      const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || "Unknown";
      const email = d.email_addresses?.[0]?.email_address ?? "";
      await db
        .insert(usersTable)
        .values({
          id: d.id,
          name,
          email,
          image: d.image_url ?? "",
          createdAt: d.created_at ? new Date(d.created_at) : new Date(),
          updatedAt: d.updated_at ? new Date(d.updated_at) : new Date(),
        })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: { name, email, image: d.image_url ?? "", updatedAt: new Date() },
        });
    }

    if (type === "user.deleted") {
      const d = data as { id: string };
      await db.delete(usersTable).where(eq(usersTable.id, d.id));
    }

    if (type === "organization.created" || type === "organization.updated") {
      const d = data as {
        id: string;
        name: string;
        slug: string;
        image_url?: string;
        created_by?: string;
        created_at?: number;
        updated_at?: number;
      };
      await db
        .insert(workspacesTable)
        .values({
          id: d.id,
          name: d.name,
          slug: d.slug ?? d.id,
          imageUrl: d.image_url ?? "",
          ownerId: d.created_by ?? "",
          settings: {},
          createdAt: d.created_at ? new Date(d.created_at) : new Date(),
          updatedAt: d.updated_at ? new Date(d.updated_at) : new Date(),
        })
        .onConflictDoUpdate({
          target: workspacesTable.id,
          set: {
            name: d.name,
            slug: d.slug ?? d.id,
            imageUrl: d.image_url ?? "",
            updatedAt: new Date(),
          },
        });
    }

    if (type === "organization.deleted") {
      const d = data as { id: string };
      await db.delete(workspacesTable).where(eq(workspacesTable.id, d.id));
    }

    if (type === "organizationMembership.created") {
      const d = data as {
        id: string;
        organization: { id: string };
        public_user_data: { user_id: string };
        role: string;
      };
      const role = d.role === "org:admin" ? "ADMIN" : "MEMBER";
      await db
        .insert(workspaceMembersTable)
        .values({
          id: d.id,
          userId: d.public_user_data.user_id,
          workspaceId: d.organization.id,
          role,
          message: "",
        })
        .onConflictDoNothing();
    }

    if (type === "organizationMembership.deleted") {
      const d = data as {
        organization: { id: string };
        public_user_data: { user_id: string };
      };
      await db
        .delete(workspaceMembersTable)
        .where(
          and(
            eq(workspaceMembersTable.userId, d.public_user_data.user_id),
            eq(workspaceMembersTable.workspaceId, d.organization.id),
          ),
        );
    }

    res.json({ message: "ok" });
  } catch (err) {
    req.log.error(err, "Webhook processing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
