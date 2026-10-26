import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { config } from "./config.js";
import { db } from "./db.js";

export type AdminRow = { id: number; email: string; password_hash: string };

export const signToken = (a: AdminRow) => jwt.sign({ sub: a.id, email: a.email }, config.jwtSecret, { expiresIn: "8h" });

export const requireAdmin: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return void res.status(401).json({ error: "Not signed in" });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as { sub: number };
    const admin = db.prepare("SELECT id, email, password_hash FROM admins WHERE id = ?").get(payload.sub) as AdminRow | undefined;
    if (!admin) return void res.status(401).json({ error: "Not signed in" });
    res.locals.admin = admin;
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
};
