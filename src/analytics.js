/** GA4 events (same property as wiiwave.com). Safe no-op if gtag is blocked or missing. */
export function track(name, params = {}) {
  try { if (typeof window.gtag === 'function') window.gtag('event', name, params); } catch {}
}
