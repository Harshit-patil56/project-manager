import { createClerkClient } from "@clerk/backend";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { workspaceMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY must be set");
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export interface AuthedRequest extends Request {
  userId: string;
  workspaceRole?: "ADMIN" | "MEMBER";
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = await clerk.verifyToken(token);
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireWorkspaceMember(getWorkspaceId: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const workspaceId = getWorkspaceId(req);

    const membership = await db
      .select()
      .from(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.userId, userId),
          eq(workspaceMembersTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      res.status(403).json({ error: "Not a member of this workspace" });
      return;
    }

    (req as AuthedRequest).workspaceRole = membership[0].role;
    next();
  };
}
