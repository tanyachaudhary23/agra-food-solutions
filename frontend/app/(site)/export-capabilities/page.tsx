import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHero from "@/components/PageHero";
import { getSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Export Capabilities",
  description: "How export enquiries are handled: sourcing, specification, quotation, order coordination and shipment arrangements.",
  alternates: { canonical: "/export-capabilities" },
};

const steps = [
  ["Product identification", "We identify the part or machine that matches your requirement."],
  ["Technical specification confirmation", "Details, drawings and standards are confirmed with you before quoting."],
  ["Quotation and commercial discussions", "We provide a quotation and discuss commercial terms."],
  ["Order coordination", "Once agreed, we coordinate the order and keep you updated."],
  ["Packaging and shipment arrangements", "Goods are packed for export and shipment is arranged per the agreed terms."],
  ["Buyer communication and documentation", "We stay in contact throughout and coordinate the documents required for each order."],
];

export default async function Export() {
  const s = await getSettings();
  const terms: [string, string][] = [
    ["Markets served", s.exportRegions],
    ["Shipping terms (Incoterms)", s.incoterms],
    ["Payment terms", s.paymentTerms],
    ["Export documentation", s.exportDocumentation],
    ["Minimum order", s.minimumOrder],
  ];
  const shown = terms.filter(([, v]) => v);
  return (
    <>
      <PageHero eyebrow="Export capabilities" title="From enquiry to shipment, coordinated." intro="How we handle overseas enquiries and orders." image="/home/export-shipping.webp" imageAlt="Crated machinery beside an open shipping container (illustrative image)" />
      <section className="container-page section">
        <ol className="grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="reveal" style={{ ["--d" as string]: `${((i % 3) * 0.08).toFixed(2)}s` }}>
              <span className="font-serif text-5xl italic text-brass-700">{String(i + 1).padStart(2, "0")}</span>
              <span aria-hidden className="mt-4 block h-px w-12 bg-brass" />
              <h2 className="mt-5 text-subtitle font-semibold">{t}</h2>
              <p className="mt-3 text-charcoal/70">{d}</p>
            </li>
          ))}
        </ol>

        {shown.length > 0 && (
          <div className="reveal mt-24 grid gap-8 lg:grid-cols-12">
            <h2 className="font-heading text-title font-semibold lg:col-span-4">Export terms</h2>
            <dl className="lg:col-span-8">
              {shown.map(([k, v]) => (
                <div key={k} className="grid gap-1 border-t border-forest/10 py-5 first:border-t-0 first:pt-0 sm:grid-cols-3"><dt className="font-heading font-semibold text-forest">{k}</dt><dd className="whitespace-pre-line text-charcoal/75 sm:col-span-2">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}

        <div className="reveal mt-20 flex flex-wrap items-center justify-between gap-6 rounded-panel bg-forest p-8 text-ivory lg:p-12">
          <p className="max-w-xl font-heading text-subtitle font-semibold !text-ivory">Ready to start? <span className="font-serif font-normal italic text-brass">Send us your requirement.</span></p>
          <Link href="/contact#quote" className="btn btn-brass">Start an export enquiry <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>
    </>
  );
}
