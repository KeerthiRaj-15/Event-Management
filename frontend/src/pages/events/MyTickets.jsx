import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import PageLayout from "../../components/PageLayout.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listBookings, cancelBooking } from "../../api";
import { cancelCheck, CANCEL_CUTOFF_HOURS } from "../../validation.js";
import { money, inr, fmtDate, fmtTime, bookingChip } from "./helpers.js";

export default function MyTickets() {
  const { user } = useAuth();
  const { state } = useLocation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState(state?.message || "");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => listBookings(user).then(setItems).catch((e) => setError(e.message)), [user]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (b) => {
    const paid = b.status === "CONFIRMED";
    const msg = paid
      ? `Cancel ${b.quantity} ticket(s) for "${b.eventTitle}"? ${inr(b.amount)} will be refunded and the tickets stop working.`
      : `Cancel this unpaid booking for "${b.eventTitle}"?`;
    if (!window.confirm(msg)) return;
    setBusy(b.id); setError(""); setNote("");
    try {
      const done = await cancelBooking(b.id, user);
      setNote(done.refundAmount > 0 ? `Booking cancelled. ${inr(done.refundAmount)} refunded (ref ${done.refundId}).` : "Booking cancelled.");
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(""); }
  };

  return (
    <PageLayout>
      <div className="ev-head">
        <div><h1>My tickets</h1><p className="ws-sub" style={{ margin: 0 }}>Free cancellation up to {CANCEL_CUTOFF_HOURS} hours before the event. Paid tickets are refunded in full.</p></div>
        <button className="ev-btn ghost no-print" type="button" onClick={() => window.print()}>Print tickets</button>
      </div>
      {note && <p className="ev-ok" role="status">{note}</p>}
      {error && <p className="ev-error" role="alert">{error}</p>}
      {!items && !error && <Skeleton />}
      {items && items.length === 0 && <p className="ev-muted">No bookings yet. <Link to="/events">Browse events</Link></p>}

      {items && items.map((b) => {
        const [cls, label] = bookingChip(b.status);
        const chk = cancelCheck(b);
        const used = new Set(b.usedTickets || []);
        return (
          <section className={`ev-booking ${b.status === "CANCELLED" ? "ev-ended" : ""}`} key={b.id}>
            <div className="ev-row">
              <h3>{b.eventTitle}</h3>
              <span className={`chip ${cls}`}>{label}</span>
            </div>
            <p className="ev-muted">{fmtDate(b.eventDate)} at {fmtTime(b.eventTime)}, {b.location}</p>
            <p className="ev-muted">{b.quantity} ticket(s), {money(b.amount)}{b.paymentId ? `, payment ${b.paymentId}` : ""}</p>

            {b.status === "CONFIRMED" && (
              <div className="ev-tickets">
                {b.tickets.map((code) => (
                  <div className="ev-ticket" key={code}>
                    <QRCodeSVG value={code} size={110} />
                    <strong>{code}</strong>
                    {used.has(code) ? <span className="chip mute">Used at gate</span> : <span className="ev-muted">Show this at the gate</span>}
                  </div>
                ))}
              </div>
            )}

            {b.status === "CANCELLED" && (
              <p className="ev-muted">
                Cancelled on {fmtDate(b.cancelledAt.slice(0, 10))}{b.cancelReason ? ` (${b.cancelReason})` : ""}.{" "}
                {b.refundAmount > 0 ? `Refunded ${inr(b.refundAmount)}, ref ${b.refundId}.` : "No payment was taken."}
              </p>
            )}

            {b.status !== "CANCELLED" && (
              <div className="ws-actions no-print" style={{ marginTop: 12 }}>
                {b.status === "PENDING_PAYMENT" && <Link className="ev-btn" to={`/checkout/${b.id}`}>Complete payment</Link>}
                <button className="ws-btn danger" type="button" disabled={!chk.ok || busy === b.id} onClick={() => cancel(b)}>
                  {busy === b.id ? "Cancelling..." : b.status === "CONFIRMED" ? "Cancel and refund" : "Cancel booking"}
                </button>
                {!chk.ok && <span className="ev-muted" style={{ alignSelf: "center" }}>{chk.reason}</span>}
              </div>
            )}
          </section>
        );
      })}
    </PageLayout>
  );
}
