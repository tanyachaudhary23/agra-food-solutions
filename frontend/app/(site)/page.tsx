import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import CatalogueDownload from "@/components/CatalogueDownload";
import { getAllProducts, getCategories } from "@/lib/products";
import { industries } from "@/lib/site";

const strengths = [
  { n: "01", t: "Product sourcing", d: "Identification and supply of mill spare parts and accessories against your requirements." },
  { n: "02", t: "Specification-based enquiries", d: "Quotations prepared from the drawings, part numbers, samples and sizes you share." },
  { n: "03", t: "Export coordination", d: "Order coordination, packaging and shipment arrangements for overseas buyers." },
  { n: "04", t: "Clear communication", d: "A single point of contact from first enquiry to dispatch." },
];

const steps = ["Share your requirement", "Specification review", "Quotation", "Order confirmation", "Packing & dispatch"];

const delay = (n: number) => ({ ["--d" as string]: `${(n * 0.09).toFixed(2)}s` }) as React.CSSProperties;

function Heading({ eyebrow, title, light = false }: { eyebrow: string; title: string; light?: boolean }) {
  return (
    <div className="reveal">
      <p className={`eyebrow ${light ? "!text-brass" : ""}`}>{eyebrow}</p>
      <h2 className={`mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl ${light ? "!text-ivory" : ""}`}>{title}</h2>
    </div>
  );
}

