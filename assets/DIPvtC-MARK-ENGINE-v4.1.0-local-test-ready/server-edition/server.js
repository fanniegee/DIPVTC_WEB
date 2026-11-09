require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { Pool } = require("pg");
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || false }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
});

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, service: "DIPvtC Marking Engine", database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});

app.get("/api/config", (_req, res) => res.json({
  school: "Double Impact Private College",
  levels: ["primary", "secondary"],
  capabilities: ["paper-mark-entry", "subject-percentages", "primary-units", "secondary-grades", "subject-awards", "rankings", "report-generation"]
}));

// Integration routes are intentionally protected from public use until authentication/roles are implemented.
app.use("/api/*", (_req, res, next) => {
  if (process.env.ENABLE_UNAUTHENTICATED_DEMO === "true") return next();
  return res.status(501).json({ error: "Authentication and school-role middleware must be enabled before academic data endpoints are exposed." });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(port, () => console.log(`DIPvtC Marking Engine listening on ${port}`));
