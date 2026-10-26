import PageHero from "./PageHero";

/** Renders admin-edited legal text (blank line = new paragraph) or the supplied default sections. */
export default function LegalPage({ eyebrow = "Legal", title, custom, defaults }: { eyebrow?: string; title: string; custom: string; defaults: [string, string][] }) {
  const paras = custom.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} />
      <section className="container-page max-w-3xl space-y-6 py-16 text-charcoal/85">
        {paras.length > 0
          ? paras.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)
          : defaults.map(([h, t]) => (
              <div key={h}>
                <h2 className="text-2xl font-bold">{h}</h2>
                <p className="mt-2">{t}</p>
              </div>
            ))}
      </section>
    </>
  );
}
