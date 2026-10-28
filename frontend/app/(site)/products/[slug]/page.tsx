import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { Unavailable } from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getAllProducts, getProduct, getRelatedProducts } from "@/lib/products";
import { getSettings, site, whatsappLink } from "@/lib/site";
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
      <div className="container-page py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-charcoal/70">
          <Link href="/products" className="hover:text-brass-700">Products</Link>
          {" / "}
          <Link href={`/products?category=${p.category}`} className="hover:text-brass-700">{p.categoryName}</Link>
        </nav>

        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          <div className="space-y-3">
            <ImagePlaceholder src={p.images[0]?.src} alt={p.images[0]?.alt || p.name} ratio="aspect-[4/3]" priority sizes="(min-width:1024px) 50vw, 100vw" />
            {p.images.length > 1 && (
              <ul className="grid grid-cols-4 gap-3">
                {p.images.slice(1).map((im) => (
                  <li key={im.src}><ImagePlaceholder src={im.src} alt={im.alt || p.name} ratio="aspect-square" sizes="12vw" /></li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="eyebrow">{p.categoryName}</p>
            <h1 className="mt-3 text-4xl font-bold">{p.name}</h1>
            {p.fullDescription && <p className="mt-6 whitespace-pre-line text-lg text-charcoal/80">{p.fullDescription}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={quoteHref} className="btn btn-forest">Request a Quote</Link>
              <AddToQuoteButton product={{ slug: p.slug, name: p.name }} className="btn btn-outline" />
              {wa && <a href={wa} className="btn btn-outline" target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              {s.email && <a href={`mailto:${s.email}?subject=${encodeURIComponent(`Enquiry: ${p.name}`)}`} className="btn btn-outline">Email us</a>}
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-2">
          {p.specifications.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Technical specifications</h2>
              <table className="mt-4 w-full border-collapse text-left text-sm">
                <caption className="sr-only">Technical specifications for {p.name}</caption>
                <tbody>
                  {p.specifications.map((x) => (
                    <tr key={x.label} className="border-b border-forest/15">
                      <th scope="row" className="w-1/3 py-3 pr-4 font-heading font-semibold text-forest">{x.label}</th>
                      <td className="py-3 text-charcoal/80">{x.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {p.applications.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Applications</h2>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-charcoal/80">{p.applications.map((a) => <li key={a}>{a}</li>)}</ul>
            </section>
          )}
          {p.compatibility.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Compatible equipment</h2>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-charcoal/80">{p.compatibility.map((a) => <li key={a}>{a}</li>)}</ul>
            </section>
          )}
          {p.variants.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Available variants</h2>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-charcoal/80">{p.variants.map((a) => <li key={a}>{a}</li>)}</ul>
            </section>
          )}
          {p.documents.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold">Documents</h2>
              <ul className="mt-4 space-y-2">{p.documents.map((d) => (
                <li key={d.href}><a href={d.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-forest underline-offset-4 hover:underline"><FileText size={16} />{d.label}</a></li>
              ))}</ul>
            </section>
          )}
        </div>

        <section className="mt-16 bg-forest p-8 text-ivory sm:p-12">
          <h2 className="text-3xl font-bold !text-ivory">Enquire about {p.name}</h2>
          <p className="mt-3 max-w-xl text-ivory/80">This product is added to your quote list. Add quantities and requirements, or more products, to receive a quotation.</p>
          <Link href={quoteHref} className="btn btn-brass mt-6">Open enquiry form</Link>
        </section>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold">Related products</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => <ProductCard key={r.id} product={r} />)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
