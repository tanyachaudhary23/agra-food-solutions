import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import PageHero from "@/components/PageHero";
import QuoteForm from "@/components/QuoteForm";
import { getAllProducts } from "@/lib/products";
import { getSettings, site, telHref, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact and Request a Quote",
  description: "Send an enquiry for spare parts for roller flour mills, rice mills and other grain milling plants. Include drawings or specifications for a faster response.",
  alternates: { canonical: "/contact" },
};

export default async function Contact({ searchParams }: { searchParams: Promise<{ product?: string; message?: string }> }) {
  const sp = await searchParams;
  const [s, all] = await Promise.all([getSettings(), getAllProducts()]);
  const products = (all ?? []).map((p) => ({ slug: p.slug, name: p.name }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    ...(s.email ? { email: s.email } : {}),
    ...(s.phones.length ? { telephone: s.phones } : {}),
    ...(s.factoryAddress ? { address: { "@type": "PostalAddress", streetAddress: s.factoryAddress, addressCountry: "IN" } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero eyebrow="Contact" title="Request a quote." intro="Tell us what you need. Include drawings or specifications for a faster, more accurate response." image="/home/contact-network.webp" imageAlt="" />
      <section className="container-page grid gap-14 pb-24 pt-16 lg:grid-cols-12 lg:pt-20">
        <div id="quote" className="scroll-mt-28 lg:col-span-8">
          <QuoteForm products={products} initialProduct={sp.product} initialMessage={sp.message?.slice(0, 500)} />
        </div>
        <aside className="lg:col-span-4">
          <div className="space-y-6 rounded-panel bg-sand p-8 lg:sticky lg:top-28">
            <h2 className="eyebrow">Direct contact</h2>
            {s.email && <p className="flex gap-3"><Mail size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><a className="link-draw break-all" href={`mailto:${s.email}`}>{s.email}</a></p>}
            {s.phones.map((p) => <p key={p} className="flex gap-3"><Phone size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><a className="link-draw" href={telHref(p)}>{p}</a></p>)}
            {s.landline && <p className="flex gap-3"><Phone size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><span>{s.landline}</span></p>}
            {s.whatsapp && <p className="flex gap-3"><MessageCircle size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><a className="link-draw" href={whatsappLink(s.whatsapp)} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a></p>}
            {s.factoryAddress && <p className="flex gap-3"><MapPin size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><span><strong className="font-heading">Factory</strong><br />{s.factoryAddress}</span></p>}
            {s.registeredOffice && <p className="flex gap-3"><MapPin size={18} className="mt-1 shrink-0 text-brass-700" aria-hidden /><span><strong className="font-heading">Registered office</strong><br />{s.registeredOffice}</span></p>}
          </div>
        </aside>
      </section>
    </>
  );
}
