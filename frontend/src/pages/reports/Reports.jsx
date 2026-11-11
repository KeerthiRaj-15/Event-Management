import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import CountUp from "../../components/CountUp.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listManagedEvents, listManagedBookings, listCheckIns } from "../../api";
import { localDate } from "../../validation.js";
import { inr, downloadCsv } from "../events/helpers.js";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

function Bars({ rows, format }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span title={r.label}>{r.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="num">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Time buckets for the trend chart: daily for up to 30 days, weekly for 90 days, monthly for all time.
function makeBuckets(range, firstDate) {
  const today = startOfDay(new Date());
  if (range.days && range.days <= 30) {
    return Array.from({ length: range.days }, (_, i) => {
      const from = addDays(today, -(range.days - 1 - i));
      return { from, to: addDays(from, 1), label: String(from.getDate()), title: localDate(from) };
    });
  }
  if (range.days) {
    const weeks = Math.ceil(range.days / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const from = addDays(today, -(range.days - 1) + i * 7);
      const to = addDays(from, 7);
      return { from, to, label: `${from.getDate()}/${from.getMonth() + 1}`, title: `Week of ${localDate(from)}` };
    });
  }
  // All time: calendar months from the first booking (at most 12, ending this month).
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  const first = firstDate ? new Date(firstDate.getFullYear(), firstDate.getMonth(), 1) : end;
  const months = Math.min(12, (end.getFullYear() - first.getFullYear()) * 12 + end.getMonth() - first.getMonth() + 1);
  return Array.from({ length: months }, (_, i) => {
    const from = new Date(end.getFullYear(), end.getMonth() - (months - 1 - i), 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    return { from, to, label: from.toLocaleDateString("en-IN", { month: "short" }), title: from.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
  });
}

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState("30");
  const [metric, setMetric] = useState("tickets"); // trend chart: "tickets" | "revenue"

  useEffect(() => {
    (async () => {
      try {
        const [events, bookings] = await Promise.all([listManagedEvents(user), listManagedBookings(user)]);
        const checks = await Promise.all(events.map((e) => listCheckIns(e.id)));
        setData({ events, bookings, checked: Object.fromEntries(events.map((e, i) => [e.id, checks[i].length])) });
      } catch (e) { setError(e.message); }
    })();
  }, [user]);

  const range = RANGES.find((x) => x.key === rangeKey);

  const r = useMemo(() => {
    if (!data) return null;
    const since = range.days ? addDays(startOfDay(new Date()), -(range.days - 1)) : null;
    const inRange = (iso) => !since || (iso && new Date(iso) >= since);

    // Money and bookings follow the selected range (by booking date). Seat counts and check-ins are lifetime figures.
    const confirmed = data.bookings.filter((b) => b.status === "CONFIRMED");
    const paid = confirmed.filter((b) => inRange(b.createdAt));
    const cancelled = data.bookings.filter((b) => b.status === "CANCELLED" && inRange(b.cancelledAt || b.createdAt));

    const per = data.events.map((e) => {
      const bs = paid.filter((b) => b.eventId === e.id);
      const tickets = bs.reduce((s, b) => s + b.quantity, 0);
      return {
        id: e.id, title: e.title, category: e.category, status: e.status, capacity: e.capacity, sold: e.booked,
        tickets, revenue: bs.reduce((s, b) => s + b.amount, 0), checked: data.checked[e.id] || 0,
        fill: e.capacity ? Math.round((e.booked / e.capacity) * 100) : 0,
        attendance: e.booked ? Math.round(((data.checked[e.id] || 0) / e.booked) * 100) : 0,
      };
    });

    const byCat = {};
    per.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + p.tickets; });

    const firstBooking = confirmed.length ? new Date(Math.min(...confirmed.map((b) => new Date(b.createdAt)))) : null;
    const trend = makeBuckets(range, firstBooking).map((bk) => {
      const inB = paid.filter((b) => { const t = new Date(b.createdAt); return t >= bk.from && t < bk.to; });
      return { ...bk, tickets: inB.reduce((s, b) => s + b.quantity, 0), revenue: inB.reduce((s, b) => s + b.amount, 0) };
    });

    const tickets = paid.reduce((s, b) => s + b.quantity, 0);
    const revenue = paid.reduce((s, b) => s + b.amount, 0);
    const lifetimeSold = per.reduce((s, p) => s + p.sold, 0);
    const cap = per.reduce((s, p) => s + p.capacity, 0);
    const checked = per.reduce((s, p) => s + p.checked, 0);
    return {
      per, byCat, trend, tickets, revenue,
      orders: paid.length,
      avgOrder: paid.length ? Math.round(revenue / paid.length) : 0,
      fill: cap ? Math.round((lifetimeSold / cap) * 100) : 0,
      attendance: lifetimeSold ? Math.round((checked / lifetimeSold) * 100) : 0,
      pending: data.bookings.filter((b) => b.status === "PENDING_PAYMENT").length,
      refunded: cancelled.reduce((s, b) => s + (b.refundAmount || 0), 0),
      cancelled: cancelled.length,
      checked,
    };
  }, [data, range]);

  if (error) return <PageLayout><p className="ev-error">{error}</p></PageLayout>;
  if (!r) return <PageLayout><Skeleton /></PageLayout>;

  const exportCsv = () => downloadCsv(`event-report-${rangeKey}.csv`, [
    ["Report range", range.label],
    [],
    ["Event", "Category", "Status", "Capacity", "Seats filled (all time)", "Fill %", `Tickets booked (${range.label})`, `Revenue INR (${range.label})`, "Checked in", "Attendance %"],
    ...r.per.map((p) => [p.title, p.category, p.status, p.capacity, p.sold, p.fill, p.tickets, p.revenue, p.checked, p.attendance]),
  ]);

  const value = (x) => (metric === "revenue" ? x.revenue : x.tickets);
  const tmax = Math.max(1, ...r.trend.map(value));
  const trendEmpty = r.trend.every((x) => value(x) === 0);
  const shortInr = (n) => (n >= 100000 ? `${+(n / 100000).toFixed(1)}L` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n));

  return (
    <PageLayout>
      <div className="ev-head">
        <div><h1>Reports and analytics</h1><p className="ws-sub" style={{ margin: 0 }}>{user.role === "Admin" ? "All events on the platform." : "Your events."}</p></div>
        <div className="ws-actions no-print">
          <button className="ev-btn ghost" type="button" onClick={() => window.print()} disabled={!r.per.length}>Print</button>
          <button className="ev-btn ghost" type="button" onClick={exportCsv} disabled={!r.per.length}>Export CSV</button>
        </div>
      </div>

      {r.per.length === 0 ? (
        <div className="ws-panel ws-empty" style={{ marginTop: 16 }}><h3>No data yet</h3><p>Reports appear once you have events and bookings.</p><Link className="ev-btn" to="/events/new">Create event</Link></div>
      ) : (
        <>
          <div className="rp-range no-print" role="group" aria-label="Report range">
            {RANGES.map((x) => (
              <button key={x.key} type="button" className={`rp-chip ${x.key === rangeKey ? "on" : ""}`} aria-pressed={x.key === rangeKey} onClick={() => setRangeKey(x.key)}>{x.label}</button>
            ))}
          </div>
          <p className="ev-muted" style={{ margin: "8px 0 0" }}>Revenue, tickets and refunds are for <strong>{range.label.toLowerCase()}</strong> (by booking date). Seats filled and check-ins are all-time.</p>

          <div className="ws-stats" style={{ marginTop: 14 }}>
            <div className="ws-stat"><p>Revenue</p><strong><CountUp>{inr(r.revenue)}</CountUp></strong><span>{r.orders} paid booking{r.orders === 1 ? "" : "s"}</span></div>
            <div className="ws-stat"><p>Tickets booked</p><strong><CountUp>{r.tickets}</CountUp></strong><span>{r.pending} awaiting payment (now)</span></div>
            <div className="ws-stat"><p>Average booking</p><strong><CountUp>{inr(r.avgOrder)}</CountUp></strong><span>Per paid booking</span></div>
            <div className="ws-stat"><p>Refunded</p><strong><CountUp>{inr(r.refunded)}</CountUp></strong><span>{r.cancelled} cancelled booking{r.cancelled === 1 ? "" : "s"}</span></div>
            <div className="ws-stat"><p>Seats filled</p><strong><CountUp>{r.fill}%</CountUp></strong><span>All events, all time</span></div>
            <div className="ws-stat"><p>Attendance</p><strong><CountUp>{r.attendance}%</CountUp></strong><span>{r.checked} checked in</span></div>
          </div>

          <div className="ws-grid2">
            <section className="ws-panel">
              <h2>Revenue by event</h2>
              {r.revenue === 0 ? <p className="ev-muted">No paid bookings in this range.</p> : <Bars rows={r.per.filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).map((p) => ({ label: p.title, value: p.revenue }))} format={inr} />}
            </section>
            <section className="ws-panel">
              <h2>Tickets by category</h2>
              {r.tickets === 0 ? <p className="ev-muted">No tickets booked in this range.</p> : <Bars rows={Object.entries(r.byCat).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value }))} format={(n) => n} />}
            </section>
          </div>

          <section className="ws-panel">
            <div className="ev-row">
              <h2>{metric === "revenue" ? "Revenue" : "Tickets booked"} over time</h2>
              <div className="rp-range no-print" role="group" aria-label="Trend metric">
                <button type="button" className={`rp-chip ${metric === "tickets" ? "on" : ""}`} aria-pressed={metric === "tickets"} onClick={() => setMetric("tickets")}>Tickets</button>
                <button type="button" className={`rp-chip ${metric === "revenue" ? "on" : ""}`} aria-pressed={metric === "revenue"} onClick={() => setMetric("revenue")}>Revenue</button>
              </div>
            </div>
            {trendEmpty ? <p className="ev-muted">No bookings in this range.</p> : (
              <div className="spark" role="img" aria-label={`${metric === "revenue" ? "Revenue" : "Tickets booked"} over time`}>
                {r.trend.map((x) => (
                  <div key={x.title} title={`${x.title}: ${metric === "revenue" ? inr(x.revenue) : x.tickets}`}>
                    <span>{value(x) ? (metric === "revenue" ? shortInr(x.revenue) : x.tickets) : ""}</span>
                    <i style={{ height: `${(value(x) / tmax) * 80}%` }} />
                    <span>{x.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ws-panel">
            <h2>Event performance</h2>
            <div className="ws-table-wrap"><table className="ws-table">
              <thead><tr>
                <th>Event</th><th className="num">Capacity</th><th className="num">Filled</th><th className="num">Fill</th>
                <th className="num">Booked in range</th><th className="num">Revenue in range</th><th className="num">Checked in</th><th className="num">Attendance</th>
              </tr></thead>
              <tbody>{r.per.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/events/${p.id}/manage`}>{p.title}</Link></td>
                  <td className="num">{p.capacity}</td><td className="num">{p.sold}</td><td className="num">{p.fill}%</td>
                  <td className="num">{p.tickets}</td><td className="num">{inr(p.revenue)}</td><td className="num">{p.checked}</td><td className="num">{p.attendance}%</td>
                </tr>
              ))}</tbody>
            </table></div>
            <p className="ev-muted" style={{ marginTop: 10 }}>Sample events start with seats pre-filled, so their range revenue shows ₹0 until real bookings are made.</p>
          </section>
        </>
      )}
    </PageLayout>
  );
}
