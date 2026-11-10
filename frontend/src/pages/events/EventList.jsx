import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listEvents } from "../../api";
import { isPast } from "../../validation.js";
import { CATEGORIES, money, fmtDate, fmtTime, canManage, isStaff, seatsLeft } from "./helpers.js";

export default function EventList() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [when, setWhen] = useState("upcoming");
  const [price, setPrice] = useState("any");

  useEffect(() => {
    listEvents().then(setEvents).catch((e) => setError(e.message));
  }, []);

  const visible = (events || [])
    .filter((e) =>
      (staff || e.status === "Published") && (e.status !== "Cancelled" || staff) &&
      (cat === "All" || e.category === cat) &&
      (when === "all" || (when === "past") === isPast(e)) &&
      (price === "any" || (price === "free") === (e.price === 0)) &&
      `${e.title} ${e.location}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) * (when === "past" ? -1 : 1));

  return (
    <PageLayout>
      <div className="ev-head">
        <div><h1>Browse events</h1><p className="ws-sub" style={{ margin: 0 }}>Find something to attend.</p></div>
        {staff && <Link className="ev-btn" to="/events/new">Create event</Link>}
      </div>

      <div className="ev-filters">
        <input type="search" placeholder="Search by name or location" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option>All</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When">
          <option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All dates</option>
        </select>
        <select value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price">
          <option value="any">Any price</option><option value="free">Free</option><option value="paid">Paid</option>
        </select>
      </div>

      {error && <p className="ev-error">{error}</p>}
      {!events && !error && <p className="ev-muted">Loading events...</p>}
      {events && visible.length === 0 && <p className="ev-muted">No events match your filters.</p>}

      <div className="ev-grid">
        {visible.map((e) => {
          const left = seatsLeft(e);
          const ended = isPast(e);
          return (
            <article className={`ev-card ${ended ? "ev-ended" : ""}`} key={e.id}>
              <div className="ev-row">
                <span className="ev-tag">{e.category}</span>
                {e.status === "Cancelled" ? <span className="chip bad">Cancelled</span> : ended ? <span className="chip mute">Ended</span>
                  : staff && <span className={`ev-status ${e.status.toLowerCase()}`}>{e.status}</span>}
              </div>
              <h3>{e.title}</h3>
              <p className="ev-muted">{fmtDate(e.date)} at {fmtTime(e.time)}</p>
              <p className="ev-muted">{e.location}</p>
              <p className="ev-row"><strong>{money(e.price)}</strong><span className="ev-muted">{ended ? "Booking closed" : left > 0 ? `${left} seats left` : "Sold out"}</span></p>
              <div className="ev-actions">
                <Link className="ev-btn ghost" to={`/events/${e.id}`}>View details</Link>
                {canManage(user, e) && <Link className="ev-btn ghost" to={`/events/${e.id}/edit`}>Edit</Link>}
              </div>
            </article>
          );
        })}
      </div>
    </PageLayout>
  );
}
