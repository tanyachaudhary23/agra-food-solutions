"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: { sitekey: string; theme?: string }) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

export type TurnstileHandle = { reset: () => void };

/** Cloudflare Turnstile with explicit rendering. Tokens are single use, so the form calls reset() after every submit. */
const Turnstile = forwardRef<TurnstileHandle, { siteKey: string }>(function Turnstile({ siteKey }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC; s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    const tryRender = () => {
      if (cancelled || !box.current) return;
      if (window.turnstile) { id.current = window.turnstile.render(box.current, { sitekey: siteKey }); return; }
      timer = setTimeout(tryRender, 200);
    };
    tryRender();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
    };
  }, [siteKey]);

  useImperativeHandle(ref, () => ({ reset: () => { if (id.current && window.turnstile) window.turnstile.reset(id.current); } }));
  return <div ref={box} className="sm:col-span-2" />;
});
export default Turnstile;
