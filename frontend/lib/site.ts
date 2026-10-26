import { apiGet } from "./api";
import type { Settings } from "./types";

/**
 * Fixed identity of the site. Contact details, addresses, registrations, certifications,
 * export terms and legal text are NOT here: they are edited in the admin panel (Settings).
 */
export const site = {
  name: "Agra Food Solutions Pvt. Ltd.",
  shortName: "AFS",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  tagline: "Precision in Every Part. Confidence in Every Shipment.",
  description:
    "Manufacturer, supplier and exporter of spare parts for roller flour mills, rice mills and other grain milling industry.",
  analytics: { plausibleDomain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "" },
};

export const nav = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/industries", label: "Industries" },
  { href: "/about", label: "About Us" },
  { href: "/export-capabilities", label: "Export Capabilities" },
  { href: "/contact", label: "Contact" },
];

/** Industries named in the company catalogue. Edit this list to change the Industries page. */
export const industries = [
  ["Roller flour milling", "Spare parts for roller flour mill plants.", "roller-flour-milling"],
  ["Rice milling", "Spare parts for rice mills.", "rice-milling"],
  ["Dal milling", "Parts and accessories for dal mill plants.", "dal-milling"],
  ["Atta chakki", "Accessories for atta chakki machinery.", "atta-chakki"],
  ["Other grain milling", "Spare parts for other grain milling industry.", "other-grain-milling"],
] as const;
// The third value (slug) must match the industry slugs in the backend (backend/src/industries.ts).

/** Shown only if the backend cannot be reached. Same values as the catalogue cover. */
const fallbackSettings: Settings = {
  email: "agrafoodsolutions@gmail.com",
  phones: ["+91 98970 44651", "+91 97600 44651"],
  landline: "0562-2280098, 2280120",
  whatsapp: "",
  factoryAddress: "18 D.R.J Estate, Peerakhar, Shahdara, Agra-282006, Uttar Pradesh, India",
  registeredOffice: "1, Natrajpuram, Kamla Nagar, Dayal Bagh, Agra-282005, Uttar Pradesh, India",
  cin: "U29308UP2016PTC084482",
  gst: "", iec: "", established: "", aboutStory: "", certifications: [],
  exportRegions: "", incoterms: "", paymentTerms: "", exportDocumentation: "", minimumOrder: "",
  enquiryRecipient: "",
  social: { linkedin: "", facebook: "", instagram: "", youtube: "" },
  privacyText: "", termsText: "",
};

export async function getSettings(): Promise<Settings> {
  const s = await apiGet<Settings>("/api/settings");
  return s ? { ...fallbackSettings, ...s, social: { ...fallbackSettings.social, ...s.social } } : fallbackSettings;
}

export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export const whatsappLink = (number: string, text?: string) =>
  number ? `https://wa.me/${number.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
