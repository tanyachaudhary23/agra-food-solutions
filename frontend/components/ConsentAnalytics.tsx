"use client";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";

/**
 * Privacy-first analytics: Plausible is loaded only after the visitor accepts.
 * Renders nothing unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is configured.
 */
export default function ConsentAnalytics() {
  const domain = site.analytics.plausibleDomain;
  const [choice, setChoice] = useState<"accepted" | "declined" | null | "loading">("loading");

  useEffect(() => {
    try {
      const v = localStorage.getItem("afs-analytics-consent");
      setChoice(v === "accepted" || v === "declined" ? v : null);
    } catch {
      setChoice(null);
    }
  }, []);

  useEffect(() => {
    if (!domain || choice !== "accepted") return;
    const s = document.createElement("script");
    s.defer = true;
    s.dataset.domain = domain;
    s.src = "https://plausible.io/js/script.js";
    document.head.appendChild(s);
    return () => s.remove();
  }, [domain, choice]);

  if (!domain || choice !== null) return null;

  const save = (v: "accepted" | "declined") => {
    try {
      localStorage.setItem("afs-analytics-consent", v);
    } catch {}
    setChoice(v);
  };

  return (
    <div role="region" aria-label="Analytics consent" className="fixed inset-x-0 bottom-0 z-40 border-t border-forest/20 bg-forest text-ivory">
      <div className="container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">We use privacy-friendly analytics to improve this site. Allow anonymous usage statistics?</p>
        <div className="flex gap-3">
          <button className="btn btn-outline-light py-2" onClick={() => save("declined")}>Decline</button>
          <button className="btn btn-brass py-2" onClick={() => save("accepted")}>Accept</button>
        </div>
      </div>
    </div>
  );
}
