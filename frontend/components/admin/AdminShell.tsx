"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Settings, Tags, UserRound, X } from "lucide-react";
import { adminFetch, tokenStore } from "@/lib/admin";
import { FeedbackProvider, useConfirm, useGuardRef } from "@/components/admin/ui";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/account", label: "Account", icon: UserRound },
];

const CRUMB: Record<string, string> = { admin: "Dashboard", enquiries: "Enquiries", products: "Products", categories: "Categories", settings: "Settings", account: "Account", import: "Import", new: "New product" };

function Crumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean).slice(1); // drop "admin"
  if (parts.length === 0) return <span className="font-heading text-[13px] font-semibold">Dashboard</span>;
  const items = parts.map((p, i) => ({ label: CRUMB[p] ?? (/^\d+$/.test(p) ? "Edit product" : p), href: "/admin/" + parts.slice(0, i + 1).join("/") }));
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 font-heading text-[13px]">
      <Link href="/admin" className="text-[color:var(--a-ink3)] transition-colors hover:text-[color:var(--a-ink)]">Admin</Link>
      {items.map((c, i) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight aria-hidden className="h-3.5 w-3.5 flex-none text-[color:var(--a-ink3)]" />
          {i === items.length - 1 ? <span aria-current="page" className="truncate font-semibold">{c.label}</span> : <Link href={c.href} className="text-[color:var(--a-ink3)] transition-colors hover:text-[color:var(--a-ink)]">{c.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  const guard = useGuardRef();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const isLogin = path === "/admin/login";

  useEffect(() => {
    if (isLogin) return setReady(true);
    if (!tokenStore.get()) router.replace("/admin/login");
    else setReady(true);
  }, [isLogin, router, path]);

  useEffect(() => { try { setCollapsed(localStorage.getItem("afs-admin-nav") === "collapsed"); } catch { /* storage blocked */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem("afs-admin-nav", c ? "open" : "collapsed"); } catch { /* ignore */ } return !c; });

  useEffect(() => { setMobileOpen(false); }, [path]);
  useEffect(() => {
    if (isLogin || !ready) return;
    adminFetch<{ newEnquiries: number }>("/stats").then((s) => setNewCount(s.newEnquiries)).catch(() => {});
  }, [path, isLogin, ready]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [mobileOpen]);

  /** Menu links ask first when the current screen has unsaved changes. */
  const go = useCallback(async (e: React.MouseEvent, href: string) => {
    if (!guard.current || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const leave = await confirm({ title: "Leave without saving?", body: "You have changes that are not saved yet. If you leave now they will be lost.", confirmLabel: "Leave without saving", cancelLabel: "Keep editing", danger: true });
    if (leave) { guard.current = false; router.push(href); }
  }, [confirm, guard, router]);

  async function signOut() {
    if (!(await confirm({ title: "Sign out?", body: "You will need your email and password to get back in.", confirmLabel: "Sign out" }))) return;
    // Revokes the session on the server too (best effort), then clears it here.
    adminFetch("/logout", { method: "POST" }).catch(() => {});
    tokenStore.clear();
    guard.current = false;
    router.replace("/admin/login?signedout=1");
  }

  if (isLogin) return <>{children}</>;
  if (!ready) return <div className="min-h-screen" aria-busy="true" />;

  const nav = (wide: boolean) => (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 flex-none items-center ${wide ? "px-5" : "justify-center"}`}>
        <Link href="/admin" onClick={(e) => go(e, "/admin")} className="flex items-center gap-3" title="Dashboard">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-[color:var(--a-brand)] font-heading text-[13px] font-extrabold tracking-wide text-[color:var(--a-accent)]">AFS</span>
          {wide && <span className="leading-tight"><span className="block font-heading text-[14px] font-bold">Agra Food Solutions</span><span className="block text-[11.5px] text-[color:var(--a-ink3)]">Admin workspace</span></span>}
        </Link>
      </div>
      <nav aria-label="Admin" className={`mt-2 flex flex-1 flex-col gap-1 overflow-y-auto ${wide ? "px-3" : "px-2.5"}`}>
        {links.map((l) => {
          const active = l.exact ? path === l.href : path.startsWith(l.href);
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} onClick={(e) => go(e, l.href)} aria-current={active ? "page" : undefined} title={wide ? undefined : l.label} className={`a-nav-item ${wide ? "" : "justify-center !px-0"}`}>
              <span className="relative"><Icon aria-hidden />{!wide && l.href === "/admin/enquiries" && newCount > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[color:var(--a-accent)] ring-2 ring-[color:var(--a-bg)]" />}</span>
              {wide && <span>{l.label}</span>}
              {wide && l.href === "/admin/enquiries" && newCount > 0 && <span className="a-nav-count" aria-label={`${newCount} new`}>{newCount}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={`flex-none space-y-1 border-t border-[color:var(--a-line)] py-3 ${wide ? "px-3" : "px-2.5"}`}>
        <a href="/" target="_blank" rel="noopener noreferrer" title="View website" className={`a-nav-item ${wide ? "" : "justify-center !px-0"}`}><ExternalLink aria-hidden />{wide && <span>View website</span>}</a>
        <button type="button" onClick={signOut} title="Sign out" className={`a-nav-item w-full cursor-pointer ${wide ? "" : "justify-center !px-0"}`}><LogOut aria-hidden />{wide && <span>Sign out</span>}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[color:var(--a-line)] bg-[color:var(--a-bg)] transition-[width] duration-300 ease-[cubic-bezier(.22,.8,.2,1)] lg:block ${collapsed ? "w-[72px]" : "w-[252px]"}`}>
        {nav(!collapsed)}
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <>
          <div className="a-backdrop" style={{ zIndex: 70 }} onMouseDown={() => setMobileOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-y-0 left-0 z-[71] w-[280px] max-w-[85vw] border-r border-[color:var(--a-line)] bg-[color:var(--a-bg)] shadow-2xl" style={{ animation: "a-slide-left .28s cubic-bezier(.22,.8,.2,1) both" }}>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="a-btn a-btn-quiet a-btn-icon absolute right-3 top-3.5"><X /></button>
            {nav(true)}
          </aside>
        </>
      )}

      <div className={`transition-[padding] duration-300 ease-[cubic-bezier(.22,.8,.2,1)] ${collapsed ? "lg:pl-[72px]" : "lg:pl-[252px]"}`}>
        <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[color:var(--a-line)] bg-[color:var(--a-bg)]/85 px-4 backdrop-blur-md sm:px-8 lg:px-12">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="a-btn a-btn-quiet a-btn-icon -ml-2 lg:!hidden"><Menu /></button>
          <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="a-btn a-btn-quiet a-btn-icon -ml-2 !hidden lg:!inline-flex">{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
          <Crumbs path={path} />
        </div>
        <main key={path} className="a-rise mx-auto w-full max-w-[1180px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <FeedbackProvider>
        <Shell>{children}</Shell>
      </FeedbackProvider>
    </div>
  );
}
