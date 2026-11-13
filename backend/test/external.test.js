import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { normalizeTicketmaster, cleanQuery, searchTicketmaster, clearExternalCache } from "../src/services/external.js";
import { externalRouter } from "../src/routes/external.js";
import { errorHandler } from "../src/middleware/error.js";

const sample = {
  id: "Z1", name: "Jazz Night", url: "https://www.ticketmaster.com/e/Z1",
  dates: { start: { localDate: "2026-12-01", localTime: "19:30:00" } },
  images: [{ url: "https://img/big.jpg", width: 1024 }, { url: "https://img/mid.jpg", width: 640 }, { url: "https://img/tiny.jpg", width: 100 }],
  classifications: [{ segment: { name: "Music" } }],
  priceRanges: [{ min: 500, max: 1500, currency: "INR" }],
  _embedded: { venues: [{ name: "NCPA", city: { name: "Mumbai" } }] },
};
const env = { TICKETMASTER_API_KEY: "k", TICKETMASTER_COUNTRY_CODE: "IN", TICKETMASTER_CITY: "" };
const okFetch = (log = []) => async (url) => { log.push(new URL(url)); return { ok: true, json: async () => ({ _embedded: { events: [sample, { id: "Z3", name: "No date" }] }, page: { totalPages: 3 } }) }; };

test("normalizeTicketmaster maps fields and picks a mid-size image", () => {
  assert.deepEqual(normalizeTicketmaster(sample), {
    id: "tm-Z1", source: "Ticketmaster", title: "Jazz Night", category: "Music", date: "2026-12-01", time: "19:30",
    location: "NCPA", city: "Mumbai", url: "https://www.ticketmaster.com/e/Z1", image: "https://img/mid.jpg", priceText: "INR 500 - 1500",
  });
});

test("normalizeTicketmaster survives missing optional fields", () => {
  const n = normalizeTicketmaster({ id: "Z2", name: "X", dates: { start: { localDate: "2026-12-02" } } });
  assert.equal(n.priceText, "See site"); assert.equal(n.city, ""); assert.equal(n.time, ""); assert.equal(n.image, "");
});

test("cleanQuery clamps and rejects bad input", () => {
  const q = cleanQuery({ q: "x".repeat(500), city: " Pune ", from: "not-a-date", page: "999" });
  assert.equal(q.q.length, 80); assert.equal(q.city, "Pune"); assert.equal(q.from, ""); assert.equal(q.page, 20);
  assert.equal(cleanQuery({ page: "-4" }).page, 0);
  assert.equal(cleanQuery({ from: "2026-12-01" }).from, "2026-12-01");
});

test("searchTicketmaster sends the right request, drops events without date/url, reports paging", async () => {
  clearExternalCache();
  const log = [];
  const r = await searchTicketmaster({ q: "jazz", city: "Mumbai", from: "2026-12-01", page: 0 }, okFetch(log), env);
  assert.equal(r.events.length, 1); assert.equal(r.hasMore, true);
  const p = log[0].searchParams;
  assert.equal(p.get("keyword"), "jazz"); assert.equal(p.get("city"), "Mumbai"); assert.equal(p.get("countryCode"), "IN");
  assert.equal(p.get("startDateTime"), "2026-12-01T00:00:00Z"); assert.equal(p.get("apikey"), "k");
  clearExternalCache();
  assert.equal((await searchTicketmaster({ q: "", city: "", from: "", page: 2 }, okFetch(), env)).hasMore, false);
});

test("repeat searches are served from the cache (one provider call)", async () => {
  clearExternalCache();
  const log = [];
  const q = { q: "cache", city: "", from: "2026-12-01", page: 0 };
  await searchTicketmaster(q, okFetch(log), env); await searchTicketmaster(q, okFetch(log), env);
  assert.equal(log.length, 1, "second call must come from cache");
});

test("provider failure becomes a safe 502 with no key or provider detail", async () => {
  clearExternalCache();
  await assert.rejects(
    searchTicketmaster({ q: "boom", city: "", from: "", page: 0 }, async () => ({ ok: false, status: 429 }), env),
    (e) => e.status === 502 && e.code === "PROVIDER_ERROR" && !/429|apikey|k$/.test(e.message),
  );
});

test("missing API key returns 503 NOT_CONFIGURED", async () => {
  await assert.rejects(searchTicketmaster({ q: "", city: "", from: "", page: 0 }, okFetch(), {}), (e) => e.status === 503 && e.code === "NOT_CONFIGURED");
});

// ---- the route itself, with a fake login so no database is needed ----
function get(server, path) {
  return new Promise((resolve, reject) => {
    http.get({ port: server.address().port, path }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(body || "{}") }));
    }).on("error", reject);
  });
}

test("GET /external/events: requires login, validates query, returns events", async () => {
  clearExternalCache();
  Object.assign(process.env, env);
  const realFetch = globalThis.fetch; const seen = [];
  globalThis.fetch = async (url) => okFetch(seen)(url);
  let loggedIn = true;
  const app = express();
  app.use("/x", externalRouter((req, res, next) => (loggedIn ? ((req.user = { _id: "u1" }), next()) : res.status(401).json({ message: "Please log in." }))));
  app.use(errorHandler);
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  try {
    const ok = await get(server, "/x/events?q=jazz&city=Mumbai&from=bad&page=999");
    assert.equal(ok.status, 200); assert.equal(ok.body.events[0].title, "Jazz Night");
    assert.equal(seen[0].searchParams.get("page"), "20"); // clamped
    assert.match(seen[0].searchParams.get("startDateTime"), /^\d{4}-\d{2}-\d{2}T00:00:00Z$/); // bad "from" replaced by today
    loggedIn = false;
    assert.equal((await get(server, "/x/events")).status, 401);
  } finally { globalThis.fetch = realFetch; server.close(); }
});
