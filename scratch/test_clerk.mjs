import { createClerkClient } from "@clerk/backend";
import dotenv from "dotenv";
import path from "path";

// Load .env from artifacts/api-server
dotenv.config({ path: path.join(process.cwd(), "artifacts", "api-server", ".env") });

const secretKey = process.env.CLERK_SECRET_KEY;
console.log("Secret Key:", secretKey ? "Found" : "Missing");

if (!secretKey) {
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });

async function testInvite() {
  try {
    // Try to list orgs first to verify key
    const orgs = await clerk.organizations.getOrganizationList({ limit: 1 });
    console.log("Orgs found:", orgs.data.length);
    
    if (orgs.data.length === 0) {
      console.log("No organizations found for this Clerk instance.");
      return;
    }

    const orgId = orgs.data[0].id;
    console.log("Testing invite for org:", orgId);

    // We won't actually send an invite to a real email to avoid spamming,
    // but we can try to list invitations to see if the API works.
    const invites = await clerk.organizations.getOrganizationInvitationList({
      organizationId: orgId,
    });
    console.log("Current invitations:", invites.data.length);
    
    console.log("Clerk API test successful.");
  } catch (err) {
    console.error("Clerk API test failed:", err);
  }
}

testInvite();
