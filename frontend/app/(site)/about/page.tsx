import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { getSettings, industries, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description: `About ${site.name}: manufacturer, supplier and exporter of spare parts for roller flour mills, rice mills and grain milling industry, based in Agra, India.`,
  alternates: { canonical: "/about" },
};

export default async function About() {
  const s = await getSettings();
  const blocks: [string, string][] = [
    ["Who we are", s.aboutStory || `${site.name} is a manufacturer, supplier and exporter of spare parts and accessories for roller flour mills, rice mills, dal mills, atta chakki machinery and other grain milling industry.`],
    ["What we supply", "Our catalogue covers plansifter and sieving spares, rubber parts, belts and buckets, couplings and chains, pipes and fittings, magnets, pulleys, bearings, roller mill parts, screens and meshes, and other plant accessories."],
    ["Working from your specification", "We work from your drawings, samples or part details and confirm the technical requirements with you before quoting."],
    ["Serving international customers", "We support overseas importers, distributors and mill operators, with enquiries handled in English and shipment coordinated per order."],
  ];
  const facts: [string, string][] = [
    ["Company", site.name],
    ["CIN", s.cin],
    ["GST", s.gst],
    ["IEC", s.iec],
    ["Established", s.established],
    ["Factory", s.factoryAddress],
    ["Registered office", s.registeredOffice],
  ];
  return (
    <>
      <PageHero eyebrow="About us" title="Spare parts for the milling industry." intro={`${site.name} (AFS) manufactures and supplies spare parts for grain milling plants and exports to buyers worldwide.`} image="/home/about-mesh.webp" imageAlt="" />
      <section className="container-page section grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {blocks.map(([t, d], i) => (
            <div key={t} className="reveal grid gap-4 border-t border-forest/10 py-10 first:border-t-0 first:pt-0 md:grid-cols-[14rem_1fr]">
              <h2 className="text-subtitle font-semibold">{t}</h2>
              <p className="whitespace-pre-line text-lg leading-relaxed text-charcoal/75">{d}</p>
            </div>
          ))}
          {s.certifications.length > 0 && (
            <div className="reveal grid gap-4 border-t border-forest/10 py-10 md:grid-cols-[14rem_1fr]">
              <h2 className="text-subtitle font-semibold">Certifications</h2>
              <ul className="space-y-2 text-lg text-charcoal/75">{s.certifications.map((c) => <li key={c} className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden />{c}</li>)}</ul>
            </div>
          )}
          <div className="reveal grid gap-4 border-t border-forest/10 py-10 md:grid-cols-[14rem_1fr]">
            <h2 className="text-subtitle font-semibold">Industries we serve</h2>
            <ul className="flex flex-wrap gap-2">
              {industries.map(([n, , slug]) => <li key={n}><Link href={`/products?industry=${slug}`} className="block rounded-full bg-sand px-4 py-2 font-heading text-sm font-medium text-forest transition-colors hover:bg-forest hover:text-ivory">{n}</Link></li>)}
            </ul>
          </div>
        </div>
        <aside className="lg:col-span-4">
          <div className="reveal rounded-panel bg-sand p-8 lg:sticky lg:top-28">
            <h2 className="eyebrow">Company details</h2>
            <dl className="mt-6 space-y-5 text-sm">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="font-heading text-xs font-semibold uppercase tracking-wider text-forest/70">{k}</dt><dd className="mt-1 text-charcoal/85">{v}</dd></div>
              ))}
            </dl>
          </div>
        </aside>
      </section>
    </>
  );
}
