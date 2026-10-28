type Plausible = ((event: string, opts?: { props?: Record<string, string | number | boolean> }) => void) & { q?: unknown[] };

/**
 * Sends a custom event to Plausible. Does nothing unless the visitor accepted analytics
 * (the stub below only exists after consent), so it is always safe to call.
 */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  try {
    const p = (window as unknown as { plausible?: Plausible }).plausible;
    if (typeof p === "function") p(event, props ? { props } : undefined);
  } catch {
    /* analytics must never break the page */
  }
}
