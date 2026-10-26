import { z } from "zod";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "dwg", "dxf", "doc", "docx", "xls", "xlsx"];

// Strip control characters (blocks header injection / log forging) and trim
const clean = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(max));

export const enquirySchema = z.object({
  name: clean(100).pipe(z.string().min(2, "Please enter your name")),
  company: clean(150).pipe(z.string().min(2, "Please enter your company name")),
  email: clean(150).pipe(z.email("Please enter a valid email address")),
  country: clean(80).pipe(z.string().min(2, "Please enter your country")),
  phone: clean(30).pipe(z.string().regex(/^\+?[0-9\s\-()]{7,20}$/, "Enter a phone number with country code, e.g. +44 20 1234 5678")),
  product: clean(150),
  quantity: clean(60),
  requirements: clean(2000),
  message: clean(3000).pipe(z.string().min(10, "Please tell us a little more (at least 10 characters)")),
  consent: z.literal("true", { error: "Please accept the privacy consent" }),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
export type FieldErrors = Partial<Record<keyof EnquiryInput | "file" | "form", string>>;

export function validateFile(name: string, size: number): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Allowed file types: ${ALLOWED_EXTENSIONS.join(", ")}`;
  if (size > MAX_FILE_BYTES) return `File is too large (maximum ${MAX_FILE_BYTES / 1024 / 1024} MB)`;
  return null;
}
