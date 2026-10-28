import { apiGet } from "./api";
import type { Category, Product } from "./types";

export type { Category, Product };

/** Returns null when the backend cannot be reached, so pages can show a proper error state. */
export const getAllProducts = () => apiGet<Product[]>("/api/products");
export const getCategories = async () => (await apiGet<Category[]>("/api/categories")) ?? [];
export const getProduct = (slug: string) => apiGet<Product>(`/api/products/${encodeURIComponent(slug)}`);

export async function getFeaturedProducts(limit = 4) {
  const all = (await getAllProducts()) ?? [];
  return all.filter((p) => p.featured).slice(0, limit);
}

/**
 * Related products: the products that follow this one in its own category (wrapping round), so neighbouring
 * products show different suggestions; then products from other categories used in the same industries, then the rest.
 */
export function getRelatedProducts(all: Product[], p: Product, limit = 3) {
  const same = all.filter((x) => x.category === p.category);
  const at = same.findIndex((x) => x.id === p.id);
  const sameNext = at < 0 ? same.filter((x) => x.id !== p.id) : [...same.slice(at + 1), ...same.slice(0, at)];
  const others = all.filter((x) => x.category !== p.category);
  // `industries` is missing if the backend is an older version, so it is treated as empty rather than crashing the page.
  const mine = p.industries ?? [];
  const shared = (x: Product) => (x.industries ?? []).filter((i) => mine.includes(i)).length;
  const byIndustry = others.map((x, i) => ({ x, i, s: shared(x) })).sort((a, b) => b.s - a.s || a.i - b.i).map((o) => o.x);
  return [...sameNext, ...byIndustry].slice(0, limit);
}
