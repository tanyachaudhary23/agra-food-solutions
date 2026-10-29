import type { Metadata } from "next";
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
      <section className="container-page grid gap-12 py-20 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          {blocks.map(([t, d]) => (
            <div key={t} className="reveal border-t border-forest/20 pt-6">
              <h2 className="text-2xl font-bold">{t}</h2>
              <p className="mt-3 whitespace-pre-line text-lg text-charcoal/80">{d}</p>
            </div>
          ))}
          {s.certifications.length > 0 && (
            <div className="reveal border-t border-forest/20 pt-6">
              <h2 className="text-2xl font-bold">Certifications</h2>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-lg text-charcoal/80">{s.certifications.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <div className="reveal border-t border-forest/20 pt-6">
            <h2 className="text-2xl font-bold">Industries we serve</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-lg text-charcoal/80">
              {industries.map(([n]) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        </div>
        <aside>
          <h2 className="eyebrow">Company details</h2>
          <dl className="mt-4 space-y-3 border border-forest/15 bg-white p-5 text-sm">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="font-heading font-semibold text-forest">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </aside>
      </section>
    </>
  );
}
