import { createClerkClient } from "@clerk/backend";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const { Pool } = pg;

if (!process.env.DATABASE_URL || !process.env.CLERK_SECRET_KEY) {
  console.error("Missing DATABASE_URL or CLERK_SECRET_KEY in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function sync() {
  console.log("Starting manual sync from Clerk...");

  try {
    // 1. Fetch all users from Clerk
    console.log("Fetching users...");
    const users = await clerk.users.getUserList();
    for (const user of users.data) {
      const email = user.emailAddresses[0]?.emailAddress || "";
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || email || "Unknown";
      
      await pool.query(
        `INSERT INTO users (id, name, email, image, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, image = $4, updated_at = $6`,
        [user.id, name, email, user.imageUrl, new Date(user.createdAt), new Date(user.updatedAt)]
      );
    }

    // 2. Fetch all organizations
    console.log("Fetching organizations...");
    const orgs = await clerk.organizations.getOrganizationList();
    for (const org of orgs.data) {
      await pool.query(
        `INSERT INTO workspaces (id, name, slug, image_url, owner_id, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, image_url = $4, updated_at = $8`,
        [org.id, org.name, org.slug || org.id, org.imageUrl, org.createdBy || "", {}, new Date(org.createdAt), new Date(org.updatedAt)]
      );

      // 3. Fetch memberships for each org
      console.log(`Fetching memberships for org: ${org.name}...`);
      const memberships = await clerk.organizations.getOrganizationMembershipList({ organizationId: org.id });
      for (const mem of memberships.data) {
        const role = mem.role === "org:admin" ? "ADMIN" : "MEMBER";
        await pool.query(
          `INSERT INTO workspace_members (id, user_id, workspace_id, role, message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [mem.id, mem.publicUserData.userId, org.id, role, "", new Date(mem.createdAt)]
        );
      }
    }

    console.log("Sync complete!");
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    await pool.end();
  }
}

sync();
