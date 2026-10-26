import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { privateUploadDir } from "./db.js";
import { getSettings } from "./settings.js";

export type EnquiryForMail = {
  id: number;
  name: string;
  company: string;
  email: string;
  country: string;
  phone: string;
  product: string;
  quantity: string;
  requirements: string;
  message: string;
  attachment_name?: string | null;
  attachment_file?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export const mailConfigured = () => !!(config.smtp.host && config.smtp.from && (getSettings().enquiryRecipient || config.smtp.to));

export async function sendEnquiryEmail(e: EnquiryForMail): Promise<{ status: "sent" | "failed" | "not_configured"; error?: string }> {
  const to = getSettings().enquiryRecipient || config.smtp.to;
  if (!config.smtp.host || !config.smtp.from || !to) return { status: "not_configured" };
  try {
    const transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
    const rows: [string, string][] = [
      ["Name", e.name], ["Company", e.company], ["Email", e.email], ["Country", e.country], ["Phone", e.phone],
      ["Product / part", e.product], ["Quantity", e.quantity], ["Technical requirements", e.requirements], ["Message", e.message],
    ];
    await transport.sendMail({
      from: config.smtp.from,
      to,
      replyTo: e.email,
      subject: oneLine(`New enquiry #${e.id}: ${e.product || "General"} (${e.company}, ${e.country})`),
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
      html: `<table cellpadding="6" style="font-family:sans-serif">${rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`,
      attachments: e.attachment_file && e.attachment_name
        ? [{ filename: e.attachment_name, content: fs.readFileSync(path.join(privateUploadDir, e.attachment_file)) }]
        : [],
    });
    return { status: "sent" };
  } catch (err) {
    return { status: "failed", error: (err instanceof Error ? err.message : String(err)).slice(0, 300) };
  }
}
