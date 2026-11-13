// Events from outside websites (Ticketmaster Discovery API). The API key stays here on the server.
// Returns Gather's own shape so the frontend never depends on one provider. To add another provider
// (for example a local Indian listings API), write another `searchXxx` that returns the same shape.
import { AppError } from "../utils/http.js";

const TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
export const PAGE_SIZE = 12;
const CACHE_MS = 10 * 60 * 1000; // the free key allows ~5,000 calls a day: many users share one cached call
const CACHE_MAX = 200;
const cache = new Map();

export const clearExternalCache = () => cache.clear();

// One Ticketmaster event -> Gather shape. Pure, so it is easy to test.
export function normalizeTicketmaster(e) {
  const venue = e._embedded?.venues?.[0] || {};
  const price = e.priceRanges?.[0];
  const img = (e.images || []).filter((i) => i.url && i.width >= 300).sort((a, b) => a.width - b.width)[0];
  return {
    id: `tm-${e.id}`,
    source: "Ticketmaster",
    title: String(e.name || "Untitled").slice(0, 160),
    category: e.classifications?.[0]?.segment?.name || "Event",
    date: e.dates?.start?.localDate || "",
    time: (e.dates?.start?.localTime || "").slice(0, 5),
    location: venue.name || "",
    city: venue.city?.name || "",
    url: e.url || "",
    image: img?.url || "",
    priceText: price
      ? `${price.currency || ""} ${price.min === price.max ? price.min : `${price.min} - ${price.max}`}`.trim()
      : "See site",
  };
}

// Clean and clamp everything that is sent to the provider.
export function cleanQuery(raw = {}) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw.from || "") ? raw.from : "";
  return {
    q: String(raw.q || "").trim().slice(0, 80),
    city: String(raw.city || "").trim().slice(0, 60),
    from,
    page: Math.min(20, Math.max(0, parseInt(raw.page, 10) || 0)),
  };
}

export async function searchTicketmaster(query, fetchImpl = fetch, env = process.env) {
  if (!env.TICKETMASTER_API_KEY) throw new AppError(503, "Online events are not configured yet.", "NOT_CONFIGURED");
  const { q, from, page } = query;
  const city = query.city || env.TICKETMASTER_CITY || "";

  const key = JSON.stringify([q, city, from, page, env.TICKETMASTER_COUNTRY_CODE || ""]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const params = new URLSearchParams({
    apikey: env.TICKETMASTER_API_KEY, size: String(PAGE_SIZE), page: String(page), sort: "date,asc", includeTBA: "no",
    startDateTime: `${from || new Date().toISOString().slice(0, 10)}T00:00:00Z`,
  });
  if (q) params.set("keyword", q);
  if (city) params.set("city", city);
  if (env.TICKETMASTER_COUNTRY_CODE) params.set("countryCode", env.TICKETMASTER_COUNTRY_CODE);

  try {
    const res = await fetchImpl(`${TM_URL}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`provider status ${res.status}`);
    const body = await res.json();
    const data = {
      events: (body._embedded?.events || []).map(normalizeTicketmaster).filter((e) => e.date && e.url),
      hasMore: page + 1 < (body.page?.totalPages ?? 0),
    };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // drop the oldest
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    console.error("online events failed:", err.message); // never send provider details or the key to the browser
    if (hit) return hit.data; // better stale than an error
    throw new AppError(502, "Could not load online events right now. Please try again later.", "PROVIDER_ERROR");
  }
}
