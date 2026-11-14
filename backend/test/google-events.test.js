import test from "node:test";
import assert from "node:assert/strict";
import {
  parseGoogleDate, parseGoogleTime, normalizeGoogleEvent, googleQuery, searchGoogleEvents, pickProvider, searchEvents,
  todayISO, clearExternalCache,
} from "../src/services/external.js";

const TODAY = "2026-11-14";
const env = { SERPAPI_KEY: "sk", EVENT_UTC_OFFSET: "+05:30" };

test("todayISO uses the app time zone", () => {
  const t = Date.parse("2026-11-13T20:00:00Z"); // 01:30 next day in India
  assert.equal(todayISO("+05:30", t), "2026-11-14");
  assert.equal(todayISO("+00:00", t), "2026-11-13");
});

test("parseGoogleDate: future, next year, already started", () => {
  assert.equal(parseGoogleDate("Nov 20", TODAY), "2026-11-20");
  assert.equal(parseGoogleDate("Nov 14", TODAY), "2026-11-14"); // today is not ended
  assert.equal(parseGoogleDate("Jan 3", TODAY), "2027-01-03"); // long past this year: it means next year
  assert.equal(parseGoogleDate("Nov 2", TODAY), null);          // started 12 days ago: dropped
  assert.equal(parseGoogleDate("Soon", TODAY), null);
  assert.equal(parseGoogleDate("Feb 31", TODAY), null);
});

test("parseGoogleTime reads the start time", () => {
  assert.equal(parseGoogleTime("Fri, Nov 20, 7:00 – 10:00 PM IST"), "19:00");
  assert.equal(parseGoogleTime("Sat, Nov 21, 7 – 9 PM"), "19:00");
  assert.equal(parseGoogleTime("Sat, Nov 21, 11 AM – 2 PM"), "11:00");
  assert.equal(parseGoogleTime("Sun, Nov 22, 12:30 PM"), "12:30");
  assert.equal(parseGoogleTime("Sun, Nov 22, 12 AM"), "00:00");
  assert.equal(parseGoogleTime("Sun, Nov 22"), "");
});

const raw = {
  title: "Premier T20 Night", date: { start_date: "Nov 20", when: "Fri, Nov 20, 7:00 – 10:00 PM IST" },
  address: ["Chinnaswamy Rd", "Bengaluru, Karnataka"], link: "https://www.google.com/search?q=x",
  ticket_info: [{ source: "Site", link: "https://tickets.example.com/a", link_type: "tickets" }],
  venue: { name: "City Cricket Ground" }, thumbnail: "https://img.example.com/t.jpg",
};

test("normalizeGoogleEvent maps fields and prefers the ticket link", () => {
  const n = normalizeGoogleEvent(raw, { today: TODAY, topic: "Cricket", city: "", country: "IN" });
  assert.equal(n.title, "Premier T20 Night"); assert.equal(n.date, "2026-11-20"); assert.equal(n.time, "19:00");
  assert.equal(n.location, "City Cricket Ground"); assert.equal(n.city, "Bengaluru"); assert.equal(n.country, "IN");
  assert.equal(n.url, "https://tickets.example.com/a"); assert.equal(n.genre, "Cricket"); assert.equal(n.source, "Google");
  assert.match(n.id, /^g-[0-9a-f]{12}$/);
});

test("normalizeGoogleEvent drops ended, undated and link-less events", () => {
  const ctx = { today: TODAY, topic: "", city: "", country: "IN" };
  assert.equal(normalizeGoogleEvent({ ...raw, date: { start_date: "Nov 2" } }, ctx), null);
  assert.equal(normalizeGoogleEvent({ ...raw, date: {} }, ctx), null);
  assert.equal(normalizeGoogleEvent({ ...raw, link: "", ticket_info: [] }, ctx), null);
  assert.equal(normalizeGoogleEvent({ ...raw, title: "" }, ctx), null);
});

