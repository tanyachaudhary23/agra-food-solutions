import PageHero from "./PageHero";

/** Renders admin-edited legal text (blank line = new paragraph) or the supplied default sections. */
export default function LegalPage({ eyebrow = "Legal", title, custom, defaults }: { eyebrow?: string; title: string; custom: string; defaults: [string, string][] }) {
  const paras = custom.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} />
      <section className="container-page pb-24">
        <div className="max-w-3xl space-y-8 text-lg leading-relaxed text-charcoal/80">
        {paras.length > 0
          ? paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)
          : defaults.map(([h, t]) => (
              <div key={h}>
                <h2 className="text-subtitle font-semibold">{h}</h2>
                <p className="mt-3">{t}</p>
              </div>
            ))}
        </div>
      </section>
    </>
  );
}
