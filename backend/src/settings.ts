import { z } from "zod";
import { db } from "./db.js";

const text = (max: number) => z.string().trim().max(max).default("");
const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\//i.test(v), "Must start with https://")
  .default("");

/**
 * Everything the business can edit from the admin panel (Settings page).
 * Empty values are hidden on the public website, nothing is invented.
 */
export const settingsSchema = z.object({
  email: z.string().trim().max(150).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email").default(""),
  phones: z.array(text(30)).max(6).default([]),
  landline: text(80),
  whatsapp: z.string().trim().max(20).refine((v) => v === "" || /^\d{8,15}$/.test(v), "Digits only with country code, e.g. 919876543210").default(""),
  factoryAddress: text(300),
  registeredOffice: text(300),
  cin: text(40),
  gst: text(40),
  iec: text(40),
  established: text(20),
  aboutStory: text(3000),
  certifications: z.array(text(150)).max(15).default([]),
  exportRegions: text(500),
  incoterms: text(300),
  paymentTerms: text(300),
  exportDocumentation: text(500),
  minimumOrder: text(300),
  enquiryRecipient: z.string().trim().max(150).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email").default(""),
  social: z.object({ linkedin: url, facebook: url, instagram: url, youtube: url }).default({ linkedin: "", facebook: "", instagram: "", youtube: "" }),
  privacyText: text(20000),
  termsText: text(20000),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Starting values taken from the company catalogue cover. Editable in the admin panel. */
export const defaultSettings: Settings = settingsSchema.parse({
  email: "agrafoodsolutions@gmail.com",
  phones: ["+91 98970 44651", "+91 97600 44651"],
  landline: "0562-2280098, 2280120",
  factoryAddress: "18 D.R.J Estate, Peerakhar, Shahdara, Agra-282006, Uttar Pradesh, India",
  registeredOffice: "1, Natrajpuram, Kamla Nagar, Dayal Bagh, Agra-282005, Uttar Pradesh, India",
  cin: "U29308UP2016PTC084482",
});

export function getSettings(): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value);
    } catch {
      /* ignore corrupt row */
    }
  }
  const parsed = settingsSchema.safeParse({ ...defaultSettings, ...stored });
  return parsed.success ? parsed.data : defaultSettings;
}

export function saveSettings(s: Settings) {
  const up = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const [k, v] of Object.entries(s)) up.run(k, JSON.stringify(v));
  })();
}
