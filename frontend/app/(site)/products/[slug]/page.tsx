import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import ProductGallery from "@/components/ProductGallery";
import { Unavailable } from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getAllProducts, getProduct, getRelatedProducts } from "@/lib/products";
import { getSettings, industries, site, whatsappLink } from "@/lib/site";
import { AddToQuoteButton } from "@/components/QuoteList";
import ProductAvailability from "@/components/ProductAvailability";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return {};
  const title = p.seoTitle || p.name;
  const description = p.seoDescription || p.shortDescription || `${p.name} from ${site.name}`;
  return {
    title,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title, description, images: p.images[0] ? [p.images[0].src] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, all, s] = await Promise.all([getProduct(slug), getAllProducts(0), getSettings()]);
  if (!p) {
    // The backend answered "not found" -> 404; the backend being down is different (all === null).
    if (all === null) return <div className="container-page py-20"><Unavailable what="This product" /></div>;
    notFound();
  }
  const related = getRelatedProducts(all ?? [], p, 3);
  const quoteHref = `/contact?product=${encodeURIComponent(p.slug)}#quote`;
  const wa = whatsappLink(s.whatsapp, `Hello, I would like a quotation for: ${p.name}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription || p.fullDescription.slice(0, 200),
    category: p.categoryName,
    brand: { "@type": "Organization", name: site.name },
    ...(p.images[0] ? { image: p.images.map((i) => i.src) } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductAvailability slug={p.slug} name={p.name} />
      <div className="container-page pb-10 pt-8 lg:pt-10">
        <Breadcrumbs items={[{ label: "Products", href: "/products" }, { label: p.categoryName, href: `/products?category=${p.category}` }, { label: p.name }]} />

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7"><ProductGallery images={p.images} name={p.name} /></div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow">{p.categoryName}{p.code ? ` · ${p.code}` : ""}</p>
              <h1 className="mt-4 font-heading text-title font-bold">{p.name}</h1>
              {p.shortDescription && <p className="lede mt-5">{p.shortDescription}</p>}
              {(p.industries ?? []).length > 0 && (
                <div className="mt-6">
                  <p className="font-heading text-xs font-semibold uppercase tracking-wider text-forest/70">Used in</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {(p.industries ?? []).map((slug) => {
                      const name = industries.find(([, , sl]) => sl === slug)?.[0];
                      return name ? <li key={slug}><Link href={`/products?industry=${slug}`} className="block rounded-full bg-sand px-3.5 py-1.5 font-heading text-xs font-medium text-forest transition-colors hover:bg-forest hover:text-ivory">{name}</Link></li> : null;
                    })}
                  </ul>
                </div>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={quoteHref} className="btn btn-forest !px-7 !py-3.5">Request a Quote <ArrowRight size={16} aria-hidden /></Link>
                <AddToQuoteButton product={{ slug: p.slug, name: p.name }} className="btn btn-outline !py-3.5" />
              </div>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-heading font-semibold">
                {wa && <a href={wa} className="link-draw text-forest hover:text-brass-700" target="_blank" rel="noopener noreferrer">WhatsApp us</a>}
                {s.email && <a href={`mailto:${s.email}?subject=${encodeURIComponent(`Enquiry: ${p.name}`)}`} className="link-draw text-forest hover:text-brass-700">Email us</a>}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-14 lg:grid-cols-12">
          {p.fullDescription && (
            <section className="lg:col-span-12">
              <h2 className="text-subtitle font-semibold">About this product</h2>
              <p className="mt-4 max-w-3xl whitespace-pre-line text-lg leading-relaxed text-charcoal/75">{p.fullDescription}</p>
            </section>
          )}
          {p.specifications.length > 0 && (
            <section className="lg:col-span-7">
              <h2 className="text-subtitle font-semibold">Technical specifications</h2>
              <dl className="mt-6">
                {p.specifications.map((x) => (
                  <div key={x.label} className="grid gap-1 border-t border-forest/10 py-4 first:border-t-0 sm:grid-cols-3">
                    <dt className="font-heading text-sm font-semibold text-forest">{x.label}</dt>
                    <dd className="text-charcoal/80 sm:col-span-2">{x.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <div className="space-y-12 lg:col-span-5">
            {([["Applications", p.applications], ["Compatible equipment", p.compatibility], ["Available variants", p.variants]] as [string, string[]][]).map(([h, list]) =>
              list.length > 0 ? (
                <section key={h}>
                  <h2 className="text-subtitle font-semibold">{h}</h2>
                  <ul className="mt-4 space-y-2 text-charcoal/80">{list.map((a) => <li key={a} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden />{a}</li>)}</ul>
                </section>
              ) : null
            )}
            {p.documents.length > 0 && (
              <section>
                <h2 className="text-subtitle font-semibold">Documents</h2>
                <ul className="mt-4 space-y-2">{p.documents.map((d) => (
                  <li key={d.href}><a href={d.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 font-heading text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-ivory"><FileText size={16} aria-hidden />{d.label}</a></li>
                ))}</ul>
              </section>
            )}
          </div>
        </div>

        <section className="mt-24 rounded-panel bg-forest p-10 text-ivory lg:p-16">
          <h2 className="max-w-2xl font-heading text-title font-semibold !text-ivory">Enquire about {p.name}</h2>
          <p className="mt-4 max-w-xl text-ivory/75">This product is added to your quote list. Add quantities and requirements, or more products, to receive a quotation.</p>
          <Link href={quoteHref} className="btn btn-brass mt-8 !px-8 !py-4">Open enquiry form <ArrowRight size={16} aria-hidden /></Link>
        </section>

        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="font-heading text-title font-semibold">Related products</h2>
            <div className="mt-10 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => <ProductCard key={r.id} product={r} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
