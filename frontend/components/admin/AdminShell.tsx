"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/admin";
import { FeedbackProvider } from "@/components/admin/ui";

const links = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/enquiries", label: "Enquiries" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/account", label: "Account" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isLogin = path === "/admin/login";

  useEffect(() => {
    if (isLogin) return setReady(true);
    if (!tokenStore.get()) router.replace("/admin/login");
    else setReady(true);
  }, [isLogin, router, path]);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirming(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  function signOut() {
    tokenStore.clear();
    router.replace("/admin/login?signedout=1");
  }

  if (isLogin) return <div className="min-h-screen bg-ivory">{children}</div>;
  if (!ready) return <div className="min-h-screen bg-ivory-200" aria-busy="true" />;

  return (
    <FeedbackProvider>
    <div className="min-h-screen bg-ivory-200">
      <header className="sticky top-0 z-40 bg-forest text-ivory shadow-sm">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="font-heading text-sm font-bold tracking-wide">AFS Admin</span>
          <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => {
              const active = l.exact ? path === l.href : path.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`px-3 py-1.5 font-heading font-medium transition-colors duration-150 ${active ? "bg-brass text-forest" : "hover:bg-forest-700"}`}>
                  {l.label}
                </Link>
              );
            })}
            <a href="/" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 font-heading transition-colors duration-150 hover:bg-forest-700">View site ↗</a>
            <span className="ml-2 border-l border-ivory/25 pl-3">
              {confirming ? (
                <span role="alertdialog" aria-label="Confirm sign out" className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-xs">Sign out of the admin panel?</span>
                  <button onClick={signOut} autoFocus className="bg-brass px-3 py-1.5 font-heading font-medium text-forest">Yes, sign out</button>
                  <button onClick={() => setConfirming(false)} className="px-3 py-1.5 font-heading hover:bg-forest-700">Stay</button>
                </span>
              ) : (
                <button onClick={() => setConfirming(true)} className="border border-ivory/40 px-3 py-1.5 font-heading hover:bg-forest-700">Sign out</button>
              )}
            </span>
          </nav>
        </div>
      </header>
      <div key={path} className="container-page admin-enter py-8">{children}</div>
    </div>
    </FeedbackProvider>
  );
}
