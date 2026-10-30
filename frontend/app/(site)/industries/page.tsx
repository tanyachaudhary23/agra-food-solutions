import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
  const count = (slug: string) => (products ? products.filter((p) => (p.industries ?? []).includes(slug)).length : null);
  return (
    <>
      <PageHero eyebrow="Industries" title="Industries and applications." intro="Spare parts and accessories for plants that process grain, as listed in our catalogue." image="/home/industries-silos.webp" imageAlt="Grain storage silos and conveyors (illustrative image)" />
      <section className="container-page section">
        <ul>
          {industries.map(([t, d, slug], i) => {
            const n = count(slug);
            return (
              <li key={t} className="reveal" style={{ ["--d" as string]: `${(i * 0.06).toFixed(2)}s` }}>
                <Link href={`/products?industry=${slug}`} className="group grid items-center gap-3 border-t border-forest/10 py-9 transition-colors hover:border-brass md:grid-cols-12 md:gap-8 lg:py-11">
                  <span className="font-serif text-3xl italic text-brass-700 md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="font-heading text-title font-semibold transition-transform duration-500 ease-out-soft group-hover:translate-x-2 md:col-span-5">{t}</h2>
                  <p className="text-charcoal/70 md:col-span-4">{d}{n !== null && <span className="mt-2 block text-sm text-charcoal/50">{n} {n === 1 ? "product" : "products"}</span>}</p>
                  <span className="hidden justify-self-end md:col-span-2 md:block"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-forest/20 text-forest transition-all duration-300 ease-out-soft group-hover:border-forest group-hover:bg-forest group-hover:text-ivory"><ArrowUpRight size={20} aria-hidden /></span></span>
                </Link>
              </li>
            );
          })}
          <li className="border-t border-forest/10" aria-hidden />
        </ul>
        <div className="reveal mt-14 flex flex-wrap items-center justify-between gap-6 rounded-panel bg-sand p-8 lg:p-12">
          <p className="max-w-xl font-heading text-subtitle font-semibold">Not sure which parts your plant needs? <span className="serif-accent">Tell us about your application.</span></p>
          <Link href="/contact#quote" className="btn btn-forest">Discuss your application <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>
    </>
  );
}
