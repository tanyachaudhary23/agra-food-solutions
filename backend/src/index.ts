import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { config } from "./config.js";
import { publicUploadDir, purgeExpiredEnquiries, purgeExpiredProducts } from "./db.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";
import { ensureAdmin, seedCatalogueIfEmpty } from "./seed.js";
import { mailConfigured } from "./mail.js";
import { fillMissingProductCodes } from "./products.js";

{ const n = fillMissingProductCodes(); if (n) console.log(`[codes] Gave ${n} product(s) without a code the next AFS number.`); }
if (seedCatalogueIfEmpty()) console.log("[seed] Loaded the catalogue (categories, products, images) into the new database.");
ensureAdmin();

// Recycle bin: enquiries deleted more than 30 days ago are removed for good (at startup, then hourly).
const purge = () => {
  try {
    const p = purgeExpiredProducts();
    if (p) console.log(`[trash] Permanently removed ${p} product(s) deleted more than 30 days ago.`);
    const n = purgeExpiredEnquiries();
    if (n) console.log(`[trash] Permanently removed ${n} enquiry(ies) deleted more than 30 days ago.`);
  } catch (e) {
    console.error("[trash] purge failed:", e);
  }
};
purge();
setInterval(purge, 60 * 60 * 1000).unref();

const app = express();
app.set("trust proxy", config.trustProxy);
// Images are shown on the website (another origin), so they must be loadable cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.frontendOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Origin not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);
app.use(express.json({ limit: "200kb" }));
app.use("/uploads", express.static(publicUploadDir, { maxAge: "7d", index: false, dotfiles: "deny" }));
app.use("/api/admin", adminRouter);
app.use("/api", publicRouter);
app.use((_req, res) => void res.status(404).json({ error: "Not found" }));

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "That file is too large." : "Upload failed.";
    return void res.status(413).json({ ok: false, error: msg, errors: { file: msg } });
  }
  if (err?.message === "Origin not allowed") return void res.status(403).json({ error: "Origin not allowed" });
  if (err?.type === "entity.parse.failed") return void res.status(400).json({ error: "The request was not valid JSON." });
  if (err?.type === "entity.too.large") return void res.status(413).json({ error: "The request is too large." });
  console.error("[error]", err);
  res.status(500).json({ error: "Something went wrong on the server." });
};
app.use(onError);

app.listen(config.port, (err?: Error) => {
  if (err) {
    console.error(`Could not start on port ${config.port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`AFS backend listening on :${config.port}`);
  console.log(`  allowed website origins: ${config.frontendOrigins.join(", ")}`);
  console.log(`  data directory: ${config.dataDir}`);
  console.log(`  email delivery: ${mailConfigured() ? "configured" : "NOT configured (enquiries are still saved and visible in the admin panel)"}`);
});
