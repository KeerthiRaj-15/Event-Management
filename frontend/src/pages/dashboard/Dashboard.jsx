import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listEvents, listBookings, listManagedEvents, listManagedBookings } from "../../api";
import { isPast } from "../../validation.js";
import { money, inr, eventChip, bookingChip, fmtDate, fmtTime, greeting, seatsLeft } from "../events/helpers.js";

function Stat({ label, value, note }) {
  return <div className="ws-stat"><p>{label}</p><strong>{value}</strong>{note && <span>{note}</span>}</div>;
}

// Role-based landing page. Admins have their own dashboard at /admin.
export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === "Admin") return <Navigate to="/admin" replace />;
  return user.role === "Organizer" ? <OrganizerHome user={user} /> : <AttendeeHome user={user} />;
}

function Head({ user, sub, children }) {
  return (
    <div className="ev-head">
      <div><h1>{greeting()}, {user.name.split(" ")[0]}</h1><p className="ws-sub" style={{ margin: 0 }}>{sub}</p></div>
      {children}
    </div>
  );
}

function AttendeeHome({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([listBookings(user), listEvents()]).then(([b, e]) => setData({ b, e })).catch((x) => setError(x.message));
  }, [user]);

  if (error) return <PageLayout><p className="ev-error">{error}</p></PageLayout>;
  if (!data) return <PageLayout><p className="ev-muted">Loading...</p></PageLayout>;

  const confirmed = data.b.filter((b) => b.status === "CONFIRMED");
  const upcoming = confirmed.filter((b) => !isPast({ date: b.eventDate, time: b.eventTime })).sort((a, b) => `${a.eventDate}${a.eventTime}`.localeCompare(`${b.eventDate}${b.eventTime}`));
  const pending = data.b.filter((b) => b.status === "PENDING_PAYMENT");
  const booked = new Set(data.b.map((b) => b.eventId));
  const suggested = data.e.filter((e) => e.status === "Published" && !isPast(e) && seatsLeft(e) > 0 && !booked.has(e.id)).slice(0, 4);

  return (
    <PageLayout>
      <Head user={user} sub="Your tickets and upcoming events.">
        <Link className="ev-btn" to="/events">Browse events</Link>
      </Head>

      {pending.length > 0 && (
        <p className="ev-warn">You have {pending.length} booking{pending.length > 1 ? "s" : ""} waiting for payment. <Link to={`/checkout/${pending[0].id}`}>Complete payment</Link></p>
      )}

      <div className="ws-stats" style={{ marginTop: 16 }}>
        <Stat label="Upcoming events" value={upcoming.length} note="With confirmed tickets" />
        <Stat label="Tickets held" value={confirmed.reduce((s, b) => s + b.quantity, 0)} note="All confirmed bookings" />
        <Stat label="Total spent" value={inr(confirmed.reduce((s, b) => s + b.amount, 0))} />
        <Stat label="Awaiting payment" value={pending.length} />
      </div>

      <div className="ws-grid2">
        <section className="ws-panel">
          <div className="ev-row"><h2>Your next events</h2><Link to="/tickets">All tickets</Link></div>
          {upcoming.length === 0 ? (
            <div className="ws-empty"><h3>No upcoming tickets</h3><p>Find an event and book your first ticket.</p><Link className="ev-btn" to="/events">Browse events</Link></div>
          ) : (
            <ul className="ws-list">
              {upcoming.slice(0, 5).map((b) => (
                <li key={b.id}>
                  <div><strong>{b.eventTitle}</strong><span className="ev-muted">{fmtDate(b.eventDate)} at {fmtTime(b.eventTime)} · {b.location}</span></div>
                  <Link className="ws-btn" to="/tickets">{b.quantity} ticket{b.quantity > 1 ? "s" : ""}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="ws-panel">
          <h2>Happening soon</h2>
          {suggested.length === 0 ? <p className="ev-muted">Nothing new right now.</p> : (
            <ul className="ws-list">
              {suggested.map((e) => (
                <li key={e.id}><div><strong>{e.title}</strong><span className="ev-muted">{fmtDate(e.date)} · {money(e.price)}</span></div><Link className="ws-btn" to={`/events/${e.id}`}>View</Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageLayout>
  );
}

function OrganizerHome({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([listManagedEvents(user), listManagedBookings(user)]).then(([e, b]) => setData({ e, b })).catch((x) => setError(x.message));
  }, [user]);

  if (error) return <PageLayout><p className="ev-error">{error}</p></PageLayout>;
  if (!data) return <PageLayout><p className="ev-muted">Loading...</p></PageLayout>;

  const paid = data.b.filter((b) => b.status === "CONFIRMED");
  const upcoming = data.e.filter((e) => !isPast(e) && e.status !== "Cancelled").sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const drafts = data.e.filter((e) => e.status === "Draft" && !isPast(e));

  return (
    <PageLayout>
      <Head user={user} sub="Here is how your events are doing.">
        <Link className="ev-btn" to="/events/new">Create event</Link>
      </Head>

      {data.e.length === 0 ? (
        <div className="ws-panel ws-empty" style={{ marginTop: 16 }}><h3>Create your first event</h3><p>Add a date, venue and price, then publish it to start taking bookings.</p><Link className="ev-btn" to="/events/new">Create event</Link></div>
      ) : (
        <>
          <div className="ws-stats" style={{ marginTop: 16 }}>
            <Stat label="My events" value={data.e.length} note={`${upcoming.length} upcoming`} />
            <Stat label="Published" value={data.e.filter((e) => e.status === "Published").length} note={`${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting`} />
            <Stat label="Tickets sold" value={data.e.reduce((s, e) => s + e.booked, 0)} note="Across all events" />
            <Stat label="Revenue" value={inr(paid.reduce((s, b) => s + b.amount, 0))} note="From confirmed bookings" />
          </div>

          <div className="ws-grid2">
            <section className="ws-panel">
              <div className="ev-row"><h2>Upcoming events</h2><Link to="/my-events">View all</Link></div>
              {upcoming.length === 0 ? <p className="ev-muted">No upcoming events.</p> : (
                <ul className="ws-list">
                  {upcoming.slice(0, 5).map((e) => (
                    <li key={e.id}>
                      <div><strong>{e.title}</strong><span className="ev-muted">{fmtDate(e.date)} · {e.booked}/{e.capacity} booked · <span className={`chip ${eventChip(e.status)}`}>{e.status}</span></span></div>
                      <div className="ws-actions"><Link className="ws-btn primary" to={`/events/${e.id}/edit`}>Edit</Link><Link className="ws-btn" to={`/events/${e.id}/manage`}>Workspace</Link></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="ws-panel">
              <h2>Recent bookings</h2>
              {data.b.length === 0 ? <p className="ev-muted">No bookings yet.</p> : (
                <ul className="ws-list">
                  {data.b.slice(0, 6).map((b) => (
                    <li key={b.id}><div><strong>{b.userName || b.userEmail}</strong><span className="ev-muted">{b.eventTitle} · {b.quantity} ticket{b.quantity > 1 ? "s" : ""}</span></div><span className={`chip ${bookingChip(b.status)[0]}`}>{b.status === "CANCELLED" ? "Cancelled" : inr(b.amount)}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </PageLayout>
  );
}
