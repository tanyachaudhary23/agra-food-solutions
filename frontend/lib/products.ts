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

export function getRelatedProducts(all: Product[], p: Product, limit = 3) {
  const others = all.filter((x) => x.id !== p.id);
  return [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, limit);
}
