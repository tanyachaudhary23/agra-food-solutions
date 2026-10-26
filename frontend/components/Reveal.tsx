"use client";
import { useEffect } from "react";

const SELECTOR = ".reveal, .reveal-left, .reveal-right, .reveal-zoom";

/**
 * Shows panels as they scroll into view and hides them again when they scroll away, so the animation
 * plays every time the visitor scrolls past (up or down). Re-scans when the page content changes.
 */
export default function Reveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(SELECTOR).forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          e.target.classList.toggle("is-visible", e.isIntersecting);
        }),
      { threshold: 0, rootMargin: "0px 0px -8% 0px" }
    );
    const scan = () =>
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          io.observe(el);
        }
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
