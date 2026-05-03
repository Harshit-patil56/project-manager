import pg from "pg";
import { fileURLToPath } from "url";
import path from "path";
import * as fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkDb() {
  try {
    const users = await pool.query("SELECT COUNT(*) as count FROM users");
    const workspaces = await pool.query("SELECT id, name, owner_id FROM workspaces");
    const members = await pool.query("SELECT user_id, workspace_id, role FROM workspace_members");
    
    console.log("Users in DB:", users.rows[0].count);
    console.log("Workspaces in DB:", JSON.stringify(workspaces.rows, null, 2));
    console.log("Members in DB:", JSON.stringify(members.rows, null, 2));
  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await pool.end();
  }
}

checkDb();
