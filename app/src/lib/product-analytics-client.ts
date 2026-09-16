'use client';
import type { ClientEvent } from './product-analytics';
let fallbackSession: string | undefined;
export function analyticsSession() {
  fallbackSession ??= crypto.randomUUID();
  try {
    const existing = sessionStorage.getItem('if-analytics-session');
    if (existing) return existing;
    sessionStorage.setItem('if-analytics-session', fallbackSession);
  } catch { /* Tracking must not block users with unavailable storage. */ }
  return fallbackSession;
}
export function registrationFlow() { return `${analyticsSession()}`; }
const pending = new Set<string>();
const sent = new Set<string>();
export function trackProductEvent(name: ClientEvent, fields: { role?: string; listingId?: string; flowId?: string; cta?: string } = {}) {
  try {
    const key = JSON.stringify([name, fields]);
    if (name !== 'cta_clicked' && (pending.has(key) || sent.has(key))) return;
    pending.add(key);
    void fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), sessionId: analyticsSession(), name, path: location.pathname, ...fields }),
      keepalive: true,
    }).then(response => { if (response.ok) sent.add(key); }).catch(() => {}).finally(() => pending.delete(key));
  } catch { /* Best-effort telemetry never interrupts the product. */ }
}
