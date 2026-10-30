"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileSpreadsheet, Inbox, MailWarning, PackagePlus, PenLine, Settings, Tags } from "lucide-react";
import { adminFetch, STATUS_LABEL, timeAgo } from "@/lib/admin";
import { Notice, PageTitle, Skeleton } from "@/components/admin/ui";

type Stats = { products: number; published: number; drafts: number; categories: number; enquiries: number; newEnquiries: number; last7Days: number; emailFailed: number; deletedEnquiries: number };
type Enquiry = { id: number; number: number | null; createdAt: string; name: string; company: string; country: string; product: string; status: string };

const STATUS_CLASS: Record<string, string> = { new: "a-status-new", in_progress: "a-status-warn", quoted: "a-status-ok", closed: "a-status-muted" };

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Enquiry[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminFetch<Stats>("/stats").then(setS).catch((e) => setErr(e.message));
    adminFetch<{ items: Enquiry[] }>("/enquiries").then((r) => setRecent(r.items.slice(0, 6))).catch(() => setRecent([]));
  }, []);

  const metrics: [string, number | undefined, string, string][] = [
    ["New enquiries", s?.newEnquiries, "/admin/enquiries?status=new", "waiting for a reply"],
    ["Last 7 days", s?.last7Days, "/admin/enquiries", "enquiries received"],
    ["Published", s?.published, "/admin/products", "products on the website"],
    ["Drafts", s?.drafts, "/admin/products", "products hidden"],
  ];

  // Only things that really need a look. Each row comes straight from the numbers the backend reports.
  const attention: { icon: React.ReactNode; text: string; href: string; cta: string; tone?: "danger" }[] = [];
  if (s && s.newEnquiries > 0) attention.push({ icon: <Inbox />, text: `${s.newEnquiries} new ${s.newEnquiries === 1 ? "enquiry is" : "enquiries are"} waiting for a reply.`, href: "/admin/enquiries?status=new", cta: "Open" });
  if (s && s.emailFailed > 0) attention.push({ icon: <MailWarning />, text: `${s.emailFailed} enquiry email${s.emailFailed === 1 ? " was" : "s were"} not delivered to your inbox. Nothing is lost: they are all saved under Enquiries. Check the email settings in the backend.`, href: "/admin/enquiries", cta: "Review", tone: "danger" });
  if (s && s.drafts > 0) attention.push({ icon: <PenLine />, text: `${s.drafts} product${s.drafts === 1 ? " is a draft and is" : "s are drafts and are"} hidden from the website.`, href: "/admin/products", cta: "Review" });

  const actions = [
    { href: "/admin/products/new", label: "Add a product", icon: PackagePlus },
    { href: "/admin/products/import", label: "Import from Excel", icon: FileSpreadsheet },
    { href: "/admin/categories", label: "Manage categories", icon: Tags },
    { href: "/admin/settings", label: "Edit website details", icon: Settings },
  ];

  return (
    <>
      <PageTitle title="Dashboard" description="A quick look at your enquiries and catalogue." />
      <Notice kind="error">{err}</Notice>

      {attention.length > 0 && (
        <ul className="a-stagger mb-10 space-y-2">
          {attention.map((a, i) => (
            <li key={i}>
              <Link href={a.href} className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-[14px] transition-colors ${a.tone === "danger" ? "bg-[color:var(--a-danger-soft)] text-[#7E211E] hover:bg-[rgba(163,48,44,.12)]" : "bg-[color:var(--a-accent-soft)] text-[#5F4A22] hover:bg-[rgba(197,163,107,.28)]"}`}>
                <span className="flex-none [&>svg]:h-[18px] [&>svg]:w-[18px]">{a.icon}</span>
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="hidden flex-none items-center gap-1 font-heading text-[13px] font-semibold sm:flex">{a.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <dl className="a-stagger grid grid-cols-2 gap-y-8 lg:grid-cols-4">
        {metrics.map(([label, n, href, note], i) => (
          <Link key={label} href={href} className={`group block px-0 ${i % 2 === 1 ? "pl-6" : ""} ${i > 0 ? "lg:border-l lg:border-[color:var(--a-line)] lg:pl-8" : ""} ${i === 2 ? "border-t border-[color:var(--a-line)] pt-8 lg:border-t-0 lg:pt-0" : ""} ${i === 3 ? "border-t border-[color:var(--a-line)] pt-8 lg:border-t-0 lg:pt-0" : ""}`}>
            <dt className="a-eyebrow !text-[color:var(--a-ink3)]">{label}</dt>
            <dd className="mt-2">
              {n === undefined ? <Skeleton className="h-11 w-16" /> : <span className="font-heading text-[44px] font-bold leading-none tracking-tight transition-colors group-hover:text-[color:var(--a-accent-ink)]">{n}</span>}
              <span className="mt-1.5 block text-[13px] text-[color:var(--a-ink3)]">{note}</span>
            </dd>
          </Link>
        ))}
      </dl>
      {s && <p className="mt-6 text-[13px] text-[color:var(--a-ink3)]">{s.products} products in {s.categories} categories · {s.enquiries} enquiries in total</p>}

      <div className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[18px] font-bold">Latest enquiries</h2>
            <Link href="/admin/enquiries" className="a-link text-[13px]">View all</Link>
          </div>
          {recent === null ? (
            <div className="a-list">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="space-y-2 border-b border-[color:var(--a-line)] px-3 py-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>)}</div>
          ) : recent.length === 0 ? (
            <p className="a-list py-10 text-center text-[14px] text-[color:var(--a-ink2)]">No enquiries yet. They will appear here as soon as someone submits the form.</p>
          ) : (
            <ul className="a-list a-stagger">
              {recent.map((e) => (
                <li key={e.id} className="a-row">
                  <Link href="/admin/enquiries" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-3 py-4">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{e.name} <span className="font-normal text-[color:var(--a-ink2)]">· {e.company}</span></span>
                      <span className="block truncate text-[13px] text-[color:var(--a-ink3)]">{e.country}{e.product ? ` · ${e.product}` : ""}</span>
                    </span>
                    <span className="flex flex-none items-center gap-4 text-[13px]">
                      <span className="text-[color:var(--a-ink3)]">{timeAgo(e.createdAt)}</span>
                      <span className={`a-status ${STATUS_CLASS[e.status] ?? ""}`}>{STATUS_LABEL[e.status]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[18px] font-bold">Quick actions</h2>
          <ul className="space-y-1">
            {actions.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 font-heading text-[14px] font-semibold transition-colors hover:bg-[rgba(23,43,41,.055)]">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[color:var(--a-sunk)] text-[color:var(--a-ink)] transition-colors group-hover:bg-[color:var(--a-accent)] [&>svg]:h-[17px] [&>svg]:w-[17px]"><a.icon /></span>
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
