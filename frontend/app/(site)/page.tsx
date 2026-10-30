import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import FeaturedMarquee from "@/components/FeaturedMarquee";
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
      <h2 className={`mt-4 max-w-2xl font-heading text-title font-semibold ${light ? "!text-ivory" : ""}`}>{title}</h2>
    </div>
  );
}

// Bento layout for the category tiles: the first one is large, the rest fill the grid around it.
// The first tile is large (2x2 cells); if the rest do not fill the last row of 4, the final tile stretches to close the gap.
const tileSpan = (i: number, n: number) => {
  if (i === 0) return "lg:col-span-2 lg:row-span-2";
  const spare = (4 - ((n + 3) % 4)) % 4;
  return i === n - 1 && spare === 1 ? "lg:col-span-2" : i === n - 1 && spare === 2 ? "lg:col-span-3" : i === n - 1 && spare === 3 ? "lg:col-span-4" : "";
};

export default async function Home() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const all = products ?? [];
  const featured = all.filter((p) => p.featured).slice(0, 12);
  const total = all.length;
  const catImage = (slug: string) => all.find((p) => p.category === slug && p.images[0])?.images[0];

  return (
    <>
      {/* HERO */}
      <section className="relative isolate mx-2 flex min-h-[82vh] items-end overflow-hidden rounded-b-panel bg-forest text-ivory sm:mx-3 lg:min-h-[90vh]">
        <Image src="/home/hero-roller.webp" alt="Precision-ground steel roller (illustrative image)" fill priority sizes="100vw" unoptimized className="-z-10 scale-105 object-cover object-right opacity-60" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest via-forest/70 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-forest/70 to-transparent" />
        <div className="container-page pb-14 pt-32 lg:pb-20">
          <p className="eyebrow reveal !text-brass">Roller flour mill · Rice mill · Grain milling spares</p>
          <h1 className="reveal mt-6 max-w-4xl font-heading text-display font-semibold !text-ivory" style={delay(1)}>
            Precision in every part. <span className="font-serif font-normal italic text-brass">Confidence</span> in every shipment.
          </h1>
          <p className="reveal mt-8 max-w-xl text-lg leading-relaxed text-ivory/80" style={delay(2)}>
            Manufacturer, supplier and exporter of spare parts for roller flour mills, rice mills and the wider grain milling industry.
          </p>
          <div className="reveal mt-10 flex flex-wrap gap-4" style={delay(3)}>
            <Link href="/products" className="btn btn-brass !px-8 !py-4">Explore Products <ArrowRight size={16} aria-hidden /></Link>
            <Link href="/contact#quote" className="btn btn-outline-light !px-8 !py-4">Request a Quote</Link>
          </div>
          <dl className="reveal mt-14 flex flex-wrap gap-x-12 gap-y-4 text-sm text-ivory/70" style={delay(4)}>
            {total > 0 && <div><dt className="sr-only">Products</dt><dd><span className="font-heading text-2xl font-semibold text-ivory">{total}</span> products</dd></div>}
            {categories.length > 0 && <div><dt className="sr-only">Categories</dt><dd><span className="font-heading text-2xl font-semibold text-ivory">{categories.length}</span> categories</dd></div>}
            <div><dt className="sr-only">Based in</dt><dd><span className="font-heading text-2xl font-semibold text-ivory">Agra,</span> India</dd></div>
          </dl>
        </div>
      </section>

      {/* WHO WE ARE: an editorial statement, no boxes */}
      <section className="container-page section grid gap-12 lg:grid-cols-12">
        <p className="eyebrow reveal lg:col-span-3">Who we are</p>
        <div className="lg:col-span-9">
          <p className="reveal font-heading text-subtitle font-medium leading-snug text-forest sm:text-title" style={delay(1)}>
            An Indian manufacturer and exporter of roller flour mill, dal mill and atta chakki machinery, spare parts and accessories, <span className="serif-accent">worked from your specification.</span>
          </p>
          <div className="reveal mt-10 grid gap-8 text-charcoal/75 sm:grid-cols-2" style={delay(2)}>
            <p className="text-lg leading-relaxed">Agra Food Solutions Pvt. Ltd. supplies importers, distributors and mill operators, keeps communication precise and coordinates each order through to shipment.</p>
            <Link href="/about" className="btn btn-outline self-start">About the company <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
      </section>

      {/* CATEGORIES: a bento of image tiles */}
      {categories.length > 0 && (
        <section className="mx-2 rounded-panel bg-sand py-20 sm:mx-3 lg:py-28">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Heading eyebrow="Product categories" title="Parts and machinery for milling operations." />
              <div className="reveal flex flex-wrap gap-3">
                <Link href="/products" className="btn btn-forest">View full catalogue{total ? ` (${total})` : ""} <ArrowRight size={16} aria-hidden /></Link>
                <CatalogueDownload className="btn btn-outline" label="Download PDF" />
              </div>
            </div>
            <ul className="mt-14 grid auto-rows-[230px] grid-cols-1 gap-4 sm:grid-cols-2 lg:auto-rows-[250px] lg:grid-cols-4">
              {categories.map((c, i) => {
                const img = catImage(c.slug);
                return (
                  <li key={c.slug} className={`reveal-zoom ${tileSpan(i, categories.length)}`} style={delay(i % 4)}>
                    <Link href={`/products?category=${c.slug}`} className="group relative block h-full overflow-hidden rounded-card bg-white text-ivory shadow-soft transition-shadow duration-500 hover:shadow-lift">
                      {img && <Image src={img.src} alt={img.alt || c.name} fill unoptimized loading="lazy" sizes={i === 0 ? "(min-width:1024px) 50vw, 100vw" : "(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"} className="object-cover object-top transition duration-700 ease-out-soft group-hover:scale-[1.06]" />}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest from-5% via-forest/70 via-30% to-transparent to-60%" />
                      <div className="absolute inset-x-0 bottom-0 p-5 lg:p-6">
                        <h3 className={`flex items-start justify-between gap-2 font-semibold leading-snug !text-ivory ${i === 0 ? "text-2xl" : "text-lg"}`}>
                          {c.name}
                          <ArrowUpRight size={18} className="mt-1 shrink-0 text-brass transition-transform duration-300 ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-sm text-ivory/75">{c.description}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* HOW WE WORK: numbered, open */}
      <section className="container-page section grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4"><div className="lg:sticky lg:top-32"><Heading eyebrow="How we work" title="What we bring to every enquiry." /></div></div>
        <ol className="lg:col-span-8">
          {strengths.map((s, i) => (
            <li key={s.n} className="reveal grid gap-4 border-t border-forest/10 py-9 first:border-t-0 first:pt-0 sm:grid-cols-[5rem_1fr]" style={delay(i)}>
              <span className="font-serif text-4xl italic text-brass-700">{s.n}</span>
              <div>
                <h3 className="text-subtitle font-semibold">{s.t}</h3>
                <p className="mt-3 max-w-prose text-charcoal/70">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* INDUSTRIES: a photo beside an open list */}
      <section className="mx-2 grid overflow-hidden rounded-panel bg-forest text-ivory sm:mx-3 lg:grid-cols-2">
        <div className="reveal-img relative min-h-[320px] lg:min-h-[520px]">
          <Image src="/home/industries-silos.webp" alt="Grain storage silos and conveyors (illustrative image)" fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized className="object-cover" />
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
          <p className="eyebrow reveal !text-brass">Industries</p>
          <h2 className="reveal mt-4 font-heading text-title font-semibold !text-ivory" style={delay(1)}>Supplying the components that keep milling lines running.</h2>
          <ul className="mt-10">
            {industries.map(([name, desc, slug], i) => (
              <li key={slug} className="reveal" style={delay(i + 2)}>
                <Link href={`/products?industry=${slug}`} className="group flex items-center justify-between gap-4 border-t border-ivory/15 py-4 transition-colors hover:border-brass">
                  <span><span className="block font-heading text-lg font-semibold text-ivory transition-transform duration-300 ease-out-soft group-hover:translate-x-1">{name}</span><span className="block text-sm text-ivory/60">{desc}</span></span>
                  <ArrowUpRight size={18} className="shrink-0 text-brass transition-transform duration-300 ease-out-soft group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/industries" className="mt-6 inline-flex items-center gap-2 self-start font-heading font-semibold text-brass hover:text-ivory">View industries <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>

      {/* PROCESS: a single line with five stops */}
      <section className="container-page section">
        <Heading eyebrow="Procurement process" title="From enquiry to dispatch, in five clear steps." />
        <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-6">
          <span aria-hidden className="absolute left-0 right-0 top-[0.7rem] hidden h-px bg-forest/15 md:block" />
          {steps.map((p, i) => (
            <li key={p} className="reveal relative" style={delay(i)}>
              <span aria-hidden className="relative z-10 block h-[1.4rem] w-[1.4rem] rounded-full border-4 border-paper bg-brass" />
              <span className="mt-5 block font-serif text-3xl italic text-brass-700">{i + 1}</span>
              <p className="mt-2 font-heading font-semibold">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="mx-2 rounded-panel bg-sand py-20 sm:mx-3 lg:py-28">
          <div className="container-page flex flex-wrap items-end justify-between gap-6">
            <Heading eyebrow="Catalogue preview" title="Featured products." />
            <Link href="/products" className="reveal inline-flex items-center gap-2 font-heading font-semibold text-forest hover:text-brass-700">Full catalogue <ArrowRight size={16} aria-hidden /></Link>
          </div>
          <div className="mt-14"><FeaturedMarquee products={featured} /></div>
        </section>
      )}

      {/* EXPORT */}
      <section className="container-page section grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="eyebrow reveal">Export capabilities</p>
          <h2 className="reveal mt-4 font-heading text-title font-semibold" style={delay(1)}>Coordinated supply for international buyers.</h2>
          <p className="reveal lede mt-6" style={delay(2)}>Specification confirmation, quotation, order coordination and shipment arrangements, handled with clear documentation and communication. Shipping terms and documents are confirmed for each order.</p>
          <div className="reveal mt-10" style={delay(3)}>
            <h3 className="font-heading text-lg font-semibold">For a faster quotation, send us:</h3>
            <ul className="mt-4 space-y-3 text-charcoal/80">
              {["Product name or part number", "Size, dimensions and material", "Quantity required", "A drawing, sample photo or old part reference", "Destination country"].map((x) => (
                <li key={x} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" aria-hidden />{x}</li>
              ))}
            </ul>
          </div>
          <Link href="/export-capabilities" className="btn btn-outline reveal mt-10 inline-flex" style={delay(4)}>How export works <ArrowRight size={16} aria-hidden /></Link>
        </div>
        <div className="reveal-img relative min-h-[360px] overflow-hidden rounded-panel lg:min-h-[600px]">
          <Image src="/home/export-shipping.webp" alt="Crated machinery beside an open shipping container (illustrative image)" fill sizes="(min-width:1024px) 50vw, 100vw" unoptimized className="object-cover" />
        </div>
      </section>

      {/* CLOSING CALL TO ACTION */}
      <section className="container-page pb-20 lg:pb-28">
        <div className="reveal flex flex-col items-start justify-between gap-8 rounded-panel bg-forest p-10 text-ivory md:flex-row md:items-center lg:p-16">
          <h2 className="max-w-2xl font-heading text-title font-semibold !text-ivory">
            Have a part number or drawing? <span className="font-serif font-normal italic text-brass">Let&rsquo;s talk.</span>
          </h2>
          <Link href="/contact#quote" className="btn btn-brass shrink-0 !px-8 !py-4">Request a Quote <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </section>
    </>
  );
}
