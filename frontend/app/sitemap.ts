import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { getAllProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/products", "/industries", "/about", "/export-capabilities", "/contact", "/privacy", "/terms"].map((p) => ({
    url: `${site.url}${p}`,
    lastModified: new Date(),
  }));
  const products = ((await getAllProducts()) ?? []).map((p) => ({ url: `${site.url}/products/${p.slug}`, lastModified: new Date() }));
  return [...pages, ...products];
}
