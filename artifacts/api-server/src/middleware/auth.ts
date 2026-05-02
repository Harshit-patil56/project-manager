import { createClerkClient } from "@clerk/backend";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { workspaceMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY must be set");
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Build the list of authorized parties from the Replit domain env vars
// so Clerk's azp claim check passes in both dev and production
function buildAuthorizedParties(): string[] {
  const parties: string[] = ["http://localhost", "http://localhost:25074"];
  const replitDomains = process.env.REPLIT_DOMAINS ?? "";
  for (const d of replitDomains.split(",").map((s) => s.trim()).filter(Boolean)) {
    parties.push(`https://${d}`);
    parties.push(`http://${d}`);
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "";
  if (devDomain) {
    parties.push(`https://${devDomain}`);
    parties.push(`http://${devDomain}`);
  }
  return [...new Set(parties)];
}

const authorizedParties = buildAuthorizedParties();

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
    const payload = await clerk.verifyToken(token, { authorizedParties });
    (req as AuthedRequest).userId = payload.sub;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(401).json({ error: "Invalid token", detail: message });
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
