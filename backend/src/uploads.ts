import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { config } from "./config.js";
import { privateUploadDir, publicUploadDir } from "./db.js";

const MB = 1024 * 1024;
const storage = multer.memoryStorage();

export const imageUpload = multer({ storage, limits: { fileSize: 10 * MB, files: 1 } }).single("file");
export const documentUpload = multer({ storage, limits: { fileSize: 10 * MB, files: 1 } }).single("file");
export const importUpload = multer({ storage, limits: { fileSize: 5 * MB, files: 1 } }).single("file");
export const ENQUIRY_MAX_BYTES = 5 * MB;
export const enquiryUpload = multer({ storage, limits: { fileSize: ENQUIRY_MAX_BYTES, files: 1, fields: 20 } }).single("attachment");

export const ENQUIRY_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "dwg", "dxf", "doc", "docx", "xls", "xlsx"];

const startsWith = (b: Buffer, bytes: number[], offset = 0) => bytes.every((v, i) => b[offset + i] === v);

export function sniff(b: Buffer): "jpg" | "png" | "webp" | "gif" | "pdf" | "zip" | "ole" | "dwg" | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(b, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(b, [0x50, 0x4b])) return "zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0])) return "ole";
  if (startsWith(b, [0x41, 0x43])) return "dwg";
  return null;
}

const randomName = (ext: string) => `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.${ext}`;

/** Re-encodes any uploaded picture (max 1600px, WebP) so oversized or hostile files never reach the site. */
export async function savePublicImage(buf: Buffer): Promise<string> {
  const kind = sniff(buf);
  if (!kind || !["jpg", "png", "webp", "gif"].includes(kind)) throw new Error("Please upload a JPG, PNG, WebP or GIF image.");
  const name = randomName("webp");
  await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(publicUploadDir, name));
  return `/uploads/${name}`;
}

export function savePublicPdf(buf: Buffer): string {
  if (sniff(buf) !== "pdf") throw new Error("Only PDF documents can be uploaded here.");
  const name = randomName("pdf");
  fs.writeFileSync(path.join(publicUploadDir, name), buf);
  return `/uploads/${name}`;
}

/** Validates an enquiry attachment by extension and file signature, stores it privately, returns the stored name. */
export function savePrivateAttachment(originalName: string, buf: Buffer): { stored: string; safeOriginal: string } {
  const ext = (originalName.split(".").pop() || "").toLowerCase();
  if (!ENQUIRY_EXTENSIONS.includes(ext)) throw new Error(`Allowed file types: ${ENQUIRY_EXTENSIONS.join(", ")}`);
  const kind = sniff(buf);
  const ok =
    (ext === "pdf" && kind === "pdf") ||
    (["jpg", "jpeg"].includes(ext) && kind === "jpg") ||
    (ext === "png" && kind === "png") ||
    (["docx", "xlsx"].includes(ext) && kind === "zip") ||
    (["doc", "xls"].includes(ext) && kind === "ole") ||
    (ext === "dwg" && kind === "dwg") ||
    ext === "dxf";
  if (!ok) throw new Error("The file content does not match its file type.");
  const stored = randomName(ext);
  fs.writeFileSync(path.join(privateUploadDir, stored), buf);
  return { stored, safeOriginal: originalName.replace(/[^\w.\- ]/g, "_").slice(0, 100) };
}

/** Stored values are relative (/uploads/x.webp); API responses use absolute URLs. */
export const toAbsolute = (src: string) => (src.startsWith("/") ? `${config.publicBaseUrl}${src}` : src);
export const toRelative = (src: string) => (src.startsWith(config.publicBaseUrl) ? src.slice(config.publicBaseUrl.length) : src);
