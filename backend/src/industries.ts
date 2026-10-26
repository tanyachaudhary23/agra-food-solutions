/** The industries shown on the website's Industries page. Slugs are used in web addresses and product tags. */
export const INDUSTRIES = [
  { slug: "roller-flour-milling", name: "Roller flour milling" },
  { slug: "rice-milling", name: "Rice milling" },
  { slug: "dal-milling", name: "Dal milling" },
  { slug: "atta-chakki", name: "Atta chakki" },
  { slug: "other-grain-milling", name: "Other grain milling" },
] as const;

export const INDUSTRY_SLUGS = INDUSTRIES.map((i) => i.slug) as unknown as [string, ...string[]];

/**
 * DRAFT STARTING POINT ONLY. When industry tags are first introduced, each product is tagged from its category so the
 * Industries page is not empty. This is a general guess, not company data: the owner must review the tags
 * (Admin > Products > open a product > "Industries it is used in") and correct them.
 */
const ALL = INDUSTRIES.map((i) => i.slug) as string[];
const FLOUR_MILL_SPECIFIC = ["roller-flour-milling", "other-grain-milling"];
export const DEFAULT_INDUSTRIES_BY_CATEGORY: Record<string, string[]> = {
  "plansifter-sieving-spares": FLOUR_MILL_SPECIFIC,
  "pulleys-bearings-roller-mill-parts": FLOUR_MILL_SPECIFIC,
};
export const defaultIndustriesFor = (categorySlug: string): string[] => DEFAULT_INDUSTRIES_BY_CATEGORY[categorySlug] ?? ALL;
