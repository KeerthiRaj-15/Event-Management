import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getBooking, startPayment, completePayment } from "../../api";
import { money, fmtDate, fmtTime } from "./helpers.js";

export default function Checkout() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getBooking(bookingId, user)
      .then((b) => (b.status !== "PENDING_PAYMENT" ? navigate("/tickets", { replace: true }) : setBooking(b)))
      .catch((e) => setMsg({ type: "error", text: e.message }));
  }, [bookingId, user, navigate]);

  const pay = async (outcome) => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await startPayment(bookingId);
      if (s.approvalUrl) return window.location.assign(s.approvalUrl); // real PayPal Sandbox page
      await completePayment(bookingId, outcome, user);
      navigate("/tickets", { replace: true, state: { message: "Payment successful. Your tickets are ready." } });
    } catch (e) {
      setMsg({ type: e.code === "CANCELLED" ? "warn" : "error", text: e.message });
      setBusy(false);
    }
  };

  if (!booking) return <PageLayout>{msg ? <p className="ev-error">{msg.text}</p> : <Skeleton />}<Link to="/events">Back to events</Link></PageLayout>;

  return (
    <PageLayout>
      <h1>Checkout</h1>
      <div className="ev-detail">
        <section className="ev-side">
          <h3>{booking.eventTitle}</h3>
          <p className="ev-muted">{fmtDate(booking.eventDate)} at {fmtTime(booking.eventTime)}</p>
          <p className="ev-muted">{booking.location}</p>
          <p>{booking.quantity} ticket(s)</p>
          <p className="ev-price">{money(booking.amount)}</p>
        </section>
        <section className="ev-side">
          <h3>Pay with PayPal</h3>
          <p className="ev-muted">Demo checkout. It stands in for the PayPal Sandbox page until the payment module is connected.</p>
          {msg && <p className={msg.type === "warn" ? "ev-warn" : "ev-error"}>{msg.text}</p>}
          <button className="ev-btn" type="button" disabled={busy} onClick={() => pay("success")}>Approve payment</button>
          <button className="ev-btn ghost" type="button" disabled={busy} onClick={() => pay("cancel")}>Cancel payment</button>
          <button className="ev-btn danger" type="button" disabled={busy} onClick={() => pay("fail")}>Simulate declined payment</button>
        </section>
      </div>
    </PageLayout>
  );
}
