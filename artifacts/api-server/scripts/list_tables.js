const { Pool } = require('pg');
(async function(){
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const res = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' ORDER BY table_schema, table_name");
    for (const r of res.rows) console.log(r.table_schema + '\t' + r.table_name);
    await pool.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
