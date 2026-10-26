import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { db } from "./db.js";

/**
 * Makes a consistent copy of the database (safe while the server is running) in DATA_DIR/backups,
 * and keeps only the newest 14 copies. Uploaded pictures and documents live in DATA_DIR/uploads:
 * back that folder up too (or simply back up the whole DATA_DIR folder).
 */
const dir = path.join(config.dataDir, "backups");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
const file = path.join(dir, `afs-${stamp}.db`);

await db.backup(file);
console.log(`Database backup written to ${file}`);

const old = fs
  .readdirSync(dir)
  .filter((f) => /^afs-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(14);
for (const f of old) fs.unlinkSync(path.join(dir, f));
if (old.length) console.log(`Removed ${old.length} older backup(s).`);
