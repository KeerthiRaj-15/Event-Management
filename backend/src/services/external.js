// Events from outside websites (Ticketmaster Discovery API). The API key stays here on the server.
// Returns Gather's own shape so the frontend never depends on one provider. To add another provider
// (for example a local Indian listings API), write another `searchXxx` that returns the same shape.
import crypto from "node:crypto";
import { AppError } from "../utils/http.js";

const TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
export const PAGE_SIZE = 12;
const CACHE_MS = 10 * 60 * 1000; // the free key allows ~5,000 calls a day: many users share one cached call
const CACHE_MAX = 200;
const cache = new Map();

// Countries and topics the Discover page can filter by. Anything else sent by a browser is ignored.
export const COUNTRIES = ["IN", "US", "GB", "AU", "CA", "AE", "NZ", "IE", "DE"]; // ISO codes. "ALL" = no country filter
// What the page sends -> the name Ticketmaster matches against its own segments, genres and sub-genres.
export const TOPICS = {
  Music: "Music", Sports: "Sports", Cricket: "Cricket", Football: "Soccer",
  Comedy: "Comedy", Theatre: "Arts & Theatre", Film: "Film", Family: "Family",
};

export const clearExternalCache = () => cache.clear();

// "Today" in the app's time zone (EVENT_UTC_OFFSET, +05:30 by default). Events dated before it are never fetched or shown.
export function todayISO(offset = "+05:30", now = Date.now()) {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset || "") || ["", "+", "05", "30"];
  const mins = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return new Date(now + mins * 60000).toISOString().slice(0, 10);
}

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
    genre: ["Undefined", "Other"].includes(e.classifications?.[0]?.genre?.name) ? "" : e.classifications?.[0]?.genre?.name || "",
    date: e.dates?.start?.localDate || "",
    time: (e.dates?.start?.localTime || "").slice(0, 5),
    location: venue.name || "",
    city: venue.city?.name || "",
    country: venue.country?.countryCode || "",
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
  const country = String(raw.country || "").trim().toUpperCase();
  return {
    q: String(raw.q || "").trim().slice(0, 80),
    city: String(raw.city || "").trim().slice(0, 60),
    country: country === "ALL" || COUNTRIES.includes(country) ? country : "",
    topic: typeof raw.topic === "string" && Object.hasOwn(TOPICS, raw.topic) ? raw.topic : "",
    from,
    page: Math.min(20, Math.max(0, parseInt(raw.page, 10) || 0)),
  };
}

