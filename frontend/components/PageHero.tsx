import Image from "next/image";

type Props = { eyebrow: string; title: string; intro?: string; image?: string; imageAlt?: string };

/**
 * Banner at the top of every inner page. With a photo it matches the home page (dark overlay, light text);
 * without one it is a quiet light banner. Both sit under the header with softly rounded lower corners.
 */
export default function PageHero({ eyebrow, title, intro, image, imageAlt = "" }: Props) {
  if (image) {
    return (
      <section className="relative isolate mx-2 overflow-hidden rounded-b-panel bg-forest text-ivory sm:mx-3">
        <Image src={image} alt={imageAlt} fill priority sizes="100vw" unoptimized className="-z-10 object-cover object-right opacity-60" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest via-forest/75 to-forest/10" />
        <div className="container-page pb-20 pt-16 lg:pb-28 lg:pt-24">
          <p className="eyebrow reveal !text-brass">{eyebrow}</p>
          <h1 className="reveal mt-5 max-w-3xl font-heading text-title font-bold !text-ivory" style={{ ["--d" as string]: "0.08s" }}>{title}</h1>
          {intro && <p className="reveal mt-6 max-w-2xl text-lg text-ivory/80" style={{ ["--d" as string]: "0.16s" }}>{intro}</p>}
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="container-page pb-12 pt-16 lg:pb-16 lg:pt-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-3xl font-heading text-title font-bold">{title}</h1>
        {intro && <p className="lede mt-6 max-w-2xl">{intro}</p>}
      </div>
    </section>
  );
}

/** Shown when the backend cannot be reached. */
export function Unavailable({ what = "This content" }: { what?: string }) {
  return (
    <div role="alert" className="rounded-card bg-sand p-8">
      <h2 className="text-xl font-bold">{what} is temporarily unavailable</h2>
      <p className="mt-2 text-charcoal/75">Please try again in a moment. You can still send us an enquiry or call us using the contact details on this site.</p>
    </div>
  );
}
