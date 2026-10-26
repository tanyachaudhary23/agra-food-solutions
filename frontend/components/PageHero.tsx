export default function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
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
