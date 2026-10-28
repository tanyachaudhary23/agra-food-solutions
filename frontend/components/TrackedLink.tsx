"use client";
import type { AnchorHTMLAttributes } from "react";
import { track } from "@/lib/analytics";

/** A normal link that also records an analytics event when clicked (only if the visitor accepted analytics). */
export default function TrackedLink({ event, props, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { event: string; props?: Record<string, string | number | boolean> }) {
  return (
    <a
      {...rest}
      onClick={(e) => {
        track(event, props);
        onClick?.(e);
      }}
    />
  );
}