export default async function Home() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const all = products ?? [];
  const featured = all.filter((p) => p.featured).slice(0, 3);
  const total = all.length;
  const catImage = (slug: string) => all.find((p) => p.category === slug && p.images[0])?.images[0];

  return (
    <>
      {/* HERO: full-width photo, copy anchored bottom-left */}
      <section className="relative isolate flex min-h-[78vh] items-end overflow-hidden bg-forest text-ivory lg:min-h-[88vh]">
        <Image
          src="/home/hero-roller.webp"
          alt="Precision-ground steel roller (illustrative image)"
          fill
          priority
          sizes="100vw"
          unoptimized
          className="-z-10 object-cover object-right opacity-60"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest via-forest/70 to-transparent" />
        <div className="container-page pb-16 pt-32 lg:pb-24">
          <p className="eyebrow reveal !text-brass">Roller flour mill · Rice mill · Grain milling spares</p>
          <h1 className="reveal mt-6 max-w-4xl text-5xl font-semibold leading-[1.03] !text-ivory sm:text-6xl lg:text-7xl" style={{ ["--d" as string]: "0.08s" }}>
            Precision in every part. <span className="font-serif font-normal italic text-brass">Confidence</span> in every shipment.
          </h1>
          <p className="reveal mt-8 max-w-xl text-lg leading-relaxed text-ivory/80" style={{ ["--d" as string]: "0.16s" }}>
            Manufacturer, supplier and exporter of spare parts for roller flour mills, rice mills and the wider grain milling industry.
          </p>
          <div className="reveal mt-10 flex flex-wrap gap-4" style={{ ["--d" as string]: "0.24s" }}>
            <Link href="/products" className="btn btn-brass !px-7 !py-4">Explore Products <ArrowRight size={16} /></Link>
            <Link href="/contact#quote" className="btn border border-ivory/40 !px-7 !py-4 text-ivory hover:border-brass hover:text-brass">Request a Quote</Link>
          </div>
        </div>
      </section>

      {/* WHO WE ARE */}
      <section className="container-page grid gap-12 py-24 lg:grid-cols-12 lg:py-28">
        <div className="reveal lg:col-span-5">
          <p className="eyebrow">Who we are</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">An Indian manufacturer and exporter for the milling industry.</h2>
        </div>
        <div className="reveal space-y-5 text-lg leading-relaxed text-charcoal/75 lg:col-span-6 lg:col-start-7" style={delay(2)}>
          <p>
            Agra Food Solutions Pvt. Ltd. manufactures and exports roller flour mill, dal mill and atta chakki machinery, spare parts and accessories to importers, distributors and mill operators.
          </p>
          <p>We work from your specifications, keep communication precise and coordinate each order through to shipment.</p>
          <Link href="/about" className="inline-flex items-center gap-2 font-heading text-base font-semibold text-forest hover:text-brass-700">
            About the company <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* PRODUCT CATEGORIES: image tiles with a dark caption overlay */}
      {categories.length > 0 && (
        <section className="bg-grey-industrial py-24 lg:py-28">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Heading eyebrow="Product categories" title="Parts and machinery for milling operations." />
              <div className="reveal flex flex-wrap gap-3">
                <Link href="/products" className="btn btn-outline">View full catalogue{total ? ` (${total} products)` : ""}</Link>
                <CatalogueDownload className="btn btn-forest" label="Download PDF" />
              </div>
            </div>
            <ul className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c, i) => (
                <li key={c.slug} className="reveal-zoom" style={delay(i % 4)}>
                  <Link href={`/products?category=${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-white text-ivory outline-offset-[-3px]">
                    {catImage(c.slug) && (
                      <Image
                        src={catImage(c.slug)!.src}
                        alt={catImage(c.slug)!.alt || c.name}
                        fill
                        unoptimized
                        loading="lazy"
                        sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
                        className="object-cover object-top transition duration-700 group-hover:scale-105"
                      />
                    )}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest from-8% via-forest/80 via-32% to-transparent to-58% transition-opacity duration-500 group-hover:opacity-95" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="flex items-start justify-between gap-2 text-lg font-semibold leading-snug !text-ivory">
                        {c.name}
                        <ArrowRight size={16} className="mt-1 shrink-0 text-brass transition-transform group-hover:translate-x-1" aria-hidden />
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-ivory/75">{c.description}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* HOW WE WORK */}
      <section className="container-page py-24 lg:py-28">
        <Heading eyebrow="How we work" title="What we bring to every enquiry." />
        <div className="mt-16 grid gap-10 border-t border-forest/15 pt-12 sm:grid-cols-2 lg:grid-cols-4">
          {strengths.map((s, i) => (
            <div key={s.n} className="reveal" style={delay(i)}>
              <span className="font-heading text-sm font-semibold text-brass-700">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/70">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* INDUSTRIES: split photo / panel */}
      <section className="grid lg:grid-cols-2">
        <div className="reveal-left relative min-h-[320px] lg:min-h-[460px]">
          <Image src="/home/industries-silos.webp" alt="Grain storage silos and conveyors (illustrative image)" fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized className="object-cover" />
        </div>
        <div className="reveal-right flex flex-col justify-center bg-forest p-10 text-ivory lg:p-20">
          <p className="eyebrow !text-brass">Industries</p>
          <h2 className="mt-4 text-3xl font-semibold !text-ivory sm:text-4xl">Flour milling, grain processing and food processing.</h2>
          <p className="mt-5 text-ivory/75">Supplying the components that keep milling lines running.</p>
          {industries.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {industries.map(([x, , slug]) => <li key={x}><Link href={`/products?industry=${slug}`} className="block border border-ivory/25 px-3 py-1 text-xs text-ivory/85 transition-colors hover:border-brass hover:text-brass">{x}</Link></li>)}
            </ul>
          )}
          <Link href="/industries" className="mt-8 inline-flex items-center gap-2 font-heading font-semibold text-brass hover:text-ivory">
            View industries <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* PROCESS */}
      <section className="container-page py-24 lg:py-28">
        <Heading eyebrow="Procurement process" title="From enquiry to dispatch, in five clear steps." />
        <ol className="mt-14 grid gap-px bg-forest/15 md:grid-cols-5">
          {steps.map((p, i) => (
            <li key={p} className="reveal bg-ivory p-7" style={delay(i)}>
              <span className="font-serif text-4xl italic text-brass-700">{i + 1}</span>
              <p className="mt-6 font-heading font-semibold">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="bg-grey-industrial py-24 lg:py-28">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Heading eyebrow="Catalogue preview" title="Featured products." />
              <Link href="/products" className="reveal inline-flex items-center gap-2 font-heading font-semibold text-forest hover:text-brass-700">
                Full catalogue <ArrowRight size={16} />
              </Link>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {featured.map((p, i) => <div key={p.id} className="reveal-zoom" style={delay(i)}><ProductCard product={p} /></div>)}
            </div>
          </div>
        </section>
      )}

      {/* EXPORT: copy and checklist beside a shipping photo */}
      <section className="grid lg:grid-cols-2">
        <div className="reveal-left flex flex-col justify-center px-5 py-24 sm:px-8 lg:py-28 lg:pl-[max(3rem,calc((100vw-80rem)/2+3rem))] lg:pr-16">
          <p className="eyebrow">Export capabilities</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">Coordinated supply for international buyers.</h2>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">
            Specification confirmation, quotation, order coordination and shipment arrangements, handled with clear documentation and communication. Shipping terms and documents are confirmed for each order.
          </p>
          <div className="mt-8 border border-forest/15 bg-white p-6">
            <h3 className="text-lg font-semibold">For a faster quotation, send us:</h3>
            <ul className="mt-4 space-y-2.5 text-charcoal/85">
              {["Product name or part number", "Size, dimensions and material", "Quantity required", "A drawing, sample photo or old part reference", "Destination country"].map((x) => (
                <li key={x} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-brass" aria-hidden />{x}</li>
              ))}
            </ul>
          </div>
          <Link href="/export-capabilities" className="mt-8 inline-flex items-center gap-2 font-heading font-semibold text-forest hover:text-brass-700">
            How export works <ArrowRight size={16} />
          </Link>
        </div>
        <div className="reveal-right relative min-h-[320px] lg:min-h-[560px]">
          <Image src="/home/export-shipping.webp" alt="Crated machinery beside an open shipping container (illustrative image)" fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized className="object-cover" />
        </div>
      </section>

      {/* CTA BAND */}
      <section className="bg-forest text-ivory">
        <div className="reveal container-page flex flex-col items-start justify-between gap-8 py-20 md:flex-row md:items-center lg:py-24">
          <h2 className="max-w-2xl text-3xl font-semibold !text-ivory md:text-5xl">
            Have a part number or drawing? <span className="font-serif font-normal italic text-brass">Let&rsquo;s talk.</span>
          </h2>
          <Link href="/contact#quote" className="btn btn-brass shrink-0 !px-8 !py-4">Request a Quote</Link>
        </div>
      </section>
    </>
  );
}
