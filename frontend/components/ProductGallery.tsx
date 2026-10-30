"use client";
import { useState } from "react";
import ImagePlaceholder from "@/components/ImagePlaceholder";

type Img = { src: string; alt: string };

/** Large main picture with a row of thumbnails underneath; choosing a thumbnail swaps the main picture. */
export default function ProductGallery({ images, name }: { images: Img[]; name: string }) {
  const [i, setI] = useState(0);
  const main = images[i];
  return (
    <div>
      <div className="overflow-hidden rounded-panel bg-white shadow-soft">
        <div key={main?.src ?? "none"} className="admin-fade">
          <ImagePlaceholder src={main?.src} alt={main?.alt || name} ratio="aspect-[4/3]" priority sizes="(min-width:1024px) 55vw, 100vw" imgClassName="transition-transform duration-700 ease-out-soft hover:scale-[1.04]" />
        </div>
      </div>
      {images.length > 1 && (
        <ul className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5" aria-label="Product pictures">
          {images.map((im, n) => (
            <li key={im.src}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show picture ${n + 1} of ${images.length}`}
                aria-current={n === i}
                className={`block w-full overflow-hidden rounded-soft ring-2 ring-offset-2 ring-offset-paper transition-all duration-300 ease-out-soft ${n === i ? "ring-forest" : "opacity-70 ring-transparent hover:opacity-100"}`}
              >
                <ImagePlaceholder src={im.src} alt="" ratio="aspect-square" sizes="12vw" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
