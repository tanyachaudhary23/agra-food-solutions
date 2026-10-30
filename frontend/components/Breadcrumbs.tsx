import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-charcoal/60">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {c.href ? <Link href={c.href} className="link-draw hover:text-brass-700">{c.label}</Link> : <span aria-current="page" className="text-charcoal/80">{c.label}</span>}
            {i < items.length - 1 && <ChevronRight size={14} aria-hidden className="text-charcoal/35" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