export async function searchTicketmaster(query, fetchImpl = fetch, env = process.env) {
  if (!env.TICKETMASTER_API_KEY) throw new AppError(503, "Online events are not configured yet.", "NOT_CONFIGURED");
  const { q, page, topic = "" } = query;
  const today = todayISO(env.EVENT_UTC_OFFSET);
  const from = query.from && query.from > today ? query.from : today; // a past start date is moved up to today
  const city = query.city || env.TICKETMASTER_CITY || "";
  // The page sends a country ("ALL" = worldwide). When it sends none, the .env default applies.
  const country = query.country === "ALL" ? "" : query.country || env.TICKETMASTER_COUNTRY_CODE || "";

  const key = JSON.stringify([q, city, country, topic, from, page]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const params = new URLSearchParams({
    apikey: env.TICKETMASTER_API_KEY, size: String(PAGE_SIZE), page: String(page), sort: "date,asc", includeTBA: "no",
    startDateTime: `${from}T00:00:00Z`,
  });
  if (q) params.set("keyword", q);
  if (city) params.set("city", city);
  if (country) params.set("countryCode", country);
  if (topic && TOPICS[topic]) params.set("classificationName", TOPICS[topic]);

  try {
    const res = await fetchImpl(`${TM_URL}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`provider status ${res.status}`);
    const body = await res.json();
    const data = {
      events: (body._embedded?.events || []).map(normalizeTicketmaster).filter((e) => e.date && e.url && e.date >= today),
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


// ---------------------------------------------------------------------------------------------
// Google events, through SerpApi (https://serpapi.com, engine "google_events"). Google has no public events API;
// SerpApi returns the events box you see on google.com as JSON. The key stays on the server.
// Each search uses one SerpApi credit, so answers are cached for an hour.
// ---------------------------------------------------------------------------------------------
const SERP_URL = "https://serpapi.com/search.json";
const GOOGLE_CACHE_MS = 60 * 60 * 1000;
const GOOGLE_PAGE = 10; // Google returns 10 events per page
const COUNTRY_NAMES = { IN: "India", US: "United States", GB: "United Kingdom", AU: "Australia", CA: "Canada", AE: "United Arab Emirates", NZ: "New Zealand", IE: "Ireland", DE: "Germany" };
const GL = { GB: "uk" }; // Google's country code for the UK is "uk"
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");

// "Nov 20" -> "2026-11-20". Google leaves the year out, and lists upcoming events, so a date long gone means next year.
// A date that passed in the last 90 days is an event that already started or ended: null, so it is dropped.
export function parseGoogleDate(startDate, today) {
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\b/.exec(String(startDate || "").trim());
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (month < 0) return null;
  const day = Number(m[2]);
  const year = Number(today.slice(0, 4));
  const real = (y) => { // a day that does not exist (Feb 31) is rejected
    const iso = `${y}-${pad(month + 1)}-${pad(day)}`;
    return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
  };
  const iso = real(year);
  if (!iso) return null;
  if (iso < today) {
    const daysAgo = (Date.parse(today) - Date.parse(iso)) / 86400000;
    if (daysAgo <= 90) return null;
    return real(year + 1);
  }
  return iso;
}

// "Fri, Nov 20, 7:00 – 10:00 PM IST" -> "19:00". Returns "" when there is no clock time.
export function parseGoogleTime(when) {
  const text = String(when || "");
  const to24 = (t, ap) => {
    const [h, m = "00"] = t.split(":");
    let hour = Number(h) % 12;
    if (/pm/i.test(ap)) hour += 12;
    return `${pad(hour)}:${m}`;
  };
  const range = /(\d{1,2}(?::\d{2})?)\s*(AM|PM)?\s*(?:\u2013|-|to)\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i.exec(text);
  if (range) return to24(range[1], range[2] || range[4]);
  const one = /(\d{1,2}(?::\d{2})?)\s*(AM|PM)/i.exec(text);
  return one ? to24(one[1], one[2]) : "";
}

// One SerpApi event -> Gather shape. Returns null for events that have no usable date, or that are not in the future.
export function normalizeGoogleEvent(e, ctx) {
  const date = parseGoogleDate(e.date?.start_date, ctx.today);
  if (!date || date < ctx.today) return null;
  const tickets = (e.ticket_info || []).find((t) => t.link_type === "tickets") || (e.ticket_info || [])[0];
  const url = tickets?.link || e.link || "";
  const title = String(e.title || "").trim();
  if (!title || !url) return null;
  const address = Array.isArray(e.address) ? e.address : [];
  const cityLine = address[1] || "";
  return {
    id: "g-" + crypto.createHash("sha1").update(`${title}|${date}|${e.venue?.name || address[0] || ""}`).digest("hex").slice(0, 12),
    source: "Google",
    title: title.slice(0, 160),
    category: "Event",
    genre: ctx.topic || "",
    date,
    time: parseGoogleTime(e.date?.when),
    location: String(e.venue?.name || address[0] || "").slice(0, 120),
    city: cityLine.split(",")[0].trim() || ctx.city || "",
    country: ctx.country,
    url,
    image: e.thumbnail || e.image || "",
    priceText: "See site", // Google's event listings do not carry prices
  };
}

export function googleQuery({ q, city, topic, country }) {
  const what = [topic, q].filter(Boolean).join(" ").trim();
  const where = [city, COUNTRY_NAMES[country] || "India"].filter(Boolean).join(", ");
  return `${what ? what + " " : ""}events in ${where}`;
}

export async function searchGoogleEvents(query, fetchImpl = fetch, env = process.env) {
  if (!env.SERPAPI_KEY) throw new AppError(503, "Online events are not configured yet.", "NOT_CONFIGURED");
  const today = todayISO(env.EVENT_UTC_OFFSET);
  const country = COUNTRY_NAMES[query.country] ? query.country : "IN"; // Google results always need a country: India by default
  const { q, city, topic = "", page } = query;
  const key = JSON.stringify(["google", q, city, country, topic, page]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < GOOGLE_CACHE_MS) return hit.data;

  const params = new URLSearchParams({
    engine: "google_events", q: googleQuery({ q, city, topic, country }), hl: "en", gl: GL[country] || country.toLowerCase(),
    start: String(page * GOOGLE_PAGE), api_key: env.SERPAPI_KEY,
  });
  try {
    const res = await fetchImpl(`${SERP_URL}?${params}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    const noResults = /hasn't returned any results/i.test(String(body.error || ""));
    if ((!res.ok || body.error) && !noResults) throw new Error(`provider status ${res.status}`);
    const raw = body.events_results || [];
    const data = {
      events: raw.map((e) => normalizeGoogleEvent(e, { today, topic, city, country })).filter((e) => e && e.date >= (query.from > today ? query.from : today)),
      hasMore: raw.length >= GOOGLE_PAGE && page < 4,
    };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    console.error("google events failed:", err.message); // never send provider details or the key to the browser
    if (hit) return hit.data;
    throw new AppError(502, "Could not load online events right now. Please try again later.", "PROVIDER_ERROR");
  }
}

// EVENTS_PROVIDER=google | ticketmaster | auto (default). Auto: India -> Google, everywhere else -> Ticketmaster,
// and whichever key exists is used when only one is set.
export function pickProvider(query, env = process.env) {
  const want = String(env.EVENTS_PROVIDER || "auto").toLowerCase();
  const hasTm = Boolean(env.TICKETMASTER_API_KEY);
  const hasGoogle = Boolean(env.SERPAPI_KEY);
  if (want === "google") return hasGoogle ? "google" : null;
  if (want === "ticketmaster") return hasTm ? "ticketmaster" : null;
  const country = query.country === "ALL" ? "" : query.country || env.TICKETMASTER_COUNTRY_CODE || "";
  if (hasGoogle && (country === "IN" || !hasTm)) return "google";
  return hasTm ? "ticketmaster" : null;
}

export async function searchEvents(query, fetchImpl = fetch, env = process.env) {
  const provider = pickProvider(query, env);
  if (!provider) throw new AppError(503, "Online events are not configured yet.", "NOT_CONFIGURED");
  const data = provider === "google" ? await searchGoogleEvents(query, fetchImpl, env) : await searchTicketmaster(query, fetchImpl, env);
  const today = todayISO(env.EVENT_UTC_OFFSET);
  return { ...data, events: data.events.filter((e) => e.date >= today) }; // a cached answer can be hours old: re-check
}
