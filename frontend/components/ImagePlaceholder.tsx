import Image from "next/image";

type Props = {
  src?: string;
  alt: string;
  label?: string;
  ratio?: string; // tailwind aspect class
  priority?: boolean;
  sizes?: string;
  imgClassName?: string; // extra classes for the picture itself, e.g. a hover zoom
};

/**
 * Product pictures come from the backend (already resized on upload), so they are served as-is.
 * When a product has no picture yet, a neutral "Image coming soon" tile is shown.
 */
export default function ImagePlaceholder({ src, alt, label = "Image coming soon", ratio = "aspect-[4/3]", priority, sizes = "(min-width:1024px) 33vw, 100vw", imgClassName = "" }: Props) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-white ${ratio}`}>
        <Image src={src} alt={alt} fill unoptimized sizes={sizes} priority={priority} loading={priority ? undefined : "lazy"} className={`object-cover ${imgClassName}`} />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${alt} (no image yet)`}
      className={`relative flex items-end overflow-hidden bg-grey-industrial ${ratio}`}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 22px, rgba(23,43,41,.06) 22px 23px)" }}
    >
      <span className="m-3 font-heading text-[10px] font-semibold uppercase tracking-eyebrow text-forest/60">{label}</span>
    </div>
  );
}
