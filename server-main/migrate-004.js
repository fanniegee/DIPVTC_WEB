require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false });
  try {
    const sql = await fs.readFile(path.resolve(__dirname, "../database/004_parent_student_portals.sql"), "utf8");
    await pool.query(sql);
    process.stdout.write("Migration 004 (parent and student portals) applied.\n");
  } finally { await pool.end(); }
}

main().catch(error => { process.stderr.write(`Migration 004 failed: ${error.message}\n`); process.exitCode = 1; });
