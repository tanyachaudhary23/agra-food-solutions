import type { Metadata } from "next";
import Link from "next/link";
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
      <PageHero eyebrow="Export capabilities" title="From enquiry to shipment, coordinated." intro="How we handle overseas enquiries and orders." />
      <section className="container-page py-20">
        <ol className="grid gap-px border border-forest/15 bg-forest/15 md:grid-cols-2 lg:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="reveal bg-ivory p-8">
              <span className="font-serif text-4xl italic text-brass-700">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="mt-4 text-xl font-bold">{t}</h2>
              <p className="mt-3 text-sm text-charcoal/75">{d}</p>
            </li>
          ))}
        </ol>

        {shown.length > 0 && (
          <div className="mt-14 max-w-3xl">
            <h2 className="text-2xl font-bold">Export terms</h2>
            <dl className="mt-5 divide-y divide-forest/15 border-y border-forest/15">
              {shown.map(([k, v]) => (
                <div key={k} className="grid gap-1 py-4 sm:grid-cols-3"><dt className="font-heading font-semibold text-forest">{k}</dt><dd className="whitespace-pre-line text-charcoal/80 sm:col-span-2">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-12">
          <Link href="/contact#quote" className="btn btn-forest">Start an export enquiry</Link>
        </div>
      </section>
    </>
  );
}
