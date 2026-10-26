import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ImagePlaceholder from "./ImagePlaceholder";
import type { Product } from "@/lib/types";

export default function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const img = product.images[0];
  return (
    <article className="group flex h-full flex-col border border-forest/15 bg-white">
      <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
        <ImagePlaceholder src={img?.src} alt={img?.alt || product.name} ratio="aspect-[4/3]" priority={priority} imgClassName="transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow">{product.categoryName}</p>
        <h3 className="mt-2 text-lg font-semibold">
          <Link href={`/products/${product.slug}`} className="hover:text-brass-700">{product.name}</Link>
        </h3>
        {product.shortDescription && <p className="mt-2 flex-1 text-sm text-charcoal/75">{product.shortDescription}</p>}
        <div className="mt-5 flex items-center justify-between border-t border-forest/10 pt-4 font-heading text-sm font-semibold">
          <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 text-forest hover:text-brass-700">
            Details <ArrowUpRight size={14} />
          </Link>
          <Link href={`/contact?product=${encodeURIComponent(product.slug)}#quote`} className="text-brass-700 hover:text-forest">
            Request a Quote
          </Link>
        </div>
      </div>
    </article>
  );
}
