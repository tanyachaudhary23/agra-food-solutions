import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ImagePlaceholder from "./ImagePlaceholder";
import type { Product } from "@/lib/types";
import { AddToQuoteButton } from "@/components/QuoteList";

/** Image-led product tile: the picture is the card; text sits openly beneath it, with no surrounding box. */
export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const img = product.images[0];
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`} className="block overflow-hidden rounded-card bg-white shadow-soft transition-shadow duration-500 ease-out-soft group-hover:shadow-lift">
          <ImagePlaceholder src={img?.src} alt={img?.alt || product.name} ratio="aspect-[4/3]" priority={priority} imgClassName="transition-transform duration-700 ease-out-soft group-hover:scale-[1.06] motion-reduce:transform-none motion-reduce:transition-none" />
        </Link>
        <AddToQuoteButton product={{ slug: product.slug, name: product.name }} iconOnly className="absolute right-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <p className="eyebrow">{product.categoryName}</p>
        <h3 className="mt-2 text-lg font-semibold leading-snug">
          <Link href={`/products/${product.slug}`} className="link-draw">{product.name}</Link>
        </h3>
        {product.shortDescription && <p className="mt-2 line-clamp-2 text-sm text-charcoal/70">{product.shortDescription}</p>}
        <div className="mt-4 flex items-center gap-5 font-heading text-sm font-semibold">
          <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 text-forest transition-colors hover:text-brass-700">
            Details <ArrowUpRight size={14} aria-hidden className="transition-transform duration-300 ease-out-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link href={`/contact?product=${encodeURIComponent(product.slug)}#quote`} className="text-brass-700 transition-colors hover:text-forest">Request a Quote</Link>
        </div>
      </div>
    </article>
  );
}
