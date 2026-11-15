import React, { useCallback, useEffect, useRef, useState } from "react";
import PageLayout from "../../components/PageLayout.jsx";
import { listExternalEvents } from "../../api";
import { fmtDate, fmtTime } from "../events/helpers.js";
import { todayLocal } from "../../validation.js";
import { TOPICS, COUNTRIES } from "./filters.js";

const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata"];

// Only http(s) links are ever opened. A bad link from an outside feed must not become a javascript: URL.
const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; } catch { return null; } };

// Events from OTHER websites. They cannot be booked or paid for here, so each card links out to the source.
export default function Discover() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [topic, setTopic] = useState("");
  const [from, setFrom] = useState(todayLocal());
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0); // ignore answers from older searches

  const load = useCallback(async (nextPage, replace) => {
    const mine = ++seq.current;
    setLoading(true); setError("");
    try {
      const r = await listExternalEvents({ q, city, country, topic, from, page: nextPage });
      if (mine !== seq.current) return;
      setItems((cur) => (replace ? r.events : [...cur, ...r.events]));
      setHasMore(Boolean(r.hasMore)); setDemo(Boolean(r.demo)); setPage(nextPage);
    } catch (e) {
      if (mine === seq.current) setError(e.message || "Could not load events.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [q, city, country, topic, from]);

  // Search 400 ms after the person stops typing.
  useEffect(() => {
    const t = setTimeout(() => load(0, true), 400);
    return () => clearTimeout(t);
  }, [load]);

  const handleTopicClick = (t) => {
    setTopic((prev) => (prev === t ? "" : t));
  };

  const clearFilters = () => {
    setQ("");
    setCity("");
    setCountry("");
    setTopic("");
    setFrom(todayLocal());
  };

  const hasActiveFilters = q || city || country || topic || from !== todayLocal();

  return (
    <PageLayout>
      <h1>Discover online</h1>
      <p className="ws-sub">Events from other websites. Booking and payment happen on the source site, not on Gather.</p>
      {demo && <p className="ev-warn">Demo data. Connect your backend and an events provider to see live events here.</p>}

      <div className="disc-filters">
        <div className="disc-field disc-search">
          <span>Search</span>
          <input type="search" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        </div>
        <div className="disc-field">
          <span>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            <option value="">All countries</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="disc-field">
          <span>City</span>
          <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="disc-field">
          <span>From date</span>
          <input type="date" value={from} min={todayLocal()} onChange={(e) => setFrom(e.target.value || todayLocal())} aria-label="From date" />
        </div>
        {hasActiveFilters && (
          <button className="disc-clear" type="button" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      <div className="disc-topics" role="group" aria-label="Event categories">
        {TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={`rp-chip ${topic === t ? "active" : ""}`}
            onClick={() => handleTopicClick(t)}
            aria-pressed={topic === t}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <p className="ev-error" role="alert">{error} <button className="ws-btn" type="button" onClick={() => load(0, true)}>Try again</button></p>
      )}
      {loading && items.length === 0 && !error && <p className="ev-muted">Loading events...</p>}
      {!loading && !error && items.length === 0 && <p className="ev-muted">No events found. Try another country, city, or date.</p>}

      <div className="ev-grid">
        {items.map((e) => {
          const link = safeUrl(e.url);
          return (
            <article className="disc-card" key={e.id}>
              {e.image && safeUrl(e.image) && <div className="disc-cover"><img src={safeUrl(e.image)} alt="" loading="lazy" referrerPolicy="no-referrer" /></div>}
              <div className="disc-body">
                <div className="disc-header">
                  <span className="ev-tag">{e.category || "Event"}</span>
                  <span className="chip mute">{e.source}</span>
                </div>
                <h3>{e.title}</h3>
                <p className="disc-line"><span className="disc-ico">📅</span><span>{fmtDate(e.date)}{e.time ? ` at ${fmtTime(e.time)}` : ""}</span></p>
                <p className="disc-line"><span className="disc-ico">📍</span><span>{[e.location, e.city, e.country].filter(Boolean).join(", ")}</span></p>
                <p className="disc-line"><span className="disc-ico">💰</span><strong>{e.priceText || "See site"}</strong></p>
                <div className="disc-foot">
                  {link ? <a className="ev-btn ghost" href={link} target="_blank" rel="noopener noreferrer">View on site</a> : <span className="ev-muted">No link available</span>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {hasMore && <div style={{ textAlign: "center", marginTop: 18 }}><button className="ev-btn ghost" type="button" disabled={loading} onClick={() => load(page + 1, false)}>{loading ? "Loading..." : "Load more"}</button></div>}
      <p className="ev-muted" style={{ marginTop: 18, fontSize: 13 }}>Event details come from third parties and can change. Always confirm on the source site.</p>
    </PageLayout>
  );
}
