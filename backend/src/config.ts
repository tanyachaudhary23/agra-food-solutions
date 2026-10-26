import "dotenv/config";
import path from "node:path";
import crypto from "node:crypto";

const env = process.env;
const isProd = env.NODE_ENV === "production";
const port = Number(env.PORT || 4000);

let jwtSecret = env.JWT_SECRET || "";
if (!jwtSecret) {
  if (isProd) throw new Error("JWT_SECRET must be set in production (use a long random string).");
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn("[config] JWT_SECRET not set: using a temporary secret, so admin logins reset on every restart.");
}

const strip = (s: string) => s.trim().replace(/\/+$/, "");

export const config = {
  isProd,
  port,
  /** Folder holding the SQLite database and uploaded files. Must be on persistent storage in production. */
  dataDir: path.resolve(env.DATA_DIR || "./data"),
  /** Public URL of THIS backend, used to build absolute image links. */
  publicBaseUrl: strip(env.PUBLIC_BASE_URL || `http://localhost:${port}`),
  /** Website origins allowed to call this API (comma separated). */
  frontendOrigins: (env.FRONTEND_URL || "http://localhost:3000").split(",").map(strip).filter(Boolean),
  jwtSecret,
  adminEmail: env.ADMIN_EMAIL?.trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD,
  trustProxy: env.TRUST_PROXY !== undefined ? Number(env.TRUST_PROXY) : isProd ? 1 : 0,
  smtp: {
    host: env.SMTP_HOST || "",
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || "",
    pass: env.SMTP_PASS || "",
    from: env.ENQUIRY_FROM_EMAIL || "",
    to: env.ENQUIRY_TO_EMAIL || "",
  },
  turnstileSecret: env.TURNSTILE_SECRET_KEY || "",
};
