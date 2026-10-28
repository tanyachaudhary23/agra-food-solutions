"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";
import { useQuoteList } from "@/components/QuoteList";

/**
 * A product page can stay open in a browser after the product was deleted or hidden. This re-checks the product
 * when the page opens, when the tab is shown again, and every 20 seconds; if it is gone, it covers the page with a
 * notice so nobody can request a quote for it, and takes it off the visitor's quote list.
 */
export default function ProductAvailability({ slug, name }: { slug: string; name: string }) {
  const [gone, setGone] = useState(false);
  const { remove } = useQuoteList();

  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        const res = await fetch(`${API_URL}/api/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (res.status === 404 && !stop) { setGone(true); remove(slug); }
      } catch { /* offline or server down: leave the page as it is */ }
    }
    check();
    const t = setInterval(check, 20000);
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", check);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", onShow); window.removeEventListener("focus", check); };
  }, [slug, remove]);

  if (!gone) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="gone-title" className="fixed inset-0 z-50 flex items-center justify-center bg-forest/90 p-6">
      <div className="max-w-md bg-ivory p-8 text-center shadow-2xl">
        <h2 id="gone-title" className="text-2xl font-bold">This product is no longer available</h2>
        <p className="mt-3 text-charcoal/80">&ldquo;{name}&rdquo; has been removed from our catalogue, so we cannot take enquiries for it. Please look at our current range, or contact us and we will help you find an alternative.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/products" className="btn btn-forest">Browse products</Link>
          <Link href="/contact" className="btn btn-outline">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
