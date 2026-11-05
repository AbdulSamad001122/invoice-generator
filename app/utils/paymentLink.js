// Helpers for the optional payment link shown on invoices.

export const DEFAULT_PAYMENT_LINK_TEXT = "Pay this invoice online";

// Returns a safe absolute http(s) URL, or null if the value isn't a usable link.
// "pay.example.com/abc" becomes "https://pay.example.com/abc".
export function normalizePaymentUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  // Only treat it as having a scheme when "//" follows (so "host:8080/pay" still gets https://)
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Reject "user:pass@host" links (misleading, and how "mailto:x@y" would parse)
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// What to print for the link: the user's text, or a sensible default.
export function getPaymentLinkText(text) {
  const t = String(text || "").trim();
  return t || DEFAULT_PAYMENT_LINK_TEXT;
}

// Short form of the URL for printing under the link (no scheme, no trailing slash).
// Long URLs are shortened with "…" so they never run off the page; the full URL
// is still the link target.
export function displayUrl(url, maxLength = 48) {
  const short = String(url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return short.length > maxLength ? `${short.slice(0, maxLength - 1)}…` : short;
}
