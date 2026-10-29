"use client";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

const CARD_PX = 300;  // card width
const GAP_PX = 24;    // space between cards
const SPEED = 28;     // pixels per second: slow enough to read the names

/**
 * A slowly drifting row of featured products. It pauses while the visitor hovers or tabs into it,
 * and stands still (as an ordinary swipeable row) for people who ask their device to reduce motion.
 */
export default function FeaturedMarquee({ products }: { products: Product[] }) {
  if (!products.length) return null;
  // Enough cards per half to fill even a wide screen, so the loop never shows a gap.
  const reps = Math.max(1, Math.ceil(6 / products.length));
  const half = Array.from({ length: reps }, () => products).flat();
  const seconds = Math.round((half.length * (CARD_PX + GAP_PX)) / SPEED);

  const row = (hidden: boolean) => (
    <ul className="marquee-half flex shrink-0 gap-6 pr-6" aria-hidden={hidden || undefined} {...(hidden ? { inert: true } : {})}>
      {half.map((p, i) => (
        <li key={`${p.id}-${i}`} className="w-[300px] shrink-0">
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <div
        className="marquee"
        style={{ ["--marquee-seconds" as string]: `${seconds}s` }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured products"
      >
        <div className="marquee-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
