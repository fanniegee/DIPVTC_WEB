const nodemailer = require("nodemailer");

function configuration() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const fromAddress = String(process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || "").trim();
  if (!host || !fromAddress) throw Object.assign(new Error("Email delivery is not configured. Set SMTP_HOST and SMTP_FROM_ADDRESS in the project .env file."), { status: 503 });
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error("SMTP_PORT must be a valid port number."), { status: 503 });
  const options = { host, port, secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true", requireTLS: String(process.env.SMTP_REQUIRE_TLS || "true").toLowerCase() === "true", connectionTimeout: 15000, greetingTimeout: 12000, socketTimeout: 20000 };
  if (process.env.SMTP_USER) options.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" };
  if (options.auth && !options.auth.pass) throw Object.assign(new Error("SMTP_PASS is missing from the project .env file."), { status: 503 });
  return { options, fromAddress, fromName: String(process.env.SMTP_FROM_NAME || "Double Impact Private College").trim() };
}

function createTransport() {
  const config = configuration();
  return { transporter: nodemailer.createTransport(config.options), from: { name: config.fromName, address: config.fromAddress } };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

async function verify() {
  const { transporter } = createTransport();
  try { await transporter.verify(); return { ok: true }; }
  finally { transporter.close(); }
}

async function sendAccountEmail({ to, name, role, url, kind, expiresAt }) {
  const { transporter, from } = createTransport();
  const safeName = escapeHtml(name || "there");
  const safeRole = escapeHtml(role || "school portal");
  const safeUrl = escapeHtml(url);
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.SCHOOL_TIMEZONE || "Africa/Harare" }) : "within one hour";
  const reset = kind === "password-reset";
  const subject = reset ? "Reset your DIPVTC account password" : `Activate your DIPVTC ${role} account`;
  const action = reset ? "Set a new password" : "Activate your account";
  const heading = reset ? "Password reset requested" : "Your school portal is ready";
  const text = `Hello ${name || "there"},\n\n${reset ? "A school administrator has verified your password reset request." : `Admissions has prepared your ${role} account.`}\n\n${action}: ${url}\n\nThis secure link expires ${expiry}. If you did not expect this message, contact the school.\n\nDouble Impact Private College`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#172b49"><div style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #e1e8f1;border-radius:16px;overflow:hidden"><header style="padding:26px;background:#0a1931;color:#fff"><div style="font-size:12px;font-weight:bold;color:#ffbd82;letter-spacing:1px">DOUBLE IMPACT PRIVATE COLLEGE</div><h1 style="font-size:24px;margin:12px 0 0">${heading}</h1></header><main style="padding:26px"><p>Hello ${safeName},</p><p>${reset ? "A school administrator has verified your password reset request." : `Admissions has prepared your ${safeRole} account.`}</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;background:#e67e22;color:#fff;text-decoration:none;font-weight:bold;padding:13px 20px;border-radius:8px">${action}</a></p><p>This secure link expires ${escapeHtml(expiry)}. It can be used once.</p><p>If you did not expect this message, contact the school office.</p></main><footer style="padding:18px 26px;background:#f8fafc;color:#64748b;font-size:12px">Double Impact Private College</footer></div></body></html>`;
  try { const info = await transporter.sendMail({ from, to, subject, text, html }); return { messageId: info.messageId }; }
  finally { transporter.close(); }
}

async function sendTestEmail(to, name) {
  const { transporter, from } = createTransport();
  try {
    const info = await transporter.sendMail({
      from, to, subject: "DIPVTC website email delivery test",
      text: `Hello ${name || "DIPVTC Owner"},\n\nThis confirms the DIPVTC website can send email through its configured school mail server.\n\nDouble Impact Private College`,
      html: `<div style="font-family:Arial,sans-serif;color:#172b49;max-width:600px;margin:20px auto;padding:24px;border:1px solid #e1e8f1;border-radius:14px"><div style="color:#e67e22;font-weight:bold">DOUBLE IMPACT PRIVATE COLLEGE</div><h2 style="color:#0a1931">Email delivery is connected</h2><p>Hello ${escapeHtml(name || "DIPVTC Owner")},</p><p>This confirms that the website sent a message through the configured school mail server.</p></div>`
    });
    return { messageId: info.messageId };
  } finally { transporter.close(); }
}

async function sendRegistrationStatus({ to, name, status, school, intendedClass }) {
  const { transporter, from } = createTransport();
  const approved = status === "approved";
  const rejected = status === "rejected";
  const safeName = escapeHtml(name || "Student");
  const safeSchool = escapeHtml(school || "your selected school");
  const safeClass = escapeHtml(intendedClass || "your selected class");
  const subject = approved ? "DIPVTC student registration approved" : rejected ? "DIPVTC student application update" : "DIPVTC student application received";
  const message = approved
    ? `Admissions approved your application for ${school || "your selected school"} · ${intendedClass || "your selected class"}. You can now sign in to the Student Portal with the email and password you created during registration.`
    : rejected
      ? `Admissions reviewed your application for ${school || "your selected school"} · ${intendedClass || "your selected class"} and could not approve it. Please contact the school for details.`
      : `Admissions received your application for ${school || "your selected school"} · ${intendedClass || "your selected class"}. Your Student Portal account will open after Admissions reviews and approves the application.`;
  try {
    const info = await transporter.sendMail({
      from, to, subject,
      text: `Hello ${name || "Student"},\n\n${message}\n\nDouble Impact Private College`,
      html: `<div style="font-family:Arial,sans-serif;color:#172b49;max-width:600px;margin:20px auto;padding:24px;border:1px solid #e1e8f1;border-radius:14px"><div style="color:#e67e22;font-weight:bold">DOUBLE IMPACT PRIVATE COLLEGE</div><h2 style="color:#0a1931">${approved ? "Application approved" : rejected ? "Application update" : "Application received"}</h2><p>Hello ${safeName},</p><p>${approved ? "Admissions approved your application." : rejected ? "Admissions reviewed your application." : "Admissions received your application."}</p><p><b>School:</b> ${safeSchool}<br><b>Class / course:</b> ${safeClass}</p><p>${approved ? "You can now sign in to the Student Portal with the email and password you created during registration." : rejected ? "Please contact the Admissions Office for details." : "Your student account remains locked while Admissions reviews your application."}</p></div>`
    });
    return { messageId: info.messageId };
  } finally { transporter.close(); }
}

module.exports = { verify, sendAccountEmail, sendTestEmail, sendRegistrationStatus };
