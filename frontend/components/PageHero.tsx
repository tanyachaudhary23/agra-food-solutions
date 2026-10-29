import Image from "next/image";

export default function PageHero({ eyebrow, title, intro, image, imageAlt = "" }: { eyebrow: string; title: string; intro?: string; image?: string; imageAlt?: string }) {
  // With a photo: same look as the home page hero (dark green overlay, light text). Without: the plain light banner.
  if (image) {
    return (
      <section className="relative isolate overflow-hidden bg-forest text-ivory">
        <Image src={image} alt={imageAlt} fill priority sizes="100vw" unoptimized className="-z-10 object-cover object-right opacity-60" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-forest via-forest/75 to-forest/10" />
        <div className="container-page py-20 lg:py-28">
          <p className="eyebrow !text-brass">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold !text-ivory sm:text-5xl">{title}</h1>
          {intro && <p className="mt-6 max-w-2xl text-lg text-ivory/80">{intro}</p>}
        </div>
      </section>
    );
  }
  return (
    <section className="border-b border-forest/10 bg-ivory-200">
      <div className="container-page py-16 lg:py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold sm:text-5xl">{title}</h1>
        {intro && <p className="mt-6 max-w-2xl text-lg text-charcoal/80">{intro}</p>}
      </div>
    </section>
  );
}

/** Shown when the backend cannot be reached. */
export function Unavailable({ what = "This content" }: { what?: string }) {
  return (
    <div role="alert" className="border border-forest/30 bg-white p-8">
      <h2 className="text-xl font-bold">{what} is temporarily unavailable</h2>
      <p className="mt-2 text-charcoal/75">Please try again in a moment. You can still send us an enquiry or call us using the contact details on this site.</p>
    </div>
  );
}
