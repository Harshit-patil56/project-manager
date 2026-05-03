import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/_debug/schemas", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' ORDER BY table_schema, table_name",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
