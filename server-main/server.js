require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("node:path");
const fs = require("node:fs/promises");
const { Pool } = require("pg");
const mailer = require("./mailer");
const markingCalculations = require(path.resolve(__dirname, "../assets/DIPvtC-MARK-ENGINE-v4.1.0-local-test-ready/shared/calculations.js"));

const scrypt = promisify(crypto.scrypt);
const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const publicRoot = path.join(__dirname, "public");
const cookieName = "dipvtc_session";
const sessionHours = 8;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false
});

const OWNER_KEYS = new Set([
  "dipvtc_admission_sec_text", "dipvtc_admission_sec_title", "dipvtc_admission_text",
  "dipvtc_applications", "dipvtc_calendar", "dipvtc_campus_timetable", "dipvtc_changelog",
  "di_expenses", "di_fees", "di_payments", "di_school", "di_students",
  "dipvtc_contacts_v2", "dipvtc_course_teachers", "dipvtc_courses", "dipvtc_enquiries",
  "dipvtc_fees", "dipvtc_invoices", "dipvtc_news", "dipvtc_news_text", "dipvtc_news_title",
  "dipvtc_online_timetable", "dipvtc_owner", "dipvtc_pathways_v2", "dipvtc_payments",
  "dipvtc_programs_schools", "dipvtc_programs_title", "dipvtc_pupils", "dipvtc_replies",
  "dipvtc_roles_v2", "dipvtc_sa_ecd", "dipvtc_sa_fet", "dipvtc_sa_found", "dipvtc_sa_inter",
  "dipvtc_sa_main", "dipvtc_sa_senior", "dipvtc_site_about", "dipvtc_site_aboutTitle",
  "dipvtc_site_address", "dipvtc_site_coursesTitle", "dipvtc_site_email", "dipvtc_site_facebook",
  "dipvtc_site_instagram", "dipvtc_site_tiktok", "dipvtc_site_youtube", "dipvtc_site_x", "dipvtc_site_linkedin",
  "dipvtc_site_telegram", "dipvtc_site_threads", "dipvtc_site_pinterest",
  "dipvtc_site_footer", "dipvtc_site_hero", "dipvtc_site_herosub", "dipvtc_site_motto",
  "dipvtc_site_whatsapp", "dipvtc_site_phones", "dipvtc_students", "dipvtc_subjects_image_boxes",
  "dipvtc_tasks", "dipvtc_team", "dipvtc_usd_rate", "dipvtc_welcome_text", "dipvtc_welcome_title"
]);
const ADMIN_KEYS = new Set(["dipvtc_courses", "dipvtc_students", "dipvtc_enquiries", "dipvtc_applications"]);
const STAFF_ROLE_CODES = ["principal", "teacher", "admissions", "finance", "content", "front_desk", "staff"];
const ADMISSION_SCHOOLS = [
  { code: "cambridge", name: "Cambridge", classes: [
    { name: "ECD A", academicLevel: "primary" }, { name: "ECD B", academicLevel: "primary" },
    ...Array.from({ length: 7 }, (_, i) => ({ name: `Grade ${i + 1}`, academicLevel: "primary" })),
    ...["Form 1", "Form 2", "Form 3", "IGCSE", "AS Level", "A Level"].map(name => ({ name, academicLevel: "secondary" }))
  ]},
  { code: "deitypro-fx", name: "DeityPro FX", classes: ["Fundamental Trading Strategies", "Technical Trading Strategies", "Price Action & SMC Mastery", "Sentiment & Market Psychology", "Risk Management & Prop Firm Mastery", "Algorithmic & Automated Trading"].map(name => ({ name, academicLevel: null })) },
  { code: "practical", name: "Practical", classes: ["Driving Skills", "Computer Courses", "Care Giver Courses", "Music Institute"].map(name => ({ name, academicLevel: null })) },
  { code: "south-africa", name: "South Africa CAPS | NCS", classes: ["Grade RRR", "Grade RR", "Grade R", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)].map(name => ({ name, academicLevel: /^Grade (?:RRR|RR|R|[1-7])$/.test(name) ? "primary" : "secondary" })) },
  { code: "upgrade", name: "Upgrade", classes: [{ name: "ECD / Foundation", academicLevel: "primary" }, { name: "Grade 1", academicLevel: "primary" }, { name: "Grade 2", academicLevel: "primary" }, { name: "Grade 3", academicLevel: "primary" }, { name: "Grade 4", academicLevel: "primary" }, { name: "Grade 5", academicLevel: "primary" }, { name: "Grade 6", academicLevel: "primary" }, { name: "Primary Rewrite: Grade 7", academicLevel: "primary" }, { name: "High School: O Level", academicLevel: "secondary" }, { name: "High School: Upper 6", academicLevel: "secondary" }] },
  { code: "zimsec", name: "ZIMSEC / HEXCO", classes: [{ name: "ECD A", academicLevel: "primary" }, { name: "ECD B", academicLevel: "primary" }, ...Array.from({ length: 7 }, (_, i) => ({ name: `Grade ${i + 1}`, academicLevel: "primary" })), { name: "Form 1", academicLevel: "secondary" }, { name: "Form 2", academicLevel: "secondary" }, { name: "Form 3 / O Level", academicLevel: "secondary" }, { name: "Form 4 / O Level", academicLevel: "secondary" }, { name: "Form 5 / A Level", academicLevel: "secondary" }, { name: "Form 6 / A Level", academicLevel: "secondary" }, { name: "HEXCO Certificate", academicLevel: null }] }
];
const STAFF_KEYS_BY_ROLE = {
  principal: new Set(["dipvtc_courses", "dipvtc_students", "dipvtc_pupils", "dipvtc_tasks"]),
  teacher: new Set(["dipvtc_courses", "dipvtc_students", "dipvtc_tasks", "dipvtc_course_teachers", "dipvtc_online_timetable", "dipvtc_calendar", "dipvtc_marking_engine_v1"]),
  admissions: new Set(["dipvtc_courses", "dipvtc_students", "dipvtc_pupils", "dipvtc_tasks", "dipvtc_enquiries", "dipvtc_applications"]),
  finance: new Set(["dipvtc_students", "dipvtc_pupils", "dipvtc_tasks", "dipvtc_fees", "dipvtc_invoices", "dipvtc_payments", "di_students", "di_payments", "di_expenses", "di_fees", "di_school"]),
  content: new Set(["dipvtc_site_hero", "dipvtc_site_herosub", "dipvtc_site_motto", "dipvtc_admission_text", "dipvtc_welcome_title", "dipvtc_welcome_text", "dipvtc_site_coursesTitle", "dipvtc_admission_sec_title", "dipvtc_admission_sec_text", "dipvtc_news_title", "dipvtc_news_text", "dipvtc_site_email", "dipvtc_site_phones", "dipvtc_site_address", "dipvtc_site_footer", "dipvtc_news", "dipvtc_tasks", "dipvtc_changelog"]),
  front_desk: new Set(["dipvtc_students", "dipvtc_pupils", "dipvtc_tasks", "dipvtc_enquiries", "dipvtc_applications", "dipvtc_online_timetable", "dipvtc_calendar"]),
  staff: new Set(["dipvtc_tasks"])
};
const STAFF_ROLE_LABELS = new Map([
  ["principal", { role: "principal", title: "Principal" }],
  ["teacher / tutor / lecturer", { role: "teacher", title: "Teacher / Tutor / Lecturer" }],
  ["teacher", { role: "teacher", title: "Teacher / Tutor / Lecturer" }],
  ["admissions officer", { role: "admissions", title: "Admissions Officer" }],
  ["finance / fees officer", { role: "finance", title: "Finance / Fees Officer" }],
  ["content manager", { role: "content", title: "Content Manager" }],
  ["front desk", { role: "front_desk", title: "Front Desk" }]
]);
const PUBLIC_KEYS = new Set([
  "dipvtc_site_hero", "dipvtc_site_herosub", "dipvtc_site_motto", "dipvtc_admission_text",
  "dipvtc_welcome_title", "dipvtc_welcome_text", "dipvtc_site_coursesTitle",
  "dipvtc_admission_sec_title", "dipvtc_admission_sec_text", "dipvtc_news_title", "dipvtc_news_text",
  "dipvtc_site_email", "dipvtc_site_phones", "dipvtc_site_address", "dipvtc_site_footer", "dipvtc_news",
  "dipvtc_contacts_v2", "dipvtc_site_facebook", "dipvtc_site_whatsapp", "dipvtc_site_instagram",
  "dipvtc_site_tiktok", "dipvtc_site_youtube", "dipvtc_site_x", "dipvtc_site_linkedin",
  "dipvtc_site_telegram", "dipvtc_site_threads", "dipvtc_site_pinterest",
  "dipvtc_site_about", "dipvtc_site_aboutTitle", "dipvtc_programs_schools", "dipvtc_programs_title", "dipvtc_courses", "dipvtc_subjects_image_boxes",
  "dipvtc_pathways_v2"
]);
const FINANCE_STORAGE_KEYS = new Set(["di_students", "di_payments", "di_expenses", "di_fees", "di_school"]);
const CONTENT_WRITE_KEYS = new Set(["dipvtc_news_title", "dipvtc_news_text"]);

