import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import CountUp from "../../components/CountUp.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getEvent, listManagedBookings, listCheckIns, setEventStatus, deleteEvent, cancelEvent } from "../../api";
import { isPast } from "../../validation.js";
import { money, inr, fmtDate, fmtTime, canManage, seatsLeft, downloadCsv, eventChip, bookingChip } from "./helpers.js";

// "Event workspace": everything an organizer needs for ONE event.
export default function EventManage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [used, setUsed] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState(state?.message || "");
  const [actErr, setActErr] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, b, c] = await Promise.all([getEvent(id), listManagedBookings(user), listCheckIns(id)]);
      setEvent(e); setBookings(b.filter((x) => x.eventId === String(id))); setUsed(c);
    } catch (err) { setError(err.message); }
  }, [id, user]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const paid = bookings.filter((b) => b.status === "CONFIRMED");
    return {
      tickets: paid.reduce((s, b) => s + b.quantity, 0),
      revenue: paid.reduce((s, b) => s + b.amount, 0),
      pending: bookings.filter((b) => b.status === "PENDING_PAYMENT").length,
      refunded: bookings.filter((b) => b.status === "CANCELLED").reduce((s, b) => s + (b.refundAmount || 0), 0),
      paid,
    };
  }, [bookings]);

  if (error) return <PageLayout><p className="ev-error">{error}</p><Link to="/my-events">Back to my events</Link></PageLayout>;
  if (!event) return <PageLayout><Skeleton /></PageLayout>;
  if (!canManage(user, event)) return <PageLayout><p className="ev-error">You can only manage your own events.</p><Link to="/events">Back to events</Link></PageLayout>;

  const past = isPast(event);
  const cancelled = event.status === "Cancelled";
  const fill = event.capacity ? Math.round((event.booked / event.capacity) * 100) : 0;
  const inRate = stats.tickets ? Math.round((used.length / stats.tickets) * 100) : 0;

  const toggle = async () => {
    setNote(""); setActErr("");
    try { await setEventStatus(id, event.status === "Published" ? "Draft" : "Published", user); await load(); setNote("Status updated."); }
    catch (e) { setActErr(e.message); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setNote(""); setActErr("");
    try { await deleteEvent(id, user); navigate("/my-events", { replace: true }); } catch (e) { setActErr(e.message); }
  };
  const doCancel = async (e) => {
    e.preventDefault();
    setNote(""); setActErr(""); setBusy(true);
    try {
      const r = await cancelEvent(id, reason, user);
      setCancelling(false); setReason("");
      setNote(`Event cancelled. ${r.bookings} booking(s) cancelled and ${inr(r.refunded)} refunded.`);
      await load();
    } catch (err) { setActErr(err.message); } finally { setBusy(false); }
  };
  const exportCsv = () => downloadCsv(`${event.title.replace(/\W+/g, "-")}-attendees.csv`, [
    ["Name", "Email", "Tickets", "Amount (INR)", "Status", "Booked on", "Ticket codes"],
    ...bookings.map((b) => [b.userName || "", b.userEmail, b.quantity, b.amount, b.status, new Date(b.createdAt).toLocaleString("en-IN"), b.tickets.join(" ")]),
  ]);
  const usedSet = new Set(used.map((u) => u.code));

  return (
    <PageLayout>
      <Link to="/my-events" className="ev-back">Back to my events</Link>
      <div className="ev-head">
        <div>
          <h1>{event.title}</h1>
          <p className="ws-sub" style={{ margin: 0 }}>
            {fmtDate(event.date)} at {fmtTime(event.time)} · {event.location}{" "}
            {event.status === "Cancelled" ? <span className="chip bad">Cancelled</span> : past ? <span className="chip mute">Ended</span> : <span className={`chip ${eventChip(event.status)}`}>{event.status}</span>}
          </p>
        </div>
        <div className="ws-actions">
          {!cancelled && <Link className="ev-btn" to={`/events/${id}/edit`}>Edit event</Link>}
          <Link className="ev-btn ghost" to={`/events/${id}`}>Public page</Link>
        </div>
      </div>

      {note && <p className="ev-ok" role="status">{note}</p>}
      {actErr && <p className="ev-error" role="alert">{actErr}</p>}

      <div className="ws-stats">
        <div className="ws-stat"><p>Tickets sold</p><strong><CountUp>{stats.tickets || event.booked}</CountUp></strong><span>{seatsLeft(event)} seats left of {event.capacity}</span></div>
        <div className="ws-stat"><p>Revenue</p><strong><CountUp>{inr(stats.revenue)}</CountUp></strong><span>{event.price === 0 ? "Free event" : `${money(event.price)} per ticket`}</span></div>
        <div className="ws-stat"><p>Checked in</p><strong><CountUp>{used.length}</CountUp></strong><span>{inRate}% of sold tickets</span></div>
        <div className="ws-stat"><p>{cancelled ? "Refunded" : "Pending payment"}</p><strong><CountUp>{cancelled ? inr(stats.refunded) : stats.pending}</CountUp></strong><span>{cancelled ? "Event cancelled" : "Not yet confirmed"}</span></div>
      </div>

      <div className="ws-grid2">
        <section className="ws-panel">
          <div className="ev-row"><h2>Attendees</h2><button className="ws-btn" type="button" onClick={exportCsv} disabled={!bookings.length}>Export CSV</button></div>
          {bookings.length === 0 ? (
            <p className="ws-empty">No bookings yet.{event.status !== "Published" && " Publish the event so attendees can book."}</p>
          ) : (
            <div className="ws-table-wrap"><table className="ws-table">
              <thead><tr><th>Guest</th><th className="num">Tickets</th><th className="num">Paid</th><th>Status</th><th>Entry</th></tr></thead>
              <tbody>{bookings.map((b) => {
                const entered = b.tickets.filter((t) => usedSet.has(t)).length;
                return (
                  <tr key={b.id}>
                    <td><strong>{b.userName || b.userEmail}</strong><div className="ev-muted">{b.userEmail}</div></td>
                    <td className="num">{b.quantity}</td>
                    <td className="num">{money(b.amount)}</td>
                    <td><span className={`chip ${bookingChip(b.status)[0]}`}>{bookingChip(b.status)[1]}</span></td>
                    <td>{b.status === "CONFIRMED" ? `${entered}/${b.quantity} in` : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
          {event.booked > stats.tickets && <p className="ev-muted" style={{ marginTop: 10 }}>{event.booked - stats.tickets} seats in this event were pre-loaded sample data, so they have no attendee records.</p>}
        </section>

        <aside>
          <section className="ws-panel">
            <h2>Seats filled</h2>
            <div className="progress" aria-label={`${fill}% filled`}><i style={{ width: `${fill}%` }} /></div>
            <p className="ev-muted">{event.booked} of {event.capacity} booked ({fill}%)</p>
          </section>
          <section className="ws-panel">
            <h2>Actions</h2>
            <div className="ws-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {!cancelled && <Link className="ws-btn primary" to="/checkin" state={{ eventId: id }}>Open QR check-in</Link>}
              {!past && !cancelled && <button className="ws-btn" type="button" onClick={toggle}>{event.status === "Published" ? "Unpublish (move to Draft)" : "Publish event"}</button>}
              {!past && !cancelled && <button className="ws-btn danger" type="button" onClick={() => setCancelling((v) => !v)}>Cancel event and refund all</button>}
              <button className="ws-btn danger" type="button" onClick={remove}>Delete event</button>
            </div>
          </section>
          {cancelling && (
            <form className="ws-panel" onSubmit={doCancel}>
              <h2>Cancel this event</h2>
              <p className="ev-muted">Every booking is cancelled and refunded in full, and attendees see your reason. This cannot be undone.</p>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to attendees" maxLength={200} required style={{ marginTop: 8 }} />
              <div className="ws-actions" style={{ marginTop: 10 }}>
                <button className="ws-btn danger" type="submit" disabled={busy}>{busy ? "Cancelling..." : "Confirm cancellation"}</button>
                <button className="ws-btn" type="button" onClick={() => setCancelling(false)}>Keep event</button>
              </div>
            </form>
          )}
          <section className="ws-panel">
            <h2>Details</h2>
            <p className="ev-muted">{event.description || "No description."}</p>
            {cancelled && event.cancelReason && <p className="ev-error" style={{ marginTop: 8 }}>Cancelled: {event.cancelReason}</p>}
            <p className="ev-muted" style={{ marginTop: 8 }}>{event.category}</p>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}
