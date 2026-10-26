import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { getAllProducts } from "@/lib/products";
import { industries } from "@/lib/site";

export const metadata: Metadata = {
  title: "Industries and Applications",
  description: "Industries served: roller flour milling, rice milling, dal milling, atta chakki and other grain milling.",
  alternates: { canonical: "/industries" },
};

export default async function Industries() {
  const products = await getAllProducts();
  const count = (slug: string) => (products ? products.filter((p) => p.industries.includes(slug)).length : null);
  return (
    <>
      <PageHero eyebrow="Industries" title="Industries and applications." intro="Spare parts and accessories for plants that process grain, as listed in our catalogue." />
      <section className="container-page grid gap-6 py-20 md:grid-cols-2 lg:grid-cols-3">
        {industries.map(([t, d, slug]) => {
          const n = count(slug);
          return (
          <article key={t} className="reveal flex flex-col border border-forest/15 bg-white p-7">
            <h2 className="text-2xl font-bold">{t}</h2>
            <p className="mt-3 flex-1 text-charcoal/80">{d}</p>
            {n !== null && <p className="mt-4 text-sm text-charcoal/60">{n} {n === 1 ? "product" : "products"}</p>}
            <Link href={`/products?industry=${slug}`} className="mt-3 font-heading text-sm font-semibold text-forest hover:text-brass-700">Browse {t.toLowerCase()} products &rarr;</Link>
          </article>
          );
        })}
      </section>
      <section className="container-page pb-20">
        <Link href="/contact#quote" className="btn btn-forest">Discuss your application</Link>
      </section>
    </>
  );
}
