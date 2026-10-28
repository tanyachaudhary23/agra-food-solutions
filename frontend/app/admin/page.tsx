"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch, STATUS_LABEL } from "@/lib/admin";
import { Card, Notice, PageTitle, Skeleton } from "@/components/admin/ui";

type Stats = { products: number; published: number; drafts: number; categories: number; enquiries: number; newEnquiries: number; last7Days: number; emailFailed: number; deletedEnquiries: number };
type Enquiry = { id: number; createdAt: string; name: string; company: string; country: string; product: string; status: string };

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Enquiry[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminFetch<Stats>("/stats").then(setS).catch((e) => setErr(e.message));
    adminFetch<{ items: Enquiry[] }>("/enquiries").then((r) => setRecent(r.items.slice(0, 6))).catch(() => {});
  }, []);

  const tiles: [string, number | undefined, string][] = [
    ["New enquiries", s?.newEnquiries, "/admin/enquiries?status=new"],
    ["Enquiries, last 7 days", s?.last7Days, "/admin/enquiries"],
    ["Published products", s?.published, "/admin/products"],
    ["Draft products", s?.drafts, "/admin/products"],
  ];

  return (
    <>
      <PageTitle title="Dashboard" />
      <Notice kind="error">{err}</Notice>
      {s && s.emailFailed > 0 && (
        <div className="mb-6">
          <Notice kind="error">
            {s.emailFailed} enquiry email(s) were not delivered to your inbox (email not set up, or sending failed). Nothing is lost: they are all saved under Enquiries. Check the email settings in the backend.
          </Notice>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, n, href]) => (
          <Link key={label} href={href} className="border border-forest/15 bg-white p-5 transition-colors duration-150 hover:border-forest">
            {n === undefined ? <Skeleton className="h-10 w-16" /> : <p className="font-heading text-4xl font-extrabold text-forest">{n}</p>}
            <p className="mt-1 text-sm text-charcoal/70">{label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <Card title="Latest enquiries" actions={<Link href="/admin/enquiries" className="text-sm font-semibold text-brass-700 hover:text-forest">View all</Link>}>
          {recent.length === 0 ? (
            <p className="text-sm text-charcoal/70">No enquiries yet. They will appear here as soon as someone submits the form.</p>
          ) : (
            <ul className="divide-y divide-forest/10">
              {recent.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span><strong>{e.name}</strong>, {e.company} ({e.country}){e.product ? ` · ${e.product}` : ""}</span>
                  <span className="text-charcoal/60">{new Date(e.createdAt + "Z").toLocaleDateString()} · {STATUS_LABEL[e.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
