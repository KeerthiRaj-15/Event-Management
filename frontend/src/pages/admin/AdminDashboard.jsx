import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listUsers, updateUserAdmin, listManagedEvents, listManagedBookings, setEventStatus } from "../../api";
import { isPast } from "../../validation.js";
import { inr, fmtDate, eventChip, bookingChip } from "../events/helpers.js";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState("users");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [u, e, b] = await Promise.all([listUsers(), listManagedEvents(user), listManagedBookings(user)]);
      setUsers(u); setEvents(e); setBookings(b);
    } catch (err) { setError(err.message); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => {
    setError(""); setNote("");
    try { await fn(); setNote(ok); await load(); } catch (e) { setError(e.message); }
  };

  const paid = useMemo(() => bookings.filter((b) => b.status === "CONFIRMED"), [bookings]);
  const needle = q.trim().toLowerCase();
  const userRows = (users || []).filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(needle));
  const eventRows = events.filter((e) => `${e.title} ${e.organizerEmail}`.toLowerCase().includes(needle));
  const bookingRows = bookings.filter((b) => `${b.eventTitle} ${b.userEmail} ${b.userName || ""}`.toLowerCase().includes(needle));

  if (!users && !error) return <PageLayout><Skeleton /></PageLayout>;

  return (
    <PageLayout>
      <h1>Admin dashboard</h1>
      <p className="ws-sub">Platform overview, users, events and bookings.</p>
      {error && <p className="ev-error" role="alert">{error}</p>}
      {note && <p className="ev-ok" role="status">{note}</p>}

      <div className="ws-stats">
        <div className="ws-stat"><p>Users</p><strong>{users?.length ?? 0}</strong><span>{users?.filter((u) => u.role === "Organizer").length ?? 0} organizers</span></div>
        <div className="ws-stat"><p>Events</p><strong>{events.length}</strong><span>{events.filter((e) => e.status === "Published").length} published · {events.filter((e) => !isPast(e)).length} upcoming</span></div>
        <div className="ws-stat"><p>Tickets sold</p><strong>{events.reduce((s, e) => s + e.booked, 0)}</strong><span>{bookings.filter((b) => b.status === "PENDING_PAYMENT").length} awaiting payment · {bookings.filter((b) => b.status === "CANCELLED").length} cancelled</span></div>
        <div className="ws-stat"><p>Revenue</p><strong>{inr(paid.reduce((s, b) => s + b.amount, 0))}</strong><span><Link to="/reports">Open reports</Link></span></div>
      </div>

      <div className="ws-tabs" role="tablist">
        {[["users", "Users"], ["events", "Events"], ["bookings", "Bookings"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="ev-filters"><input type="search" placeholder={`Search ${tab}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /></div>

      <section className="ws-panel"><div className="ws-table-wrap">
        {tab === "users" && (
          <table className="ws-table stack">
            <thead><tr><th>User</th><th>Role</th><th>Verified</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              {userRows.map((u) => {
                const me = u.email === user.email;
                return (
                  <tr key={u.email}>
                    <td><strong>{u.name}</strong>{me && " (you)"}<div className="ev-muted">{u.email}</div></td>
                    <td data-label="Role">
                      <select value={u.role} disabled={me} aria-label={`Role for ${u.email}`}
                        onChange={(e) => act(() => updateUserAdmin(u.email, { role: e.target.value }, user), `${u.name} is now ${e.target.value}.`)}>
                        <option>Attendee</option><option>Organizer</option><option>Admin</option>
                      </select>
                    </td>
                    <td data-label="Verified">{u.verified ? <span className="chip ok">Verified</span> : <span className="chip warn">Pending</span>}</td>
                    <td data-label="Status">
                      <button className={`ws-btn ${u.active ? "danger" : ""}`} disabled={me} type="button"
                        onClick={() => act(() => updateUserAdmin(u.email, { active: !u.active }, user), u.active ? `${u.name} deactivated.` : `${u.name} reactivated.`)}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </td>
                    <td data-label="Joined">{u.createdAt ? fmtDate(u.createdAt.slice(0, 10)) : "—"}</td>
                  </tr>
                );
              })}
              {userRows.length === 0 && <tr><td colSpan={5} className="ws-empty">No users found.</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "events" && (
          <table className="ws-table stack">
            <thead><tr><th>Event</th><th>Organizer</th><th>Date</th><th>Status</th><th className="num">Booked</th><th>Actions</th></tr></thead>
            <tbody>
              {eventRows.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/events/${e.id}/manage`}><strong>{e.title}</strong></Link></td>
                  <td data-label="Organizer">{e.organizerEmail}</td>
                  <td data-label="Date">{fmtDate(e.date)}</td>
                  <td data-label="Status">{isPast(e) ? <span className="chip mute">Ended</span> : <span className={`chip ${eventChip(e.status)}`}>{e.status}</span>}</td>
                  <td className="num" data-label="Booked">{e.booked}/{e.capacity}</td>
                  <td data-label="Actions"><div className="ws-actions">
                    <Link className="ws-btn" to={`/events/${e.id}/edit`}>Edit</Link>
                    {!isPast(e) && e.status !== "Cancelled" && <button className="ws-btn" type="button" onClick={() => act(() => setEventStatus(e.id, e.status === "Published" ? "Draft" : "Published", user), "Status updated.")}>{e.status === "Published" ? "Unpublish" : "Publish"}</button>}
                  </div></td>
                </tr>
              ))}
              {eventRows.length === 0 && <tr><td colSpan={6} className="ws-empty">No events found.</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "bookings" && (
          <table className="ws-table">
            <thead><tr><th>Booking</th><th>Event</th><th className="num">Tickets</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {bookingRows.slice(0, 100).map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.userName || b.userEmail}</strong><div className="ev-muted">{b.id} · {fmtDate(b.createdAt.slice(0, 10))}</div></td>
                  <td>{b.eventTitle}</td>
                  <td className="num">{b.quantity}</td>
                  <td className="num">{inr(b.amount)}</td>
                  <td><span className={`chip ${bookingChip(b.status)[0]}`}>{bookingChip(b.status)[1]}</span></td>
                </tr>
              ))}
              {bookingRows.length === 0 && <tr><td colSpan={5} className="ws-empty">No bookings yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div></section>
    </PageLayout>
  );
}