app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
if (process.env.ALLOWED_ORIGIN) app.use(cors({ origin: process.env.ALLOWED_ORIGIN, credentials: true }));
app.use(express.json({ limit: "8mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 240, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/auth/password-reset/request", rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/enquiries", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/registration-requests", rateLimit({ windowMs: 60 * 60 * 1000, limit: 4, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/student-registrations", rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }));

function readCookie(req, name) {
  const part = (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionHours * 3600}${secure}`);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
function writeOriginIsSame(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !writeOriginIsSame(req)) {
    return res.status(403).json({ error: "Cross-site requests are not allowed." });
  }
  next();
});

async function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}
async function passwordMatches(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function validPassword(value) { return typeof value === "string" && value.length >= 10 && value.length <= 256; }
const HEALTH_CONDITIONS = new Set(["HIV/AIDS","Cancer","Diabetes","Asthma","Epilepsy / seizures","Sickle cell disease","Heart condition","High blood pressure","Kidney condition","Anaemia","Tuberculosis (TB)","Chronic skin condition","Mental health condition","Physical disability","Vision condition","Hearing condition"]);
const CHILD_ALLERGIES = new Set(["Peanuts","Tree nuts","Milk / dairy","Eggs","Fish","Shellfish","Wheat / gluten","Soy","Penicillin / antibiotics","Other medicines","Pollen","Dust mites","Mould","Insect stings","Latex","Animal dander"]);
function parseHealthInformation(body) {
  const status = String(body.healthConditionStatus || body.health_condition_status || "").trim();
  if (!["none","has_conditions"].includes(status)) return { error: "Choose whether the learner has a known health condition." };
  const list = (value, allowed) => {
    if (!Array.isArray(value)) return [];
    const values = [...new Set(value.map(x => String(x).trim()))];
    if (values.some(x => !allowed.has(x))) throw new Error("Choose health information from the provided lists.");
    return values;
  };
  let conditions, allergies;
  try { conditions = list(body.healthConditions || body.health_conditions, HEALTH_CONDITIONS); allergies = list(body.allergies, CHILD_ALLERGIES); }
  catch (error) { return { error: error.message }; }
  const conditionOther = String(body.healthConditionOther || body.health_condition_other || "").trim().slice(0,500);
  const allergyOther = String(body.allergyOther || body.allergy_other || "").trim().slice(0,500);
  const allergyValue = body.hasAllergies !== undefined ? body.hasAllergies : body.has_allergies;
  const hasAllergies = allergyValue === true || allergyValue === "yes";
  const noAllergies = allergyValue === false || allergyValue === "no";
  if (!hasAllergies && !noAllergies) return { error: "Choose Yes or No for known allergies." };
  if (status === "has_conditions" && !conditions.length && !conditionOther) return { error: "Select a known condition or describe another condition." };
  if (status !== "has_conditions" && (conditions.length || conditionOther)) return { error: "Clear condition details or select that the learner has conditions." };
  if (hasAllergies && !allergies.length && !allergyOther) return { error: "Select a known allergy or describe another allergy." };
  if (!hasAllergies && (allergies.length || allergyOther)) return { error: "Clear allergy details or answer Yes to known allergies." };
  const needsDoctor = status === "has_conditions" || hasAllergies;
  const doctorName = String(body.doctorName || body.doctor_name || "").trim().slice(0,180);
  const doctorClinic = String(body.doctorClinic || body.doctor_clinic || "").trim().slice(0,180);
  const doctorPhone = String(body.doctorPhone || body.doctor_phone || "").trim().slice(0,40);
  const doctorEmail = String(body.doctorEmail || body.doctor_email || "").trim().toLowerCase().slice(0,254);
  if (needsDoctor && (!doctorName || !doctorClinic || !doctorPhone)) return { error: "For any reported condition or allergy, provide the doctor’s name, clinic and phone number." };
  if (doctorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doctorEmail)) return { error: "Enter a valid doctor or clinic email address." };
  return { value: {
    healthConditionStatus: status, healthConditions: status === "has_conditions" ? conditions : [],
    healthConditionOther: status === "has_conditions" ? conditionOther : "", hasAllergies,
    allergies: hasAllergies ? allergies : [], allergyOther: hasAllergies ? allergyOther : "",
    doctorName: needsDoctor ? doctorName : "", doctorClinic: needsDoctor ? doctorClinic : "",
    doctorPhone: needsDoctor ? doctorPhone : "", doctorEmail: needsDoctor ? doctorEmail : "",
    doctorAddress: needsDoctor ? String(body.doctorAddress || body.doctor_address || "").trim().slice(0,500) : "",
    healthNotes: needsDoctor ? String(body.healthNotes || body.health_notes || "").trim().slice(0,2000) : ""
  }};
}
async function nextStudentNumber(client, schoolYear = new Date().getFullYear()) {
  const result = await client.query("INSERT INTO student_number_counters(school_year,last_number) VALUES($1,1) ON CONFLICT(school_year) DO UPDATE SET last_number=student_number_counters.last_number+1 RETURNING last_number", [schoolYear]);
  return "DIP-" + schoolYear + "-" + String(result.rows[0].last_number).padStart(3, "0");
}
async function reserveStudentNumber(client, value) {
  const match = /^DIP-(\d{4})-(\d+)$/.exec(String(value || "").trim());
  if (!match) return;
  await client.query("INSERT INTO student_number_counters(school_year,last_number) VALUES($1,$2) ON CONFLICT(school_year) DO UPDATE SET last_number=GREATEST(student_number_counters.last_number,EXCLUDED.last_number)", [Number(match[1]), Number(match[2])]);
}
function publicUrl(req, pathname) { const base = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).trim().replace(/\/+$/, ""); return `${base}${pathname}`; }

async function authenticate(req, res, next) {
  try {
    const token = readCookie(req, cookieName);
    if (!token || token.length > 200) return next();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const result = await pool.query(
      `SELECT u.id,u.email,u.display_name,u.role,u.role_title,u.section
       FROM app_sessions s JOIN app_users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=TRUE`, [tokenHash]
    );
    req.user = result.rows[0] || null;
    next();
  } catch (error) { next(error); }
}
app.use((req, res, next) => {
  const needsSession = req.path === "/owner.html" || req.path === "/admin.html" || req.path === "/staff.html" || req.path === "/fees.html" || req.path === "/fees.htm" || req.path === "/assets/fees.html" || req.path.startsWith("/exam-mark-entry") ||
    req.path === "/registrations.html" || req.path === "/learning.html" || req.path === "/parent-portal.html" || req.path === "/student-portal.html" ||
    req.path.startsWith("/api/state") || req.path === "/api/auth/password" || req.path.startsWith("/api/team/invites") || req.path.startsWith("/api/staff/") ||
    req.path.startsWith("/api/admissions/") || req.path.startsWith("/api/portal/") || req.path.startsWith("/api/admin/");
  if (!needsSession) return next();
  authenticate(req, res, next);
});
function assignedRoleNamesForUser(user) {
  return pool.query("SELECT value FROM site_state WHERE state_key='dipvtc_staff_role_assignments'").then(result=>{
    let assignments=result.rows[0]?.value??{};if(typeof assignments==="string"){try{assignments=JSON.parse(assignments)}catch{assignments={}}}if(!assignments||typeof assignments!=="object"||Array.isArray(assignments))return [];
    const names=assignments[String(user.email||"").toLowerCase()];return Array.isArray(names)?names.filter(name=>typeof name==="string").slice(0,20):[];
  });
}
async function assignedRoleCodesForUser(user) {
  const names=await assignedRoleNamesForUser(user);return [...new Set(names.map(name=>STAFF_ROLE_LABELS.get(name.trim().toLowerCase())?.role).filter(Boolean))];
}
async function requireRoleMatches(user,roles){if(roles.includes(user.role))return true;const assigned=await assignedRoleCodesForUser(user);return assigned.some(role=>roles.includes(role));}
function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) {
      if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Please sign in." });
      return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
    }
    try{if(!await requireRoleMatches(req.user,roles))return req.path.startsWith("/api/")
      ? res.status(403).json({ error: "Your account does not have permission for this action." })
      : res.status(403).send("You do not have permission to view this page.");next();}catch(error){next(error)}
  };
}
app.use("/exam-mark-entry", requireRole("teacher"));
function keysForRole(role, roleTitle = "") {
  if (role === "owner") return [...OWNER_KEYS];
  if (role === "admin") return [...ADMIN_KEYS];
  return [...(STAFF_KEYS_BY_ROLE[role] || STAFF_KEYS_BY_ROLE.staff)];
}
function profileStorageKeys(role){if(role==="finance")return FINANCE_STORAGE_KEYS;if(role==="teacher")return new Set(STAFF_KEYS_BY_ROLE.teacher);if(role==="content")return CONTENT_WRITE_KEYS;return new Set(STAFF_KEYS_BY_ROLE[role]||STAFF_KEYS_BY_ROLE.staff)}
async function keysForUser(user){const keys=new Set(keysForRole(user.role,user.role_title));for(const role of await assignedRoleCodesForUser(user))for(const key of STAFF_KEYS_BY_ROLE[role]||[])keys.add(key);return [...keys]}
async function allowedKeysForUser(user) {
  if (user.role === "owner") return OWNER_KEYS;
  const allowed=user.role==="admin"?new Set(ADMIN_KEYS):user.role==="finance"?new Set(FINANCE_STORAGE_KEYS):user.role==="teacher"?new Set(["dipvtc_marking_engine_v1"]):user.role==="content"?new Set(CONTENT_WRITE_KEYS):new Set();
  for(const role of await assignedRoleCodesForUser(user))for(const key of profileStorageKeys(role))allowed.add(key);return allowed;
}
function filterStaffState(snapshot, user) {
  if (!STAFF_ROLE_CODES.includes(user.role) || !snapshot.dipvtc_tasks) return snapshot;
  const filtered = { ...snapshot };
  try {
    const stored = typeof filtered.dipvtc_tasks === "string" ? JSON.parse(filtered.dipvtc_tasks) : filtered.dipvtc_tasks;
    filtered.dipvtc_tasks = JSON.stringify(Array.isArray(stored) ? stored.filter(task => String(task.to || "").toLowerCase() === user.email.toLowerCase()) : []);
  } catch { filtered.dipvtc_tasks = "[]"; }
  return filtered;
}
function roleDetailsForInvite(value) {
  const label = String(value || "").trim().slice(0, 100);
  const normalized = label.toLowerCase();
  if (!label || ["owner", "admin", "administrator", "admin / owner"].includes(normalized)) return null;
  return STAFF_ROLE_LABELS.get(normalized) || { role: "staff", title: label };
}
function safeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
async function stateSnapshot(keys) {
  const result = await pool.query("SELECT state_key,value FROM site_state WHERE state_key=ANY($1::text[])", [keys]);
  const state = Object.fromEntries(result.rows.map(row => [row.state_key, row.value]));
  if (keys.includes("dipvtc_enquiries")) {
    const enquiries = await pool.query("SELECT id,full_name,email,course,message,status,created_at FROM website_enquiries ORDER BY created_at");
    state.dipvtc_enquiries = JSON.stringify(enquiries.rows.map(row => ({
      id: row.id, name: row.full_name, email: row.email, course: row.course,
      message: row.message, status: row.status, date: row.created_at.toISOString()
    })));
  }
  return state;
}
function stateWithIdentity(snapshot, user) {
  const state = { ...snapshot };
  if (user) {
    state.dipvtc_current = JSON.stringify({ id: user.id, name: user.display_name, email: user.email, role: user.role, roleTitle: user.role_title || "", section: user.section, assignedRoles:user.assignedRoles||[] });
    if (user.role === "owner" && !state.dipvtc_owner) state.dipvtc_owner = user.display_name;
  }
  return state;
}
async function renderHtml(fileName, user, res) {
  const filePath = path.join(publicRoot, fileName);
  let html = await fs.readFile(filePath, "utf8");
  const scopedUser=user?{...user,assignedRoles:await assignedRoleNamesForUser(user)}:null;
  const keys = scopedUser ? await keysForUser(scopedUser) : [...PUBLIC_KEYS];
  const snapshot = filterStaffState(await stateSnapshot(keys), scopedUser || {});
  const state = stateWithIdentity(snapshot, scopedUser);
  const userPayload = scopedUser ? { id: scopedUser.id, name: scopedUser.display_name, email: scopedUser.email, role: scopedUser.role, roleTitle: scopedUser.role_title || "", section: scopedUser.section, assignedRoles:scopedUser.assignedRoles } : null;
  const bootstrap = `<script>window.__DIPVTC_STATE__=${safeJsonForScript(state)};window.__DIPVTC_USER__=${safeJsonForScript(userPayload)};</script><script src="/server-storage.js"></script>`;
  html = html.replace(/\blocalStorage\b/g, "window.dipvtcStore").replace(/<script\b/i, `${bootstrap}<script`);
  if (user) res.setHeader("Cache-Control", "no-store");
  res.type("html").send(html);
}

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, service: "DIPVTC Main Website and Marking Engine", database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});
app.get("/api/config", (_req, res) => res.json({ school: "Double Impact Private College", levels: ["primary", "secondary"], status: "server-backed owner, admin, website content and enquiry workflows enabled" }));
app.post("/api/admin/email/test", requireRole("owner", "admin"), async (req,res)=>{try{await mailer.sendTestEmail(req.user.email,req.user.display_name);res.json({ok:true,message:`A delivery test was sent to ${req.user.email}.`});}catch(e){if(e.status) return res.status(e.status).json({error:e.message});console.warn("Email delivery test failed:",e.code||"email transport error");res.status(503).json({error:"The email server could not deliver the test. Check the selected email transport, its API key or SMTP credentials, and the verified sender address."});}});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;
    const portal = String(req.body?.portal || "");
    if (!email || typeof password !== "string") return res.status(400).json({ error: "Enter your email and password." });
    const result = await pool.query("SELECT * FROM app_users WHERE LOWER(email)=$1", [email]);
    const user = result.rows[0];
    if (!user || !await passwordMatches(password, user.password_hash)) return res.status(401).json({ error: "Email or password is incorrect." });
    if (!user.active) {
      if (user.role === "student") {
        const application = await pool.query("SELECT status FROM student_registration_requests WHERE student_user_id=$1 ORDER BY submitted_at DESC LIMIT 1", [user.id]);
        if (application.rows[0]?.status === "rejected") return res.status(403).json({ error: "This registration was not approved. Please contact the Admissions Office." });
        return res.status(403).json({ error: "Your student registration is awaiting Admissions approval. You can sign in after approval." });
      }
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (portal === "/staff.html" && !STAFF_ROLE_CODES.includes(user.role)) return res.status(403).json({ error: "Use the Admin / Owner Login for management accounts." });
    if (portal === "/admin.html" && !["owner", "admin"].includes(user.role)) return res.status(403).json({ error: "Staff accounts must use Staff Login." });
    if (portal === "/owner.html" && user.role !== "owner") return res.status(403).json({ error: "This account cannot open the Owner panel." });
    if (portal === "/parent-portal.html" && user.role !== "parent") return res.status(403).json({ error: "Use the Parent Portal sign-in for a Parent account." });
    if (portal === "/student-portal.html" && user.role !== "student") return res.status(403).json({ error: "Use the Student Portal sign-in for a Student account." });
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query("INSERT INTO app_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')", [user.id, tokenHash]);
    await pool.query("INSERT INTO app_audit_log(user_id,action) VALUES($1,'sign-in')", [user.id]);
    setSessionCookie(res, token);
    const destination = user.role === "parent" ? "/parent-portal.html" : user.role === "student" ? "/student-portal.html" : null;
    res.json({ destination, user: { id: user.id, email: user.email, name: user.display_name, role: user.role, roleTitle: user.role_title || "", section: user.section } });
  } catch (error) { next(error); }
});

// Parent and student accounts are provisioned by Admissions/Admin and bound to specific learners.
app.post("/api/admissions/learners", requireRole("owner","admin","admissions"), async(req,res,next)=>{
  const b=req.body||{},fullName=String(b.fullName||"").trim().slice(0,180),className=String(b.className||"").trim().slice(0,80),schoolCode=String(b.schoolCode||"zimsec"),school=ADMISSION_SCHOOLS.find(x=>x.code===schoolCode),classChoice=school?.classes.find(x=>x.name===className),level=classChoice?classChoice.academicLevel:(["primary","secondary"].includes(String(b.level||"").toLowerCase())?String(b.level).toLowerCase():null),guardianName=String(b.guardianName||"").trim().slice(0,180),guardianEmail=String(b.guardianEmail||"").trim().toLowerCase(),studentEmail=String(b.studentEmail||"").trim().toLowerCase();
  if(fullName.length<2||!school||!className||!guardianName||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)))return res.status(400).json({error:"Enter the learner name, school, intended class, guardian name and valid guardian email."});
  if(studentEmail&&!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)))return res.status(400).json({error:"Enter a valid student email or leave it blank."});
  if(studentEmail&&studentEmail===guardianEmail)return res.status(400).json({error:"Use separate email addresses for parent and student portal accounts."});
  const parsedHealth=parseHealthInformation(b);if(parsedHealth.error)return res.status(400).json({error:parsedHealth.error});const h=parsedHealth.value;
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const clsName=(schoolCode+" · "+className).slice(0,80),cls=level?await client.query("INSERT INTO classes(level,name) VALUES($1,$2) ON CONFLICT(level,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",[level,clsName]):null;
    const supplied=String(b.studentNumber||"").trim().slice(0,50),number=supplied||await nextStudentNumber(client);if(supplied)await reserveStudentNumber(client,supplied);
    const learner=await client.query("INSERT INTO students(student_number,full_name,class_id) VALUES($1,$2,$3) RETURNING id,student_number,full_name",[number,fullName,cls?.rows[0]?.id||null]);
    await client.query("INSERT INTO learner_profiles(student_id,date_of_birth,gender,address,guardian_name,guardian_email,guardian_phone,student_email,school_code,intended_class,updated_by,health_condition_status,health_conditions,health_condition_other,has_allergies,allergies,allergy_other,doctor_name,doctor_clinic,doctor_phone,doctor_email,doctor_address,health_notes) VALUES($1,NULLIF($2,'')::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)",
      [learner.rows[0].id,String(b.dateOfBirth||""),String(b.gender||"").slice(0,40),String(b.address||"").slice(0,2000),guardianName,guardianEmail,String(b.guardianPhone||"").slice(0,40),studentEmail,schoolCode,className,req.user.id,h.healthConditionStatus,h.healthConditions,h.healthConditionOther,h.hasAllergies,h.allergies,h.allergyOther,h.doctorName,h.doctorClinic,h.doctorPhone,h.doctorEmail,h.doctorAddress,h.healthNotes]);
    const links=[],targets=[{email:guardianEmail,name:guardianName,role:"parent"}].concat(studentEmail?[{email:studentEmail,name:fullName,role:"student"}]:[]);
    for(const t of targets){
      const existing=await client.query("SELECT id,role FROM app_users WHERE LOWER(email)=LOWER($1)",[t.email]);
      if(existing.rowCount){if(existing.rows[0].role!==t.role)throw Object.assign(new Error("The email "+t.email+" already belongs to another account type."),{status:409});await client.query("INSERT INTO portal_student_access(user_id,student_id,relationship) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[existing.rows[0].id,learner.rows[0].id,t.role==="parent"?"Parent / Guardian":"Student"]);continue;}
      const pending=await client.query("SELECT id FROM portal_invites WHERE LOWER(email)=LOWER($1) AND role=$2 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE",[t.email,t.role]),token=crypto.randomBytes(32).toString("base64url"),hash=crypto.createHash("sha256").update(token).digest("hex");
      let inv;if(pending.rowCount)inv=await client.query("UPDATE portal_invites SET token_hash=$2,display_name=$3,invited_by=$4,expires_at=NOW()+INTERVAL '7 days' WHERE id=$1 RETURNING id,expires_at",[pending.rows[0].id,hash,t.name,req.user.id]);else inv=await client.query("INSERT INTO portal_invites(email,display_name,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days') RETURNING id,expires_at",[t.email,t.name,t.role,hash,req.user.id]);
      await client.query("INSERT INTO portal_invite_students(invite_id,student_id,relationship) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[inv.rows[0].id,learner.rows[0].id,t.role==="parent"?"Parent / Guardian":"Student"]);links.push({role:t.role,email:t.email,name:t.name,expiresAt:inv.rows[0].expires_at,token});
    }
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'learner-registration',$2)",[req.user.id,number]);await client.query("COMMIT");
    const emailDelivery=[];for(const t of links){try{await mailer.sendAccountEmail({to:t.email,name:t.name,role:t.role,kind:"activation",expiresAt:t.expiresAt,url:publicUrl(req,"/portal-register.html?token="+encodeURIComponent(t.token))});emailDelivery.push({email:t.email,role:t.role,sent:true});}catch(e){console.warn("Portal activation email failed:",e.code||"email transport error");emailDelivery.push({email:t.email,role:t.role,sent:false});}}
    res.status(201).json({learner:learner.rows[0],emailDelivery,studentAccountSkipped:!!studentEmail&&studentEmail===guardianEmail});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});

app.get("/api/admissions/learners",requireRole("owner","admin","admissions"),async(_req,res,next)=>{
  try{const r=await pool.query("SELECT s.id,s.student_number,s.full_name,s.active,c.level,c.name AS class_name,p.school_code,p.intended_class,p.date_of_birth,p.gender,p.address,p.guardian_name,p.guardian_email,p.guardian_phone,p.student_email,p.health_condition_status,p.health_conditions,p.health_condition_other,p.has_allergies,p.allergies,p.allergy_other,p.doctor_name,p.doctor_clinic,p.doctor_phone,p.doctor_email,p.doctor_address,p.health_notes FROM students s LEFT JOIN classes c ON c.id=s.class_id LEFT JOIN learner_profiles p ON p.student_id=s.id ORDER BY s.created_at DESC");res.setHeader("Cache-Control","no-store");res.json({learners:r.rows});}catch(e){next(e);}
});

app.get("/api/admissions/registration-requests",requireRole("owner","admin","admissions"),async(_req,res,next)=>{
  try{const r=await pool.query("SELECT id,student_number,student_name,student_email,school_code,intended_class,academic_level,date_of_birth,guardian_name,guardian_email,guardian_phone,notes,status,submitted_at,health_condition_status,health_conditions,health_condition_other,has_allergies,allergies,allergy_other,doctor_name,doctor_clinic,doctor_phone,doctor_email,doctor_address,health_notes FROM student_registration_requests WHERE status IN ('pending','in_review') ORDER BY submitted_at DESC");const requests=r.rows.map(x=>({...x,school_name:ADMISSION_SCHOOLS.find(s=>s.code===x.school_code)?.name||x.school_code}));res.setHeader("Cache-Control","no-store");res.json({requests});}catch(e){next(e);}
});

app.put("/api/admissions/registration-requests/:id",requireRole("owner","admin","admissions"),async(req,res,next)=>{
  const id=String(req.params.id||""),status=String(req.body?.status||"");if(!/^[0-9a-f-]{36}$/i.test(id)||!["pending","in_review","rejected"].includes(status))return res.status(400).json({error:"Invalid registration request update."});
  try{const r=await pool.query("UPDATE student_registration_requests SET status=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1 AND status IN ('pending','in_review') RETURNING id,status,student_name,student_email,school_code,intended_class",[id,status,req.user.id]);if(!r.rowCount)return res.status(404).json({error:"This request was already handled or could not be found."});if(status==="rejected")await pool.query("UPDATE app_users SET active=FALSE WHERE id=(SELECT student_user_id FROM student_registration_requests WHERE id=$1)",[id]);await pool.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'public-registration-request-update',$2)",[req.user.id,r.rows[0].student_email]);let emailSent=false;if(status==="rejected"){try{const school=ADMISSION_SCHOOLS.find(s=>s.code===r.rows[0].school_code);await mailer.sendRegistrationStatus({to:r.rows[0].student_email,name:r.rows[0].student_name,status:"rejected",school:school?.name,intendedClass:r.rows[0].intended_class,studentNumber:r.rows[0].student_number});emailSent=true;}catch(e){console.warn("Student rejection notice failed:",e.code||"email transport error");}}res.json({request:r.rows[0],emailSent});}catch(e){next(e);}
});

app.post("/api/admissions/registration-requests/:id/approve",requireRole("owner","admin","admissions"),async(req,res,next)=>{
  const id=String(req.params.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:"Invalid registration request."});
  const client=await pool.connect();let parentInvite=null,studentEmail="",studentName="",schoolName="";
  try{
    await client.query("BEGIN");
    const q=await client.query("SELECT r.*,u.id AS account_id,u.email AS account_email FROM student_registration_requests r JOIN app_users u ON u.id=r.student_user_id WHERE r.id=$1 AND r.status IN ('pending','in_review') FOR UPDATE OF r,u",[id]);
    if(!q.rowCount)throw Object.assign(new Error("This request was already handled or could not be found."),{status:404});
    const r=q.rows[0];studentEmail=r.student_email;studentName=r.student_name;schoolName=ADMISSION_SCHOOLS.find(s=>s.code===r.school_code)?.name||r.school_code;
    let classId=null;if(r.academic_level){const rosterClass=(r.school_code+" · "+r.intended_class).slice(0,80);const cls=await client.query("INSERT INTO classes(level,name) VALUES($1,$2) ON CONFLICT(level,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",[r.academic_level,rosterClass]);classId=cls.rows[0].id;}
    const studentNumber=r.student_number||await nextStudentNumber(client);
    const student=await client.query("INSERT INTO students(student_number,full_name,class_id) VALUES($1,$2,$3) RETURNING id,student_number,full_name",[studentNumber,r.student_name,classId]);
    await client.query("INSERT INTO learner_profiles(student_id,date_of_birth,guardian_name,guardian_email,guardian_phone,student_email,school_code,intended_class,updated_by,health_condition_status,health_conditions,health_condition_other,has_allergies,allergies,allergy_other,doctor_name,doctor_clinic,doctor_phone,doctor_email,doctor_address,health_notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)",
      [student.rows[0].id,r.date_of_birth,r.guardian_name,r.guardian_email,r.guardian_phone,r.student_email,r.school_code,r.intended_class,req.user.id,r.health_condition_status,r.health_conditions,r.health_condition_other,r.has_allergies,r.allergies,r.allergy_other,r.doctor_name,r.doctor_clinic,r.doctor_phone,r.doctor_email,r.doctor_address,r.health_notes]);
    await client.query("INSERT INTO portal_student_access(user_id,student_id,relationship) VALUES($1,$2,'Student') ON CONFLICT DO NOTHING",[r.student_user_id,student.rows[0].id]);
    await client.query("UPDATE app_users SET active=TRUE,display_name=$2,updated_at=NOW() WHERE id=$1",[r.student_user_id,r.student_name]);
    if(r.guardian_email){
      const parent=await client.query("SELECT id,role FROM app_users WHERE LOWER(email)=LOWER($1)",[r.guardian_email]);
      if(parent.rowCount&&parent.rows[0].role==="parent")await client.query("INSERT INTO portal_student_access(user_id,student_id,relationship) VALUES($1,$2,'Parent / Guardian') ON CONFLICT DO NOTHING",[parent.rows[0].id,student.rows[0].id]);
      else if(parent.rowCount)throw Object.assign(new Error("The guardian email already belongs to another account type."),{status:409});
      else{
        const token=crypto.randomBytes(32).toString("base64url"),hash=crypto.createHash("sha256").update(token).digest("hex");
        const inv=await client.query("INSERT INTO portal_invites(email,display_name,role,token_hash,invited_by,expires_at) VALUES($1,$2,'parent',$3,$4,NOW()+INTERVAL '7 days') RETURNING id,expires_at",[r.guardian_email,r.guardian_name||"Parent / Guardian",hash,req.user.id]);
        await client.query("INSERT INTO portal_invite_students(invite_id,student_id,relationship) VALUES($1,$2,'Parent / Guardian')",[inv.rows[0].id,student.rows[0].id]);
        parentInvite={to:r.guardian_email,name:r.guardian_name||"Parent / Guardian",expiresAt:inv.rows[0].expires_at,token};
      }
    }
    await client.query("UPDATE student_registration_requests SET status='approved',linked_student_id=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$1",[id,student.rows[0].id,req.user.id]);
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'student-registration-approved',$2)",[req.user.id,studentNumber]);
    await client.query("COMMIT");
    let parentEmailSent=null;if(parentInvite){try{await mailer.sendAccountEmail({to:parentInvite.to,name:parentInvite.name,role:"parent",kind:"activation",expiresAt:parentInvite.expiresAt,url:publicUrl(req,"/portal-register.html?token="+encodeURIComponent(parentInvite.token))});parentEmailSent=true;}catch(e){parentEmailSent=false;console.warn("Parent activation email failed:",e.code||"email transport error");}}
    let studentNoticeSent=false;try{await mailer.sendRegistrationStatus({to:studentEmail,name:studentName,status:"approved",school:schoolName,studentNumber:studentNumber});studentNoticeSent=true;}catch(e){console.warn("Student approval notice failed:",e.code||"email transport error");}
    res.json({ok:true,student:{id:student.rows[0].id,studentNumber:student.rows[0].student_number},studentNoticeSent,parentEmailSent});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});

app.put("/api/admissions/learners/:id",requireRole("owner","admin","admissions"),async(req,res,next)=>{
  const b=req.body||{},id=String(req.params.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:"Invalid learner record."});
  const fullName=String(b.fullName||"").trim().slice(0,180),className=String(b.className||"").trim().slice(0,120),schoolCode=String(b.schoolCode||"zimsec"),school=ADMISSION_SCHOOLS.find(x=>x.code===schoolCode),classChoice=school?.classes.find(x=>x.name===className),level=classChoice?classChoice.academicLevel:(["primary","secondary"].includes(String(b.level||"").toLowerCase())?String(b.level).toLowerCase():null),guardianEmail=String(b.guardianEmail||"").trim().toLowerCase();
  if(fullName.length<2||!school||!className||guardianEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail))return res.status(400).json({error:"Check the learner name, school, intended class and guardian email."});
  if(String(b.studentEmail||"").trim()&&String(b.studentEmail||"").trim().toLowerCase()===guardianEmail)return res.status(400).json({error:"Use separate email addresses for parent and student portal accounts."});
  const parsedHealth=parseHealthInformation(b);if(parsedHealth.error)return res.status(400).json({error:parsedHealth.error});const h=parsedHealth.value;
  const client=await pool.connect();try{await client.query("BEGIN");
    const rosterClass=(schoolCode+" · "+className).slice(0,80),c=level?await client.query("INSERT INTO classes(level,name) VALUES($1,$2) ON CONFLICT(level,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",[level,rosterClass]):null;
    const customNumber=String(b.studentNumber||"").trim().slice(0,50);
    const updated=await client.query("UPDATE students SET full_name=$2,class_id=$3,active=$4,student_number=COALESCE(NULLIF($5,''),student_number) WHERE id=$1 RETURNING id,student_number,full_name,active",[id,fullName,c?.rows[0]?.id||null,b.active!==false,customNumber]);
    if(!updated.rowCount)throw Object.assign(new Error("Learner not found."),{status:404});if(customNumber)await reserveStudentNumber(client,customNumber);
    await client.query("INSERT INTO learner_profiles(student_id,date_of_birth,gender,address,guardian_name,guardian_email,guardian_phone,student_email,school_code,intended_class,updated_by,health_condition_status,health_conditions,health_condition_other,has_allergies,allergies,allergy_other,doctor_name,doctor_clinic,doctor_phone,doctor_email,doctor_address,health_notes) VALUES($1,NULLIF($2,'')::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT(student_id) DO UPDATE SET date_of_birth=EXCLUDED.date_of_birth,gender=EXCLUDED.gender,address=EXCLUDED.address,guardian_name=EXCLUDED.guardian_name,guardian_email=EXCLUDED.guardian_email,guardian_phone=EXCLUDED.guardian_phone,student_email=EXCLUDED.student_email,school_code=EXCLUDED.school_code,intended_class=EXCLUDED.intended_class,updated_by=EXCLUDED.updated_by,updated_at=NOW(),health_condition_status=EXCLUDED.health_condition_status,health_conditions=EXCLUDED.health_conditions,health_condition_other=EXCLUDED.health_condition_other,has_allergies=EXCLUDED.has_allergies,allergies=EXCLUDED.allergies,allergy_other=EXCLUDED.allergy_other,doctor_name=EXCLUDED.doctor_name,doctor_clinic=EXCLUDED.doctor_clinic,doctor_phone=EXCLUDED.doctor_phone,doctor_email=EXCLUDED.doctor_email,doctor_address=EXCLUDED.doctor_address,health_notes=EXCLUDED.health_notes",
      [id,String(b.dateOfBirth||""),String(b.gender||"").slice(0,40),String(b.address||"").slice(0,2000),String(b.guardianName||"").slice(0,180),guardianEmail,String(b.guardianPhone||"").slice(0,40),String(b.studentEmail||"").trim().toLowerCase(),schoolCode,className,req.user.id,h.healthConditionStatus,h.healthConditions,h.healthConditionOther,h.hasAllergies,h.allergies,h.allergyOther,h.doctorName,h.doctorClinic,h.doctorPhone,h.doctorEmail,h.doctorAddress,h.healthNotes]);
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'learner-update',$2)",[req.user.id,updated.rows[0].student_number]);await client.query("COMMIT");res.json({learner:updated.rows[0]});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});
app.post("/api/admissions/learners/:id/portal-access",requireRole("owner","admin","admissions"),async(req,res,next)=>{
  const id=String(req.params.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:"Invalid learner record."});
  const client=await pool.connect();try{await client.query("BEGIN");const r=await client.query(`SELECT s.id,s.full_name,p.guardian_name,p.guardian_email,p.student_email FROM students s JOIN learner_profiles p ON p.student_id=s.id WHERE s.id=$1 FOR UPDATE`,[id]);if(!r.rowCount)throw Object.assign(new Error("Learner profile not found."),{status:404});const p=r.rows[0];const guardian=String(p.guardian_email||"").trim().toLowerCase(),student=String(p.student_email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardian))throw Object.assign(new Error("Save a valid guardian email before issuing access."),{status:400});
    await client.query(`DELETE FROM portal_student_access a USING app_users u WHERE a.user_id=u.id AND a.student_id=$1 AND ((u.role='parent' AND LOWER(u.email)<>$2) OR (u.role='student' AND LOWER(u.email)<>$3))`,[id,guardian,student||"__no_student_email__"]);
    await client.query(`DELETE FROM portal_invite_students x USING portal_invites i WHERE x.invite_id=i.id AND x.student_id=$1 AND i.accepted_at IS NULL AND ((i.role='parent' AND LOWER(i.email)<>$2) OR (i.role='student' AND LOWER(i.email)<>$3))`,[id,guardian,student||"__no_student_email__"]);
    await client.query(`DELETE FROM portal_invites i WHERE i.accepted_at IS NULL AND NOT EXISTS(SELECT 1 FROM portal_invite_students x WHERE x.invite_id=i.id)`);
    const links=[];const targets=[{email:guardian,name:p.guardian_name||"Parent / Guardian",role:"parent"},...(student&&student!==guardian?[{email:student,name:p.full_name,role:"student"}]:[])];
    for(const t of targets){const existing=await client.query("SELECT id,role FROM app_users WHERE email=$1",[t.email]);if(existing.rowCount){if(existing.rows[0].role!==t.role)throw Object.assign(new Error(`The email ${t.email} already belongs to another account type.`),{status:409});await client.query("INSERT INTO portal_student_access(user_id,student_id,relationship) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[existing.rows[0].id,id,t.role==="parent"?"Parent / Guardian":"Student"]);continue;}
      const pending=await client.query("SELECT id FROM portal_invites WHERE LOWER(email)=$1 AND role=$2 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE",[t.email,t.role]);const raw=crypto.randomBytes(32).toString("base64url"),hash=crypto.createHash("sha256").update(raw).digest("hex");let invite;if(pending.rowCount)invite=await client.query("UPDATE portal_invites SET token_hash=$2,display_name=$3,invited_by=$4,expires_at=NOW()+INTERVAL '7 days' WHERE id=$1 RETURNING id,expires_at",[pending.rows[0].id,hash,t.name,req.user.id]);else invite=await client.query("INSERT INTO portal_invites(email,display_name,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days') RETURNING id,expires_at",[t.email,t.name,t.role,hash,req.user.id]);await client.query("INSERT INTO portal_invite_students(invite_id,student_id,relationship) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[invite.rows[0].id,id,t.role==="parent"?"Parent / Guardian":"Student"]);links.push({role:t.role,email:t.email,name:t.name,expiresAt:invite.rows[0].expires_at,token:raw});
    }
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'portal-access-refreshed',$2)",[req.user.id,p.full_name]);await client.query("COMMIT");const emailDelivery=[];for(const item of links){try{await mailer.sendAccountEmail({to:item.email,name:item.name,role:item.role,kind:"activation",expiresAt:item.expiresAt,url:publicUrl(req,`/portal-register.html?token=${encodeURIComponent(item.token)}`)});emailDelivery.push({email:item.email,role:item.role,sent:true});}catch(mailError){console.warn("Portal access email failed:",mailError.code||"SMTP error");emailDelivery.push({email:item.email,role:item.role,sent:false});}}res.json({emailDelivery,message:links.length?"Portal invitation email delivery attempted.":"Existing matching portal account(s) are now linked to this learner."});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});

app.get("/api/portal/invite-status", async(req,res,next)=>{try{const token=String(req.query.token||"");if(!token||token.length>100)return res.status(400).json({error:"Invalid activation link."});const r=await pool.query(`SELECT email,display_name,role,expires_at FROM portal_invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW()`,[crypto.createHash("sha256").update(token).digest("hex")]);if(!r.rowCount)return res.status(404).json({error:"This activation link is invalid, expired or already used."});res.setHeader("Cache-Control","no-store");res.json(r.rows[0]);}catch(e){next(e);}});
app.post("/api/portal/activate", async(req,res,next)=>{const token=String(req.body?.token||""),pass=req.body?.password;if(!token||token.length>100||!validPassword(pass))return res.status(400).json({error:"Use a valid activation link and a password with at least 10 characters."});const client=await pool.connect();try{await client.query("BEGIN");const hash=crypto.createHash("sha256").update(token).digest("hex");const ir=await client.query("SELECT * FROM portal_invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE",[hash]);const invite=ir.rows[0];if(!invite)throw Object.assign(new Error("This activation link is invalid, expired or already used."),{status:404});const u=await client.query("INSERT INTO app_users(email,display_name,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,email,display_name,role",[invite.email,invite.display_name,invite.role,await passwordHash(pass)]);const links=await client.query("SELECT student_id,relationship FROM portal_invite_students WHERE invite_id=$1",[invite.id]);for(const x of links.rows)await client.query("INSERT INTO portal_student_access(user_id,student_id,relationship) VALUES($1,$2,$3)",[u.rows[0].id,x.student_id,x.relationship]);await client.query("UPDATE portal_invites SET accepted_at=NOW() WHERE id=$1",[invite.id]);const st=crypto.randomBytes(32).toString("base64url");await client.query("INSERT INTO app_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')",[u.rows[0].id,crypto.createHash("sha256").update(st).digest("hex")]);await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'portal-activation',$2)",[u.rows[0].id,invite.role]);await client.query("COMMIT");setSessionCookie(res,st);res.status(201).json({redirect:invite.role==="parent"?"/parent-portal.html":"/student-portal.html"});}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});

app.put("/api/portal/learners/:id/profile",requireRole("parent"),async(req,res,next)=>{
  const b=req.body||{},id=String(req.params.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:"Invalid learner record."});
  const parsed=parseHealthInformation(b);if(parsed.error)return res.status(400).json({error:parsed.error});const h=parsed.value;
  const dob=String(b.dateOfBirth||"").trim();if(dob&&!/^\d{4}-\d{2}-\d{2}$/.test(dob))return res.status(400).json({error:"Enter a valid date of birth."});
  try{const r=await pool.query(`UPDATE learner_profiles p SET date_of_birth=NULLIF($3,'')::date,gender=$4,address=$5,guardian_phone=$6,health_condition_status=$7,health_conditions=$8,health_condition_other=$9,has_allergies=$10,allergies=$11,allergy_other=$12,doctor_name=$13,doctor_clinic=$14,doctor_phone=$15,doctor_email=$16,doctor_address=$17,health_notes=$18,updated_by=$2,updated_at=NOW() WHERE p.student_id=$1 AND EXISTS(SELECT 1 FROM portal_student_access a JOIN students s ON s.id=a.student_id WHERE a.user_id=$2 AND a.student_id=$1 AND a.relationship='Parent / Guardian' AND s.active=TRUE) RETURNING p.date_of_birth,p.gender,p.address,p.guardian_phone,p.health_condition_status,p.health_conditions,p.health_condition_other,p.has_allergies,p.allergies,p.allergy_other,p.doctor_name,p.doctor_clinic,p.doctor_phone,p.doctor_email,p.doctor_address,p.health_notes`,[id,req.user.id,dob,String(b.gender||"").slice(0,40),String(b.address||"").slice(0,2000),String(b.guardianPhone||"").slice(0,40),h.healthConditionStatus,h.healthConditions,h.healthConditionOther,h.hasAllergies,h.allergies,h.allergyOther,h.doctorName,h.doctorClinic,h.doctorPhone,h.doctorEmail,h.doctorAddress,h.healthNotes]);if(!r.rowCount)return res.status(404).json({error:"This learner is not linked to your parent account."});await pool.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'parent-learner-profile-update',$2)",[req.user.id,id]);res.setHeader("Cache-Control","no-store");res.json({profile:r.rows[0]});}catch(e){next(e);}
});
app.get("/api/portal/home", requireRole("parent","student","owner","admin"), async(req,res,next)=>{try{
    const managerPreview=["owner","admin"].includes(req.user.role),requestedPreview=String(req.query.previewStudentId||""),requestedAs=String(req.query.as||""),portalRole=managerPreview?requestedAs:req.user.role;
    if(managerPreview&&(!/^[0-9a-f-]{36}$/i.test(requestedPreview)||!["parent","student"].includes(requestedAs)))return res.status(400).json({error:"Open a learner portal using a valid read-only preview link."});
    const r=await pool.query(`SELECT DISTINCT s.id,s.student_number,s.full_name,c.id AS class_id,c.name AS class_name,c.level,p.school_code,p.intended_class,p.date_of_birth,p.gender,p.guardian_name,p.guardian_email,p.guardian_phone,p.student_email,p.address,p.health_condition_status,p.health_conditions,p.health_condition_other,p.has_allergies,p.allergies,p.allergy_other,p.doctor_name,p.doctor_clinic,p.doctor_phone,p.doctor_email,p.doctor_address,p.health_notes
    FROM students s LEFT JOIN portal_student_access a ON a.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id LEFT JOIN learner_profiles p ON p.student_id=s.id
    WHERE s.active=TRUE AND (($4::uuid IS NOT NULL AND s.id=$4::uuid) OR ($4::uuid IS NULL AND a.user_id=$1 AND ($2<>'student' OR LOWER(COALESCE(p.student_email,''))=LOWER($3)))) ORDER BY s.full_name`,[req.user.id,portalRole,req.user.email,managerPreview?requestedPreview:null]);
    const ids=r.rows.map(x=>x.id); let attendance=[],items=[],reports=[];
    if(ids.length){attendance=(await pool.query("SELECT student_id,attendance_date,status,note FROM learner_attendance WHERE student_id=ANY($1::uuid[]) ORDER BY attendance_date DESC LIMIT 120",[ids])).rows;items=(await pool.query("SELECT id,class_id,student_id,kind,title,details,due_date,resource_url,created_at FROM learner_learning_items WHERE published=TRUE AND (student_id=ANY($1::uuid[]) OR class_id=ANY($2::uuid[])) ORDER BY created_at DESC LIMIT 200",[ids,r.rows.map(x=>x.class_id).filter(Boolean)])).rows;
      const mr=await pool.query(`SELECT se.id AS session_id,se.academic_year,se.term,se.status,st.id AS student_id,sj.id AS subject_id,sj.name AS subject_name,sp.id AS paper_id,sp.paper_name,sp.paper_order,sp.maximum_mark,epm.obtained_mark
      FROM students st JOIN examination_marks em ON em.student_id=st.id JOIN academic_sessions se ON se.id=em.session_id AND se.status='published' JOIN subjects sj ON sj.id=em.subject_id LEFT JOIN subject_papers sp ON sp.subject_id=sj.id LEFT JOIN examination_paper_marks epm ON epm.examination_mark_id=em.id AND epm.subject_paper_id=sp.id WHERE st.id=ANY($1::uuid[]) ORDER BY se.academic_year DESC,se.term,sj.name,sp.paper_order`,[ids]);const sessions=new Map();for(const x of mr.rows){const k=`${x.student_id}:${x.session_id}`;if(!sessions.has(k))sessions.set(k,{studentId:x.student_id,year:x.academic_year,term:x.term,level:r.rows.find(y=>y.id===x.student_id)?.level,subjects:new Map()});const s=sessions.get(k);if(!s.subjects.has(x.subject_id))s.subjects.set(x.subject_id,{id:x.subject_id,name:x.subject_name,papers:[]});if(x.paper_id)s.subjects.get(x.subject_id).papers.push({id:x.paper_id,name:x.paper_name,order:x.paper_order,maximum:Number(x.maximum_mark),obtained:x.obtained_mark===null?null:Number(x.obtained_mark)});}for(const s of sessions.values()){const subjects=[...s.subjects.values()];const marks=Object.fromEntries(subjects.map(subject=>[subject.id,{papers:Object.fromEntries(subject.papers.filter(p=>p.obtained!==null).map(p=>[p.id,p.obtained]))}]));const calculated=markingCalculations.calculateStudent({id:s.studentId,marks},subjects,s.level);const rankingProfile=s.level==="secondary"?markingCalculations.secondaryRankProfile(calculated):null;reports.push({studentId:s.studentId,year:s.year,term:s.term,level:s.level,subjects:calculated.results.map(item=>({id:item.subject.id,name:item.subject.name,papers:item.papers.map(p=>({id:p.id,name:p.name,maximum:p.maximum,obtained:p.obtained,complete:p.complete})),obtained:item.obtained,maximum:item.maximum,percentage:item.percentage,units:item.units,grade:item.grade,status:item.status,complete:item.complete})),summary:{obtained:calculated.obtained,maximum:calculated.maximum,percentage:calculated.percentage,marksComplete:calculated.marksComplete,totalUnits:calculated.totalUnits,passedSubjects:calculated.passedSubjects,rankingProfile}});}}
    const scheduleRows=await pool.query("SELECT state_key,value FROM site_state WHERE state_key=ANY($1::text[])",[["dipvtc_online_timetable","dipvtc_campus_timetable","dipvtc_calendar"]]);const schedules=Object.fromEntries(scheduleRows.rows.map(x=>[x.state_key,x.value]));res.setHeader("Cache-Control","no-store");const visibleStudents=r.rows.map(x=>{if(portalRole==="student"){const y={...x};for(const k of ["health_condition_status","health_conditions","health_condition_other","has_allergies","allergies","allergy_other","doctor_name","doctor_clinic","doctor_phone","doctor_email","doctor_address","health_notes"])delete y[k];return y;}return x;});res.json({students:visibleStudents,attendance,items,reports,schedules,user:{name:req.user.display_name,role:portalRole,preview:managerPreview}});
  }catch(e){next(e);}});

app.post("/api/auth/password-reset/request",async(req,res,next)=>{try{const email=String(req.body?.email||"").trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254)await pool.query("INSERT INTO password_reset_requests(email) SELECT $1 WHERE EXISTS(SELECT 1 FROM app_users WHERE email=$1 AND active=TRUE) ON CONFLICT DO NOTHING",[email]);res.json({ok:true,message:"If the account is eligible, verified school staff will review your request and arrange password help."});}catch(e){next(e);}});
app.get("/api/admin/password-reset/requests",requireRole("owner","admin","admissions"),async(_req,res,next)=>{try{const r=await pool.query("SELECT id,email,created_at,status FROM password_reset_requests WHERE status='pending' ORDER BY created_at");res.json({requests:r.rows});}catch(e){next(e);}});
app.post("/api/admin/password-reset/:id/issue",requireRole("owner","admin","admissions"),async(req,res,next)=>{const client=await pool.connect();try{await client.query("BEGIN");const q=await client.query("SELECT * FROM password_reset_requests WHERE id=$1 AND status='pending' FOR UPDATE",[req.params.id]);if(!q.rowCount)throw Object.assign(new Error("Request is no longer pending."),{status:404});const u=await client.query("SELECT id,email,display_name,role FROM app_users WHERE email=$1 AND active=TRUE",[q.rows[0].email]);if(!u.rowCount)throw Object.assign(new Error("No active account matches this email."),{status:404});const raw=crypto.randomBytes(32).toString("base64url");await client.query("UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",[u.rows[0].id]);const tokenRow=await client.query("INSERT INTO password_reset_tokens(user_id,token_hash,issued_by,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '1 hour') RETURNING expires_at",[u.rows[0].id,crypto.createHash("sha256").update(raw).digest("hex"),req.user.id]);await client.query("UPDATE password_reset_requests SET status='issued',resolved_by=$2,resolved_at=NOW() WHERE id=$1",[req.params.id,req.user.id]);await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'password-reset-issued',$2)",[req.user.id,q.rows[0].email]);await client.query("COMMIT");try{await mailer.sendAccountEmail({to:u.rows[0].email,name:u.rows[0].display_name,role:u.rows[0].role,kind:"password-reset",expiresAt:tokenRow.rows[0].expires_at,url:publicUrl(req,`/password-reset.html?token=${encodeURIComponent(raw)}`)});res.json({emailSent:true});}catch(mailError){await pool.query("UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL AND created_at>NOW()-INTERVAL '2 minutes'",[u.rows[0].id]).catch(()=>{});await pool.query("UPDATE password_reset_requests SET status='pending',resolved_by=NULL,resolved_at=NULL WHERE id=$1",[req.params.id]).catch(()=>{});console.warn("Password reset email failed:",mailError.code||"SMTP error");res.status(503).json({error:"The password-reset email could not be sent. Check email settings and try again."});}}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});
app.post("/api/auth/password-reset/complete",async(req,res,next)=>{const token=String(req.body?.token||""),pass=req.body?.password;if(!token||token.length>100||!validPassword(pass))return res.status(400).json({error:"Use a valid reset link and a password with at least 10 characters."});const client=await pool.connect();try{await client.query("BEGIN");const hash=crypto.createHash("sha256").update(token).digest("hex");const r=await client.query("SELECT id,user_id FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE",[hash]);if(!r.rowCount)throw Object.assign(new Error("This reset link is invalid, expired or already used."),{status:404});await client.query("UPDATE app_users SET password_hash=$2,updated_at=NOW() WHERE id=$1",[r.rows[0].user_id,await passwordHash(pass)]);await client.query("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1",[r.rows[0].id]);await client.query("DELETE FROM app_sessions WHERE user_id=$1",[r.rows[0].user_id]);await client.query("INSERT INTO app_audit_log(user_id,action) VALUES($1,'password-reset-complete')",[r.rows[0].user_id]);await client.query("COMMIT");res.json({ok:true});}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});

app.post("/api/portal/attendance",requireRole("owner","admin","principal","teacher","admissions"),async(req,res,next)=>{const date=String(req.body?.date||"");const rows=req.body?.entries;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(rows)||rows.length>500)return res.status(400).json({error:"Provide a valid date and attendance list."});const client=await pool.connect();try{await client.query("BEGIN");const responsibilities=[req.user.role,...await assignedRoleCodesForUser(req.user)];for(const x of rows){if(!/^[0-9a-f-]{36}$/i.test(String(x.studentId||""))||!["present","absent","late","excused"].includes(x.status))continue;if(responsibilities.some(role=>["teacher","admissions","principal"].includes(role))&&!responsibilities.includes("principal")&&!/^(all sections?|whole school)$/i.test(String(req.user.section||""))){const scope=await client.query("SELECT c.name FROM students s JOIN classes c ON c.id=s.class_id WHERE s.id=$1",[x.studentId]);if(!scope.rowCount||scope.rows[0].name.toLowerCase()!==String(req.user.section||"").toLowerCase())continue;}await client.query(`INSERT INTO learner_attendance(student_id,attendance_date,status,note,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,recorded_by=EXCLUDED.recorded_by`,[x.studentId,date,x.status,String(x.note||"").slice(0,500),req.user.id]);}await client.query("COMMIT");res.json({ok:true});}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});
app.get("/api/portal/manage-data",requireRole("owner","admin","principal","teacher","admissions"),async(req,res,next)=>{try{const responsibilities=[req.user.role,...await assignedRoleCodesForUser(req.user)];const section=responsibilities.includes("principal")||/^(all sections?|whole school)$/i.test(String(req.user.section||""))?null:req.user.section;const [classes,learners]=await Promise.all([pool.query("SELECT id,level,name FROM classes WHERE $1::text IS NULL OR LOWER(name)=LOWER($1) ORDER BY level,name",[section]),pool.query(`SELECT s.id,s.student_number,s.full_name,s.class_id,c.name AS class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.active=TRUE AND ($1::text IS NULL OR LOWER(c.name)=LOWER($1)) ORDER BY c.name,s.full_name`,[section])]);res.json({classes:classes.rows,learners:learners.rows});}catch(e){next(e);}});
app.post("/api/portal/items",requireRole("owner","admin","principal","teacher"),async(req,res,next)=>{const b=req.body||{},kind=String(b.kind||""),title=String(b.title||"").trim().slice(0,180),details=String(b.details||"").slice(0,8000),url=String(b.resourceUrl||"").trim().slice(0,1000),studentId=String(b.studentId||"");if(!["lesson","assignment","resource","announcement"].includes(kind)||title.length<2||(!b.classId&&!studentId))return res.status(400).json({error:"Select a class or learner and provide a title and item type."});if(url&&!/^https:\/\//i.test(url))return res.status(400).json({error:"Resource links must use HTTPS."});try{const responsibilities=[req.user.role,...await assignedRoleCodesForUser(req.user)];if(responsibilities.some(role=>["teacher","principal"].includes(role))&&b.classId){const c=await pool.query("SELECT name FROM classes WHERE id=$1",[b.classId]);if(!c.rowCount||(!responsibilities.includes("principal")&&!/^(all sections?|whole school)$/i.test(String(req.user.section||""))&&c.rows[0].name.toLowerCase()!==String(req.user.section||"").toLowerCase()))return res.status(403).json({error:"This teacher is outside the assigned class scope."});}const r=await pool.query("INSERT INTO learner_learning_items(class_id,student_id,kind,title,details,due_date,resource_url,published,created_by) VALUES($1,$2,$3,$4,$5,NULLIF($6,'')::date,$7,$8,$9) RETURNING id",[b.classId||null,studentId||null,kind,title,details,String(b.dueDate||""),url,b.published!==false,req.user.id]);res.status(201).json({id:r.rows[0].id});}catch(e){next(e);}});

app.post("/api/team/invites", requireRole("owner","admin"), async (req, res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const displayName = String(req.body?.name || "").trim().slice(0, 180);
  const section = String(req.body?.section || "All Sections").trim().slice(0, 120) || "All Sections";
  const roleDetails = roleDetailsForInvite(req.body?.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !displayName || !roleDetails) {
    return res.status(400).json({ error: "Enter a valid email, name, and staff role." });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingUser = await client.query("SELECT 1 FROM app_users WHERE email=$1", [email]);
    if (existingUser.rowCount) throw Object.assign(new Error("An account already uses this email."), { status: 409 });
    await client.query("DELETE FROM app_invites WHERE LOWER(email)=$1 AND accepted_at IS NULL", [email]);
    const inserted = await client.query(
      `INSERT INTO app_invites(email,display_name,role,role_title,section,token_hash,invited_by,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '7 days') RETURNING id,expires_at`,
      [email, displayName, roleDetails.role, roleDetails.title, section, tokenHash, req.user.id]
    );
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'staff-invite',$2)", [req.user.id, email]);
    await client.query("COMMIT");
    try {
      await mailer.sendAccountEmail({ to: email, name: displayName, role: roleDetails.title, kind: "activation", expiresAt: inserted.rows[0].expires_at, url: publicUrl(req, `/activate.html?token=${encodeURIComponent(token)}`) });
    } catch (mailError) {
      await pool.query("DELETE FROM app_invites WHERE id=$1 AND accepted_at IS NULL", [inserted.rows[0].id]).catch(() => {});
      return res.status(503).json({ error: "The invitation email could not be sent. Check the email settings and try again." });
    }
    res.status(201).json({ id: inserted.rows[0].id, email, name: displayName, role: roleDetails.role, roleTitle: roleDetails.title, section, expiresAt: inserted.rows[0].expires_at, emailSent: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.get("/api/team/invite-status", async (req, res, next) => {
  try {
    const token = String(req.query?.token || "");
    if (!token || token.length > 100) return res.status(400).json({ error: "This invitation link is invalid." });
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const result = await pool.query(
      "SELECT email,display_name,role,role_title,section,expires_at FROM app_invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW()",
      [tokenHash]
    );
    const invite = result.rows[0];
    if (!invite) return res.status(404).json({ error: "This invitation link is invalid, expired, or already used." });
    res.setHeader("Cache-Control", "no-store");
    res.json({ email: invite.email, name: invite.display_name, role: invite.role, roleTitle: invite.role_title, section: invite.section, expiresAt: invite.expires_at });
  } catch (error) { next(error); }
});

app.post("/api/team/activate", async (req, res, next) => {
  const token = String(req.body?.token || "");
  const password = req.body?.password;
  if (!token || token.length > 100 || !validPassword(password)) return res.status(400).json({ error: "Use a valid invite link and a password with at least 10 characters." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inviteResult = await client.query(
      "SELECT * FROM app_invites WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW() FOR UPDATE",
      [tokenHash]
    );
    const invite = inviteResult.rows[0];
    if (!invite) throw Object.assign(new Error("This invitation link is invalid, expired, or already used."), { status: 404 });
    const created = await client.query(
      `INSERT INTO app_users(email,display_name,role,role_title,section,password_hash)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,email,display_name,role,role_title,section`,
      [invite.email, invite.display_name, invite.role, invite.role_title, invite.section, await passwordHash(password)]
    );
    const user = created.rows[0];
    await client.query("UPDATE app_invites SET accepted_at=NOW() WHERE id=$1", [invite.id]);
    const teamState = await client.query("SELECT value FROM site_state WHERE state_key='dipvtc_team' FOR UPDATE");
    if (teamState.rows[0]) {
      let team;
      try { team = typeof teamState.rows[0].value === "string" ? JSON.parse(teamState.rows[0].value) : teamState.rows[0].value; } catch { team = []; }
      if (Array.isArray(team)) {
        team = team.map(member => String(member.email || "").toLowerCase() === user.email ? { ...member, status: "active" } : member);
        await client.query("UPDATE site_state SET value=$1::jsonb,updated_at=NOW() WHERE state_key='dipvtc_team'", [JSON.stringify(team)]);
      }
    }
    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const sessionHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    await client.query("INSERT INTO app_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')", [user.id, sessionHash]);
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'staff-activation',$2)", [user.id, user.role_title]);
    await client.query("COMMIT");
    setSessionCookie(res, sessionToken);
    res.status(201).json({ ok: true, redirect: "/staff.html" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const token = readCookie(req, cookieName);
    if (token) {
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      await pool.query("DELETE FROM app_sessions WHERE token_hash=$1", [hash]);
    }
    clearSessionCookie(res); res.json({ ok: true });
  } catch (error) { next(error); }
});
app.get("/api/auth/logout", async (req, res, next) => {
  try {
    const token = readCookie(req, cookieName);
    if (token) await pool.query("DELETE FROM app_sessions WHERE token_hash=$1", [crypto.createHash("sha256").update(token).digest("hex")]);
    clearSessionCookie(res);
    res.redirect("/");
  } catch (error) { next(error); }
});
app.post("/api/auth/password", requireRole("owner"), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!validPassword(newPassword)) return res.status(400).json({ error: "Use a new password with at least 10 characters." });
    const result = await pool.query("SELECT password_hash FROM app_users WHERE id=$1", [req.user.id]);
    if (!await passwordMatches(String(currentPassword || ""), result.rows[0]?.password_hash)) return res.status(401).json({ error: "Current password is incorrect." });
    await pool.query("UPDATE app_users SET password_hash=$2,updated_at=NOW() WHERE id=$1", [req.user.id, await passwordHash(newPassword)]);
    await pool.query("INSERT INTO app_audit_log(user_id,action) VALUES($1,'password-change')", [req.user.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/state", requireRole("owner", "admin", ...STAFF_ROLE_CODES), async (req, res, next) => {
  try { const scopedUser={...req.user,assignedRoles:await assignedRoleNamesForUser(req.user)};res.setHeader("Cache-Control", "no-store"); res.json({ state: stateWithIdentity(filterStaffState(await stateSnapshot(await keysForUser(scopedUser)), scopedUser), scopedUser), user: scopedUser }); }
  catch (error) { next(error); }
});
app.put("/api/state/batch", requireRole("owner", "admin", ...STAFF_ROLE_CODES), async (req, res, next) => {
  const entries = req.body?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries) || Object.keys(entries).length > 120) {
    return res.status(400).json({ error: "Invalid state update." });
  }
  const allowed = await allowedKeysForUser(req.user);
  const invalid = Object.keys(entries).find(key => !allowed.has(key));
  if (invalid) return res.status(403).json({ error: `This account cannot update ${invalid}.` });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of Object.entries(entries)) {
      if (value === null) await client.query("DELETE FROM site_state WHERE state_key=$1", [key]);
      else {
        if (typeof value !== "string" || value.length > 2_000_000) throw Object.assign(new Error("Invalid or oversized state value."), { status: 413 });
        await client.query(
          `INSERT INTO site_state(state_key,value,updated_by,updated_at) VALUES($1,$2::jsonb,$3,NOW())
           ON CONFLICT(state_key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
          [key, JSON.stringify(value), req.user.id]
        );
        if (key === "dipvtc_enquiries") {
          let list;
          try { list = JSON.parse(value); } catch { throw Object.assign(new Error("Invalid enquiry list."), { status: 400 }); }
          if (!Array.isArray(list) || list.length > 10000) throw Object.assign(new Error("Invalid enquiry list."), { status: 400 });
          await client.query("DELETE FROM website_enquiries");
          for (const item of list) {
            const fullName = String(item?.name || "").trim().slice(0, 150);
            const email = String(item?.email || "").trim().toLowerCase().slice(0, 254);
            const course = String(item?.course || "General enquiry").trim().slice(0, 120);
            if (fullName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
            const createdAt = item.date && !Number.isNaN(Date.parse(item.date)) ? new Date(item.date) : new Date();
            await client.query("INSERT INTO website_enquiries(full_name,email,course,message,status,created_at) VALUES($1,$2,$3,$4,$5,$6)", [fullName, email, course || "General enquiry", String(item.message || "").slice(0, 8000), String(item.status || "Pending").slice(0, 30), createdAt]);
          }
        }
      }
      await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'state-write',$2)", [req.user.id, key]);
    }
    await client.query("COMMIT");
    res.json({ ok: true, saved: Object.keys(entries).length });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.get("/api/admin/campus-inspection",requireRole("owner","admin"),async(_req,res,next)=>{try{
  // Keep staff/tasks available even if an optional KPI table is unavailable on an older deployment.
  const [usersResult,stateResult,activityResult]=await Promise.all([
    pool.query("SELECT id,email,display_name,role,role_title,section,active,created_at FROM app_users WHERE role NOT IN ('owner','parent','student') ORDER BY active DESC,role,display_name"),
    pool.query("SELECT value FROM site_state WHERE state_key='dipvtc_tasks'"),
    pool.query("SELECT a.id,a.action,a.target_key,a.created_at,u.display_name,u.email,u.role FROM app_audit_log a LEFT JOIN app_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 150")
  ]);
  let tasks=stateResult.rows[0]?.value??[];if(typeof tasks==="string"){try{tasks=JSON.parse(tasks)}catch{tasks=[]}}if(!Array.isArray(tasks))tasks=[];const owners=await pool.query("SELECT LOWER(email) AS email FROM app_users WHERE role='owner'");const ownerEmails=new Set(owners.rows.map(row=>row.email));tasks=tasks.filter(task=>!ownerEmails.has(String(task.to||"").toLowerCase())&&String(task.assigneeRole||"").toLowerCase()!=="owner");
  let metrics={};try{const m=await pool.query("SELECT (SELECT COUNT(*)::int FROM students WHERE active=TRUE) AS active_learners,(SELECT COUNT(*)::int FROM student_registration_requests WHERE status IN ('pending','in_review')) AS pending_applications,(SELECT COUNT(*)::int FROM learner_attendance WHERE attendance_date=CURRENT_DATE) AS attendance_today,(SELECT COUNT(*)::int FROM app_invites WHERE accepted_at IS NULL AND expires_at>NOW()) AS pending_staff_invites");metrics=m.rows[0]||{};}catch(error){metrics={metricsUnavailable:true};console.warn("Campus overview KPI query unavailable:",error.message)}
  res.setHeader("Cache-Control","no-store");res.json({users:usersResult.rows,tasks,activities:activityResult.rows,metrics});
}catch(e){next(e);}});
app.get("/api/admin/teaching-assignments",requireRole("owner","admin"),async(_req,res,next)=>{try{
  const [staffResult,stateResult]=await Promise.all([
    pool.query("SELECT id,email,display_name,role,role_title,section,active FROM app_users WHERE role='teacher' ORDER BY active DESC,display_name,email"),
    pool.query("SELECT state_key,value FROM site_state WHERE state_key=ANY($1::text[])",[["dipvtc_subjects_image_boxes","dipvtc_course_teachers"]])
  ]);
  const values=Object.fromEntries(stateResult.rows.map(row=>[row.state_key,row.value]));
  const asArray=value=>{try{const parsed=typeof value==="string"?JSON.parse(value):value;return Array.isArray(parsed)?parsed:[]}catch{return[]}};
  const asObject=value=>{try{const parsed=typeof value==="string"?JSON.parse(value):value;return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}}catch{return{}}};
  res.setHeader("Cache-Control","no-store");res.json({teachers:staffResult.rows,subjects:asArray(values.dipvtc_subjects_image_boxes),assignments:asObject(values.dipvtc_course_teachers),roles:[...new Map([...STAFF_ROLE_LABELS.values()].map(role=>[role.title,role])).values()]});
}catch(error){next(error);}});
app.post("/api/admin/teaching-assignments",requireRole("owner","admin"),async(req,res,next)=>{
  const subject=String(req.body?.subject||"").trim().slice(0,180),email=String(req.body?.email||"").trim().toLowerCase();
  if(!subject||!email)return res.status(400).json({error:"Choose a subject and teacher."});
  const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(2010313)");
    const teacher=await client.query("SELECT email,display_name,role_title FROM app_users WHERE LOWER(email)=LOWER($1) AND role='teacher' AND active=TRUE",[email]);if(!teacher.rowCount)throw Object.assign(new Error("Choose an active teacher account."),{status:400});
    const state=await client.query("SELECT state_key,value FROM site_state WHERE state_key=ANY($1::text[]) FOR UPDATE",[["dipvtc_subjects_image_boxes","dipvtc_course_teachers"]]);const values=Object.fromEntries(state.rows.map(row=>[row.state_key,row.value]));
    const parse=(value,fallback)=>{try{return typeof value==="string"?JSON.parse(value):value}catch{return fallback}};const subjects=parse(values.dipvtc_subjects_image_boxes,[]);const exists=Array.isArray(subjects)&&subjects.some(item=>String(typeof item==="string"?item:item?.name||"").trim().toLowerCase()===subject.toLowerCase());if(!exists)throw Object.assign(new Error("That subject is no longer in the course list. Refresh and try again."),{status:409});
    const assignments=parse(values.dipvtc_course_teachers,{});const safeAssignments=assignments&&typeof assignments==="object"&&!Array.isArray(assignments)?assignments:{};safeAssignments[subject]={email:teacher.rows[0].email,name:teacher.rows[0].display_name,role:teacher.rows[0].role_title||"Teacher"};
    await client.query("INSERT INTO site_state(state_key,value,updated_by,updated_at) VALUES('dipvtc_course_teachers',$1::jsonb,$2,NOW()) ON CONFLICT(state_key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()",[JSON.stringify(safeAssignments),req.user.id]);await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'teacher-subject-assigned',$2)",[req.user.id,(subject+" → "+teacher.rows[0].email).slice(0,120)]);await client.query("COMMIT");res.json({ok:true,assignments:safeAssignments});
  }catch(error){await client.query("ROLLBACK").catch(()=>{});next(error);}finally{client.release();}
});
app.get("/api/admin/staff-role-assignments",requireRole("owner","admin"),async(_req,res,next)=>{try{
  const [staffResult,stateResult]=await Promise.all([pool.query("SELECT id,email,display_name,role,role_title,section,active FROM app_users WHERE role NOT IN ('owner','admin','parent','student') ORDER BY active DESC,display_name,email"),pool.query("SELECT state_key,value FROM site_state WHERE state_key=ANY($1::text[])",[["dipvtc_roles_v2","dipvtc_staff_role_assignments"]])]);
  const values=Object.fromEntries(stateResult.rows.map(row=>[row.state_key,row.value]));const parse=(value,fallback)=>{try{return typeof value==="string"?JSON.parse(value):value}catch{return fallback}};const profiles=parse(values.dipvtc_roles_v2,null);const sourceProfiles=profiles&&typeof profiles==="object"&&!Array.isArray(profiles)?profiles:Object.fromEntries([...new Map([...STAFF_ROLE_LABELS.values()].map(role=>[role.title,role])).keys()].map(name=>[name,{desc:"Staff responsibility",duties:[]}]));const safeProfiles=Object.fromEntries(Object.entries(sourceProfiles).filter(([name])=>STAFF_ROLE_LABELS.has(name.toLowerCase())));const assignments=parse(values.dipvtc_staff_role_assignments,{});res.setHeader("Cache-Control","no-store");res.json({staff:staffResult.rows,profiles:safeProfiles,assignments:assignments&&typeof assignments==="object"&&!Array.isArray(assignments)?assignments:{},positions:[...new Map([...STAFF_ROLE_LABELS.values()].map(role=>[role.title,role])).values()]});
}catch(error){next(error);}});
app.put("/api/admin/staff-role-assignments",requireRole("owner","admin"),async(req,res,next)=>{
  const email=String(req.body?.email||"").trim().toLowerCase(),roles=Array.isArray(req.body?.roles)?[...new Set(req.body.roles.map(value=>String(value).trim()).filter(Boolean))].slice(0,20):null;if(!email||!roles)return res.status(400).json({error:"Choose a staff member and at least an empty role selection."});
  const client=await pool.connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(2010314)");const member=await client.query("SELECT id,email,display_name,role,role_title,section,active FROM app_users WHERE LOWER(email)=LOWER($1) AND active=TRUE AND role NOT IN ('owner','admin','parent','student')",[email]);if(!member.rowCount)throw Object.assign(new Error("Choose an active staff account. Owner, Admin, Parent and Student accounts cannot be assigned staff responsibilities."),{status:400});
    const profileRow=await client.query("SELECT value FROM site_state WHERE state_key='dipvtc_roles_v2'");let profiles=profileRow.rows[0]?.value??{};if(typeof profiles==="string"){try{profiles=JSON.parse(profiles)}catch{profiles={}}}if(!profiles||typeof profiles!=="object"||Array.isArray(profiles))profiles={};const validProfiles=Object.keys(profiles).filter(name=>STAFF_ROLE_LABELS.has(name.toLowerCase()));const invalid=roles.find(role=>!validProfiles.includes(role));if(invalid)throw Object.assign(new Error("Select roles from the current Owner role list."),{status:400});
    const assignmentRow=await client.query("SELECT value FROM site_state WHERE state_key='dipvtc_staff_role_assignments' FOR UPDATE");let assignments=assignmentRow.rows[0]?.value??{};if(typeof assignments==="string"){try{assignments=JSON.parse(assignments)}catch{assignments={}}}if(!assignments||typeof assignments!=="object"||Array.isArray(assignments))assignments={};assignments[member.rows[0].email.toLowerCase()]=roles;
    await client.query("INSERT INTO site_state(state_key,value,updated_by,updated_at) VALUES('dipvtc_staff_role_assignments',$1::jsonb,$2,NOW()) ON CONFLICT(state_key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()",[JSON.stringify(assignments),req.user.id]);await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'staff-responsibilities-updated',$2)",[req.user.id,(member.rows[0].email+" → "+(roles.join(", ")||"no additional roles")).slice(0,120)]);await client.query("COMMIT");res.json({ok:true,email:member.rows[0].email,roles});
  }catch(error){await client.query("ROLLBACK").catch(()=>{});next(error);}finally{client.release();}
});
app.get("/api/staff/teaching-assignments",requireRole("teacher"),async(req,res,next)=>{try{
  const result=await pool.query("SELECT value FROM site_state WHERE state_key='dipvtc_course_teachers'");let assignments=result.rows[0]?.value??{};if(typeof assignments==="string"){try{assignments=JSON.parse(assignments)}catch{assignments={}}}if(!assignments||typeof assignments!=="object"||Array.isArray(assignments))assignments={};const subjects=Object.entries(assignments).filter(([,person])=>String(person?.email||"").toLowerCase()===req.user.email.toLowerCase()).map(([subject])=>subject);res.setHeader("Cache-Control","no-store");res.json({subjects});
}catch(error){next(error);}});
app.post("/api/admin/campus-tasks",requireRole("owner","admin"),async(req,res,next)=>{
  const b=req.body||{},to=String(b.to||"").trim().toLowerCase(),title=String(b.title||"").trim().slice(0,180),course=String(b.course||"Campus-wide").trim().slice(0,120),details=String(b.details||"").trim().slice(0,3000),deadline=String(b.deadline||"").trim();
  if(!to||title.length<3)return res.status(400).json({error:"Choose a staff member and enter a task title."});if(deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline))return res.status(400).json({error:"Enter a valid deadline."});
  const client=await pool.connect();try{await client.query("BEGIN");const user=await client.query("SELECT email,display_name,role,role_title,section FROM app_users WHERE LOWER(email)=LOWER($1) AND active=TRUE AND role NOT IN ('owner','parent','student')",[to]);if(!user.rowCount)throw Object.assign(new Error("Select an active staff or Admin account. The Owner is not assigned tasks."),{status:400});await client.query("SELECT pg_advisory_xact_lock(2010312)");const saved=await client.query("SELECT value FROM site_state WHERE state_key='dipvtc_tasks' FOR UPDATE");let tasks=saved.rows[0]?.value??[];if(typeof tasks==="string"){try{tasks=JSON.parse(tasks)}catch{tasks=[]}}if(!Array.isArray(tasks))tasks=[];
    const task={id:crypto.randomUUID(),to:user.rows[0].email,title,course,details,deadline,status:"assigned",assignedAt:new Date().toISOString(),assignedBy:req.user.email,assignedByName:req.user.display_name,assignedByRole:req.user.role,assigneeName:user.rows[0].display_name,assigneeRole:user.rows[0].role_title||user.rows[0].role,assigneeSection:user.rows[0].section,source:"campus-admin",requireCompletionNote:true};tasks.push(task);
    await client.query("INSERT INTO site_state(state_key,value,updated_by,updated_at) VALUES('dipvtc_tasks',$1::jsonb,$2,NOW()) ON CONFLICT(state_key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()",[JSON.stringify(tasks),req.user.id]);await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'campus-task-assigned',$2)",[req.user.id,(task.id+': '+title).slice(0,120)]);await client.query("COMMIT");res.status(201).json({task});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});
app.post("/api/staff/tasks/:taskId/complete", requireRole("admin",...STAFF_ROLE_CODES), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT value FROM site_state WHERE state_key='dipvtc_tasks' FOR UPDATE");
    let tasks = [];
    if (result.rows[0]) {
      try { tasks = typeof result.rows[0].value === "string" ? JSON.parse(result.rows[0].value) : result.rows[0].value; } catch { tasks = []; }
    }
    if (!Array.isArray(tasks)) tasks = [];
    const task = tasks.find(item => String(item.id) === String(req.params.taskId) && String(item.to || "").toLowerCase() === req.user.email.toLowerCase());
    if (!task) throw Object.assign(new Error("That task is not assigned to your account."), { status: 404 });
    const completionNote=String(req.body?.note||"").trim().slice(0,2000);
    if(task.requireCompletionNote&&!completionNote)throw Object.assign(new Error("Add a short completion note before closing this task."),{status:400});
    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.completedNote = completionNote;
    task.completedBy = req.user.email;
    await client.query(
      `INSERT INTO site_state(state_key,value,updated_by,updated_at) VALUES('dipvtc_tasks',$1::jsonb,$2,NOW())
       ON CONFLICT(state_key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,
      [JSON.stringify(tasks), req.user.id]
    );
    await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'task-complete',$2)", [req.user.id, String(task.title||task.id).slice(0,120)]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});

app.get("/api/staff/marking", requireRole("teacher", "principal"), async (req, res, next) => {
  try {
    const sessionsResult = await pool.query(
      "SELECT id,academic_year,term,status,created_at FROM academic_sessions ORDER BY academic_year DESC,created_at DESC"
    );
    const sessions = sessionsResult.rows.map(row => ({ id: row.id, year: row.academic_year, term: row.term, status: row.status }));
    if (!sessions.length) return res.json({ sessions: [], selectedSession: null, classes: [] });
    const requested = String(req.query.sessionId || "");
    const selectedSession = sessions.find(item => item.id === requested) || sessions[0];
    const responsibilities=[req.user.role,...await assignedRoleCodesForUser(req.user)];const section = responsibilities.includes("principal")||/^(all sections?|whole school)$/i.test(String(req.user.section || "")) ? null : req.user.section;
    const requestedClass = /^[0-9a-f-]{36}$/i.test(String(req.query.classId || "")) ? String(req.query.classId) : null;
    const result = await pool.query(
      `SELECT c.id AS class_id,c.name AS class_name,c.level,
              st.id AS student_id,st.student_number,st.full_name,
              sj.id AS subject_id,sj.name AS subject_name,
              sp.id AS paper_id,sp.paper_order,sp.paper_name,sp.maximum_mark,
              epm.obtained_mark
       FROM classes c
       LEFT JOIN students st ON st.class_id=c.id AND st.active=TRUE
       LEFT JOIN subjects sj ON sj.level=c.level AND sj.active=TRUE AND (sj.class_id IS NULL OR sj.class_id=c.id)
       LEFT JOIN subject_papers sp ON sp.subject_id=sj.id
       LEFT JOIN examination_marks em ON em.session_id=$1 AND em.student_id=st.id AND em.subject_id=sj.id
       LEFT JOIN examination_paper_marks epm ON epm.examination_mark_id=em.id AND epm.subject_paper_id=sp.id
       WHERE ($2::text IS NULL OR LOWER(c.name)=LOWER($2)) AND ($3::uuid IS NULL OR c.id=$3::uuid)
       ORDER BY c.level,c.name,st.full_name,sj.name,sp.paper_order`,
      [selectedSession.id, section, requestedClass]
    );
    const classMap = new Map();
    for (const row of result.rows) {
      if (!classMap.has(row.class_id)) classMap.set(row.class_id, { id: row.class_id, name: row.class_name, level: row.level, students: new Map(), subjects: new Map() });
      const cls = classMap.get(row.class_id);
      if (!row.subject_id) continue;
      if (!cls.subjects.has(row.subject_id)) cls.subjects.set(row.subject_id, { id: row.subject_id, name: row.subject_name, papers: [] });
      const subject = cls.subjects.get(row.subject_id);
      if (row.paper_id && !subject.papers.some(paper => paper.id === row.paper_id)) {
        subject.papers.push({ id: row.paper_id, name: row.paper_name, maximum: Number(row.maximum_mark), order: row.paper_order });
      }
      if (!row.student_id) continue;
      if (!cls.students.has(row.student_id)) cls.students.set(row.student_id, { id: row.student_id, studentNumber: row.student_number, name: row.full_name, marks: {} });
      const student = cls.students.get(row.student_id);
      if (row.paper_id) {
        if (!student.marks[row.subject_id]) student.marks[row.subject_id] = { papers: {} };
        if (row.obtained_mark !== null) student.marks[row.subject_id].papers[row.paper_id] = Number(row.obtained_mark);
      }
    }
    const classes = [...classMap.values()].map(cls => {
      const subjects = [...cls.subjects.values()].filter(subject => subject.papers.length).map(subject => ({ ...subject, papers: subject.papers.sort((a,b) => a.order-b.order) }));
      const calculated = [...cls.students.values()].map(student => markingCalculations.calculateStudent(student, subjects, cls.level));
      const ranked = markingCalculations.rankStudents(calculated, cls.level);
      const students = ranked.map(student => ({
        id: student.id, studentNumber: student.studentNumber, name: student.name, position: student.position,
        marksComplete: student.marksComplete, obtained: student.obtained, maximum: student.maximum,
        percentage: student.percentage, totalUnits: student.totalUnits, passedSubjects: student.passedSubjects,
        rankingProfile: student.rankingProfile || null,
        subjects: student.results.map(item => ({ id: item.subject.id, name: item.subject.name, obtained: item.obtained, maximum: item.maximum, percentage: item.percentage, units: item.units, grade: item.grade, status: item.status, complete: item.complete }))
      }));
      return { id: cls.id, name: cls.name, level: cls.level, subjectCount: subjects.length, students, studentCount: students.length, completedCount: students.filter(student => student.marksComplete).length };
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ sessions, selectedSession, classes });
  } catch (error) { next(error); }
});

app.post("/api/enquiries", async (req, res, next) => {
  try {
    const fullName = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const course = String(req.body?.course || "").trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (fullName.length < 2 || fullName.length > 150 || !emailValid || email.length > 254 || course.length > 120) {
      return res.status(400).json({ error: "Enter a valid name, email and course." });
    }
    await pool.query("INSERT INTO website_enquiries(full_name,email,course) VALUES($1,$2,$3)", [fullName, email, course || "General enquiry"]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/api/public/admission-options", (_req,res)=>res.json({schools:ADMISSION_SCHOOLS}));
app.post("/api/student-registrations",async(req,res,next)=>{
  const b=req.body||{};
  if(String(b.website||"").trim())return res.status(201).json({ok:true});
  const studentName=String(b.studentName||"").trim().slice(0,180),studentEmail=String(b.studentEmail||"").trim().toLowerCase(),password=b.password,schoolCode=String(b.schoolCode||""),className=String(b.className||"");
  const school=ADMISSION_SCHOOLS.find(x=>x.code===schoolCode),classChoice=school?.classes.find(x=>x.name===className);
  const guardianName=String(b.guardianName||"").trim().slice(0,180),guardianEmail=String(b.guardianEmail||"").trim().toLowerCase(),guardianPhone=String(b.guardianPhone||"").trim().slice(0,40),dateOfBirth=String(b.dateOfBirth||"").trim(),notes=String(b.notes||"").trim().slice(0,1500);
  if(studentName.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)||studentEmail.length>254||!validPassword(password)||!school||!classChoice||guardianEmail&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)||guardianEmail.length>254)||guardianName.length>180||guardianPhone.length>40||dateOfBirth&&!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))return res.status(400).json({error:"Complete the student email, password, learner name, school and intended class. Check optional guardian details too."});
  if(guardianEmail===studentEmail)return res.status(400).json({error:"Use the student’s own email in the student email field. A guardian can use a separate email."});
  const parsedHealth=parseHealthInformation(b);if(parsedHealth.error)return res.status(400).json({error:parsedHealth.error});const h=parsedHealth.value;
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const existing=await client.query("SELECT id,role,active FROM app_users WHERE LOWER(email)=$1 FOR UPDATE",[studentEmail]);
    if(existing.rowCount)throw Object.assign(new Error("This email already has an account or registration request. Use the portal sign-in or contact Admissions."),{status:409});
    const user=await client.query("INSERT INTO app_users(email,display_name,role,section,password_hash,active) VALUES($1,$2,'student','All Sections',$3,FALSE) RETURNING id",[studentEmail,studentName,await passwordHash(password)]);
    const studentNumber=await nextStudentNumber(client);
    const request=await client.query("INSERT INTO student_registration_requests(student_user_id,student_name,student_email,school_code,intended_class,academic_level,date_of_birth,guardian_name,guardian_email,guardian_phone,notes,student_number,health_condition_status,health_conditions,health_condition_other,has_allergies,allergies,allergy_other,doctor_name,doctor_clinic,doctor_phone,doctor_email,doctor_address,health_notes) VALUES($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id,student_number",
      [user.rows[0].id,studentName,studentEmail,school.code,classChoice.name,classChoice.academicLevel,dateOfBirth,guardianName,guardianEmail,guardianPhone,notes,studentNumber,h.healthConditionStatus,h.healthConditions,h.healthConditionOther,h.hasAllergies,h.allergies,h.allergyOther,h.doctorName,h.doctorClinic,h.doctorPhone,h.doctorEmail,h.doctorAddress,h.healthNotes]);
    await client.query("COMMIT");
    let emailSent=false;try{await mailer.sendRegistrationStatus({to:studentEmail,name:studentName,status:"pending",school:school.name,intendedClass:classChoice.name,studentNumber:studentNumber});emailSent=true;}catch(e){console.warn("Student application receipt email failed:",e.code||"email transport error");}
    res.status(201).json({ok:true,requestId:request.rows[0].id,studentNumber:request.rows[0].student_number,emailSent,message:"Registration submitted. Student number "+request.rows[0].student_number+". The student account will be available after Admissions approves the application."});
  }catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}
});
app.post("/api/registration-requests", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (String(b.website || "").trim()) return res.status(201).json({ ok: true });
    const guardianName = String(b.guardianName || "").trim();
    const guardianEmail = String(b.guardianEmail || "").trim().toLowerCase();
    const guardianPhone = String(b.guardianPhone || "").trim();
    const learnerName = String(b.learnerName || "").trim();
    const level = String(b.level || "").trim();
    const className = String(b.className || "").trim();
    const dateOfBirth = String(b.dateOfBirth || "").trim();
    const studentEmail = String(b.studentEmail || "").trim().toLowerCase();
    const notes = String(b.notes || "").trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail);
    const studentEmailValid = !studentEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail);
    const validDate = !dateOfBirth || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);
    if (guardianName.length < 2 || guardianName.length > 150 || !emailValid || guardianPhone.length < 5 || guardianPhone.length > 40 || learnerName.length < 2 || learnerName.length > 180 || !["Primary", "Secondary", "ECD", "Short course / vocational", "Not sure yet"].includes(level) || className.length > 100 || notes.length > 1500 || studentEmail.length > 254 || !studentEmailValid || !validDate) {
      return res.status(400).json({ error: "Please check the required family and learner details, then submit again." });
    }
    const course = `Registration request · ${level}${className ? ` · ${className}` : ""}`.slice(0, 120);
    const message = [
      "PUBLIC LEARNER REGISTRATION REQUEST",
      `Learner: ${learnerName}`,
      `Level: ${level}`,
      `Grade / form / course: ${className || "Not provided"}`,
      `Date of birth: ${dateOfBirth || "Not provided"}`,
      `Student email: ${studentEmail || "Not provided"}`,
      `Parent / guardian: ${guardianName}`,
      `Parent / guardian phone: ${guardianPhone}`,
      `Additional information: ${notes || "None"}`
    ].join("\n");
    await pool.query("INSERT INTO website_enquiries(full_name,email,course,message,status) VALUES($1,$2,$3,$4,'Registration Request')", [guardianName, guardianEmail, course, message]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

app.get("/server-storage.js", (_req, res) => res.sendFile(path.join(__dirname, "storage.js")));
app.get("/login.html", (_req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/portal-login.html", (_req,res)=>res.sendFile(path.join(publicRoot,"portal-login.html")));
app.get("/portal-register.html", (_req,res)=>res.sendFile(path.join(publicRoot,"portal-register.html")));
app.get("/password-help.html", (_req,res)=>res.sendFile(path.join(publicRoot,"password-help.html")));
app.get("/password-reset.html", (_req,res)=>res.sendFile(path.join(publicRoot,"password-reset.html")));
app.get("/registrations.html", requireRole("owner","admin","admissions"), async(req,res,next)=>{try{await renderHtml("registrations.html",req.user,res);}catch(e){next(e);}});
app.get("/registration-requests.html", requireRole("owner","admin","admissions"), async(req,res,next)=>{try{await renderHtml("registration-requests.html",req.user,res);}catch(e){next(e);}});
app.get("/learning.html", requireRole("owner","admin","principal","teacher","admissions"), async(req,res,next)=>{try{await renderHtml("learning.html",req.user,res);}catch(e){next(e);}});
app.get("/parent-portal.html", requireRole("parent","owner","admin"), async(req,res,next)=>{try{if(["owner","admin"].includes(req.user.role)&&(req.query.as!=="parent"||!/^[0-9a-f-]{36}$/i.test(String(req.query.previewStudentId||""))))return res.status(403).send("Open this portal from a learner’s read-only preview link.");await renderHtml("parent-portal.html",req.user,res);}catch(e){next(e);}});
app.get("/student-portal.html", requireRole("student","owner","admin"), async(req,res,next)=>{try{if(["owner","admin"].includes(req.user.role)&&(req.query.as!=="student"||!/^[0-9a-f-]{36}$/i.test(String(req.query.previewStudentId||""))))return res.status(403).send("Open this portal from a learner’s read-only preview link.");await renderHtml("student-portal.html",req.user,res);}catch(e){next(e);}});
app.get("/owner.html", requireRole("owner"), async (req, res, next) => { try { await renderHtml("owner.html", req.user, res); } catch (error) { next(error); } });
app.get("/admin.html", requireRole("owner", "admin"), async (req, res, next) => { try { await renderHtml("admin.html", req.user, res); } catch (error) { next(error); } });
app.get("/staff.html", requireRole("owner","admin",...STAFF_ROLE_CODES), async (req, res, next) => { try { await renderHtml("staff.html", req.user, res); } catch (error) { next(error); } });
app.get(/^\/exam-mark-entry$/, requireRole("teacher"), (_req, res) => res.redirect("/exam-mark-entry/"));
app.get("/exam-mark-entry/", requireRole("teacher"), async (req, res, next) => { try { await renderHtml("exam-mark-entry/index.html", req.user, res); } catch (error) { next(error); } });
const feePageRoles = ["owner", "finance"];
app.get("/fees.htm", requireRole(...feePageRoles), (_req, res) => res.redirect("/fees.html"));
app.get("/fees.html", requireRole(...feePageRoles), async (req, res, next) => { try { await renderHtml("assets/fees.html", req.user, res); } catch (error) { next(error); } });
app.get("/assets/fees.html", requireRole(...feePageRoles), async (req, res, next) => { try { await renderHtml("assets/fees.html", req.user, res); } catch (error) { next(error); } });
app.get("/", async (_req, res, next) => { try { await renderHtml("index.html", null, res); } catch (error) { next(error); } });
app.get("/index.html", async (_req, res, next) => { try { await renderHtml("index.html", null, res); } catch (error) { next(error); } });
app.get("/programs.html", async (_req, res, next) => { try { await renderHtml("programs.html", null, res); } catch (error) { next(error); } });
app.get("/courses.html", async (_req, res, next) => { try { await renderHtml("courses.html", null, res); } catch (error) { next(error); } });
app.get("/pathway.html", async (_req, res, next) => { try { await renderHtml("pathway.html", null, res); } catch (error) { next(error); } });
app.get("/about.html", async (_req, res, next) => { try { await renderHtml("about.html", null, res); } catch (error) { next(error); } });
app.get("/admission.html", async (_req, res, next) => { try { await renderHtml("admission.html", null, res); } catch (error) { next(error); } });
app.get("/news.html", async (_req, res, next) => { try { await renderHtml("news.html", null, res); } catch (error) { next(error); } });
app.get("/contact.html", async (_req, res, next) => { try { await renderHtml("contact.html", null, res); } catch (error) { next(error); } });
app.get("/cambridge.html", async (_req, res, next) => { try { await renderHtml("cambridge.html", null, res); } catch (error) { next(error); } });
app.get("/deityProFx.html", async (_req, res, next) => { try { await renderHtml("deityProFx.html", null, res); } catch (error) { next(error); } });
app.get("/practical.html", async (_req, res, next) => { try { await renderHtml("practical.html", null, res); } catch (error) { next(error); } });
app.get("/southafrica.html", async (_req, res, next) => { try { await renderHtml("southafrica.html", null, res); } catch (error) { next(error); } });
app.get("/upgrade.html", async (_req, res, next) => { try { await renderHtml("upgrade.html", null, res); } catch (error) { next(error); } });
app.get("/zimsec.html", async (_req, res, next) => { try { await renderHtml("zimsec.html", null, res); } catch (error) { next(error); } });
app.use(express.static(publicRoot, { dotfiles: "deny", index: false, fallthrough: true }));
app.use((_req, res) => res.status(404).send("Page not found."));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error.message);
  const status = Number(error.status) || 500;
  res.status(status).json({ error: status === 500 ? "The server could not complete this request." : error.message });
});

async function seedInitialAccounts() {
  const existing = await pool.query("SELECT COUNT(*)::int AS count FROM app_users WHERE role='owner'");
  if (existing.rows[0].count === 0 && process.env.INITIAL_OWNER_EMAIL && process.env.INITIAL_OWNER_PASSWORD) {
    if (!validPassword(process.env.INITIAL_OWNER_PASSWORD)) throw new Error("INITIAL_OWNER_PASSWORD must be at least 10 characters.");
    await pool.query(
      "INSERT INTO app_users(email,display_name,role,password_hash) VALUES($1,$2,'owner',$3) ON CONFLICT(email) DO NOTHING",
      [process.env.INITIAL_OWNER_EMAIL.trim().toLowerCase(), process.env.INITIAL_OWNER_NAME || "DIPVTC Owner", await passwordHash(process.env.INITIAL_OWNER_PASSWORD)]
    );
  }
  if (process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    if (!validPassword(process.env.INITIAL_ADMIN_PASSWORD)) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 10 characters.");
    await pool.query(
      "INSERT INTO app_users(email,display_name,role,section,password_hash) VALUES($1,$2,'admin',$3,$4) ON CONFLICT(email) DO NOTHING",
      [process.env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(), process.env.INITIAL_ADMIN_NAME || "School Administrator", process.env.INITIAL_ADMIN_SECTION || "All Sections", await passwordHash(process.env.INITIAL_ADMIN_PASSWORD)]
    );
  }
}

let server;
async function start() {
  try {
    await pool.query("SELECT 1 FROM app_users LIMIT 0");
    await seedInitialAccounts();
    server = app.listen(port, host, () => {
      console.log(`DIPVTC server listening at http://${host}:${port}`);
      console.log("Run npm run build:site after changing the website source files.");
    });
  } catch (error) {
    console.error("Server startup failed. Check DATABASE_URL and apply both SQL migrations:", error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
  }
}
start();
async function shutdown() {
  if (server) server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
