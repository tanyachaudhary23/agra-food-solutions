"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Forgets "I came from the product list" as soon as the visitor goes to any page outside the products pages. */
export default function CatalogueMemory() {
  const path = usePathname();
  useEffect(() => {
    if (path === "/products" || path.startsWith("/products/")) return;
    try { sessionStorage.removeItem("afs-catalogue-view-back"); } catch { /* ignore */ }
  }, [path]);
  return null;
}
