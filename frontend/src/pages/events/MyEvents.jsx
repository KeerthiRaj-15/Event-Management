import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listManagedEvents, setEventStatus, deleteEvent } from "../../api";
import { isPast } from "../../validation.js";
import { money, fmtDate, fmtTime, eventChip } from "./helpers.js";

// Organizer / Admin list with every management action in one place: view, edit, publish, delete.
export default function MyEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => listManagedEvents(user).then(setEvents).catch((e) => setError(e.message)), [user]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okText) => {
    setError(""); setNote("");
    try { await fn(); setNote(okText); await load(); } catch (e) { setError(e.message); }
  };

  const rows = (events || [])
    .filter((e) => (filter === "all" || (filter === "past" ? isPast(e) : filter === "upcoming" ? !isPast(e) : e.status.toLowerCase() === filter)))
    .filter((e) => `${e.title} ${e.location}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <PageLayout>
      <div className="ev-head">
        <div><h1>{user.role === "Admin" ? "Manage events" : "My events"}</h1><p className="ws-sub" style={{ margin: 0 }}>Create, edit and publish your events.</p></div>
        <Link className="ev-btn" to="/events/new">Create event</Link>
      </div>

      <div className="ev-filters">
        <input type="search" placeholder="Search your events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="all">All</option><option value="published">Published</option><option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option><option value="upcoming">Upcoming</option><option value="past">Past</option>
        </select>
      </div>

      {note && <p className="ev-ok" role="status">{note}</p>}
      {error && <p className="ev-error" role="alert">{error}</p>}
      {!events && !error && <p className="ev-muted">Loading...</p>}
      {events && rows.length === 0 && (
        <div className="ws-panel ws-empty"><h3>No events here yet</h3><p>Create your first event to start selling tickets.</p><Link className="ev-btn" to="/events/new">Create event</Link></div>
      )}

      {rows.length > 0 && (
        <div className="ws-panel"><div className="ws-table-wrap">
          <table className="ws-table stack">
            <thead><tr><th>Event</th><th>When</th><th>Status</th><th className="num">Price</th><th className="num">Booked</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const past = isPast(e);
                return (
                  <tr key={e.id}>
                    <td><Link to={`/events/${e.id}/manage`}><strong>{e.title}</strong></Link><div className="ev-muted">{e.category} · {e.location}</div></td>
                    <td data-label="When"><span>{fmtDate(e.date)}</span><div className="ev-muted">{fmtTime(e.time)}</div></td>
                    <td data-label="Status">{past ? <span className="chip mute">Ended</span> : <span className={`chip ${eventChip(e.status)}`}>{e.status}</span>}</td>
                    <td className="num" data-label="Price">{money(e.price)}</td>
                    <td className="num" data-label="Booked">{e.booked}/{e.capacity}</td>
                    <td data-label="Actions">
                      <div className="ws-actions">
                        {e.status !== "Cancelled" && <Link className="ws-btn primary" to={`/events/${e.id}/edit`}>Edit</Link>}
                        <Link className="ws-btn" to={`/events/${e.id}/manage`}>Workspace</Link>
                        {!past && e.status !== "Cancelled" && (
                          <button className="ws-btn" type="button"
                            onClick={() => act(() => setEventStatus(e.id, e.status === "Published" ? "Draft" : "Published", user), e.status === "Published" ? "Moved to Draft." : "Event published.")}>
                            {e.status === "Published" ? "Unpublish" : "Publish"}
                          </button>
                        )}
                        <button className="ws-btn danger" type="button"
                          onClick={() => window.confirm(`Delete "${e.title}"? This cannot be undone.`) && act(() => deleteEvent(e.id, user), "Event deleted.")}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      )}
    </PageLayout>
  );
}