test("googleQuery puts topic, city and country into the Google search", () => {
  assert.equal(googleQuery({ q: "", city: "", topic: "", country: "IN" }), "events in India");
  assert.equal(googleQuery({ q: "", city: "Bengaluru", topic: "Cricket", country: "IN" }), "Cricket events in Bengaluru, India");
  assert.equal(googleQuery({ q: "jazz", city: "London", topic: "Music", country: "GB" }), "Music jazz events in London, United Kingdom");
});

test("searchGoogleEvents calls SerpApi for India, hides ended events, pages by 10, and caches", async () => {
  clearExternalCache();
  const log = [];
  const ok = async (url) => {
    log.push(new URL(url));
    return { ok: true, status: 200, json: async () => ({ events_results: [raw, { ...raw, title: "Old", date: { start_date: "Nov 2" } }] }) };
  };
  const q = { q: "", city: "Bengaluru", country: "IN", topic: "Cricket", from: "", page: 1 };
  const a = await searchGoogleEvents(q, ok, env);
  assert.equal(a.events.length, 1); assert.equal(a.hasMore, false);
  const p = log[0].searchParams;
  assert.equal(p.get("engine"), "google_events"); assert.equal(p.get("gl"), "in"); assert.equal(p.get("hl"), "en");
  assert.equal(p.get("start"), "10"); assert.equal(p.get("q"), "Cricket events in Bengaluru, India"); assert.equal(p.get("api_key"), "sk");
  await searchGoogleEvents(q, ok, env);
  assert.equal(log.length, 1, "second identical search must come from cache");
});

test("Google 'no results' is an empty list, other failures are a safe 502", async () => {
  clearExternalCache();
  const none = async () => ({ ok: true, status: 200, json: async () => ({ error: "Google hasn't returned any results for this query." }) });
  assert.deepEqual((await searchGoogleEvents({ q: "zzz", city: "", country: "IN", topic: "", from: "", page: 0 }, none, env)).events, []);
  clearExternalCache();
  const bad = async () => ({ ok: false, status: 401, json: async () => ({ error: "Invalid API key. secret-detail" }) });
  await assert.rejects(
    searchGoogleEvents({ q: "x", city: "", country: "IN", topic: "", from: "", page: 0 }, bad, env),
    (e) => e.status === 502 && e.code === "PROVIDER_ERROR" && !/401|secret|sk/.test(e.message),
  );
  await assert.rejects(searchGoogleEvents({ q: "", city: "", country: "IN", topic: "", from: "", page: 0 }, none, {}), (e) => e.status === 503);
});

test("pickProvider: India -> Google, elsewhere -> Ticketmaster, forced by EVENTS_PROVIDER", () => {
  const both = { SERPAPI_KEY: "s", TICKETMASTER_API_KEY: "t" };
  assert.equal(pickProvider({ country: "IN" }, both), "google");
  assert.equal(pickProvider({ country: "GB" }, both), "ticketmaster");
  assert.equal(pickProvider({ country: "ALL" }, both), "ticketmaster");
  assert.equal(pickProvider({ country: "GB" }, { SERPAPI_KEY: "s" }), "google");
  assert.equal(pickProvider({ country: "IN" }, { TICKETMASTER_API_KEY: "t" }), "ticketmaster");
  assert.equal(pickProvider({ country: "IN" }, { ...both, EVENTS_PROVIDER: "ticketmaster" }), "ticketmaster");
  assert.equal(pickProvider({ country: "IN" }, { TICKETMASTER_API_KEY: "t", EVENTS_PROVIDER: "google" }), null);
  assert.equal(pickProvider({ country: "IN" }, {}), null);
});

test("searchEvents never returns events dated before today, even from a stale source", async () => {
  clearExternalCache();
  const e = { SERPAPI_KEY: "s", EVENTS_PROVIDER: "google" };
  const r = await searchEvents({ q: "", city: "", country: "IN", topic: "", from: "", page: 0 },
    async () => ({ ok: true, status: 200, json: async () => ({ events_results: [raw] }) }), e);
  assert.ok(r.events.every((x) => x.date >= todayISO()));
});
