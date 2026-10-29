import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero, { Unavailable } from "@/components/PageHero";
import Catalogue from "@/components/Catalogue";
import { getAllProducts, getCategories } from "@/lib/products";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse spare parts for roller flour mills, rice mills and grain milling: plansifter spares, belts, couplings, magnets, pulleys, screens and more.",
  alternates: { canonical: "/products" },
};

export default async function Products() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  return (
    <>
      <PageHero eyebrow="Catalogue" title="Products." intro="Search by name or filter by category, then request a quotation for the parts you need." image="/home/hero-roller.webp" imageAlt="Precision-ground steel roller (illustrative image)" />
      <section className="container-page py-14">
        {products === null ? (
          <Unavailable what="The catalogue" />
        ) : (
          <Suspense fallback={<p role="status" className="text-sm">Loading catalogue…</p>}>
            <Catalogue products={products} categories={categories} />
          </Suspense>
        )}
      </section>
    </>
  );
}
