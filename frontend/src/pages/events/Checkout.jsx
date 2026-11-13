import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import Skeleton from "../../components/Skeleton.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getBooking, startPayment, completePayment } from "../../api";
import { money, fmtDate, fmtTime } from "./helpers.js";

// Razorpay's checkout script is loaded only when someone actually pays.
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const SIMULATOR = import.meta.env.VITE_USE_MOCK !== "false"; // browser-only demo mode keeps the test buttons

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

  const done = () => navigate("/tickets", { replace: true, state: { message: "Payment successful. Your tickets are ready." } });

  const pay = async (outcome) => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await startPayment(bookingId);
      if (s.checkout) return openRazorpay(s.checkout); // real Razorpay Checkout (test or live keys)
      await completePayment(bookingId, outcome, user); // mock mode
      done();
    } catch (e) {
      setMsg({ type: e.code === "CANCELLED" ? "warn" : "error", text: e.message });
      setBusy(false);
    }
  };

  const openRazorpay = async (c) => {
    if (!(await loadRazorpay())) throw new Error("Could not load Razorpay. Check your internet connection and try again.");
    const rz = new window.Razorpay({
      key: c.keyId,
      order_id: c.orderId,
      amount: c.amount,
      currency: c.currency,
      name: "Gather",
      description: `${booking.quantity} ticket(s) - ${booking.eventTitle}`,
      prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      theme: { color: "#16133a" },
      // Payment succeeded in the popup: the server verifies it before issuing tickets.
      handler: async (r) => {
        try {
          await completePayment(bookingId, "success", user, { razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
          done();
        } catch (e) {
          setMsg({ type: "error", text: e.message });
          setBusy(false);
        }
      },
      modal: { ondismiss: () => { setMsg({ type: "warn", text: "Payment window closed. No money was taken." }); setBusy(false); } },
    });
    rz.on("payment.failed", (r) => { setMsg({ type: "error", text: r.error?.description || "Payment failed. Please try again." }); setBusy(false); });
    rz.open();
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
          <h3>Pay securely</h3>
          <p className="ev-muted">{SIMULATOR ? "Demo checkout. No real payment is made." : "UPI, cards and net banking, powered by Razorpay."}</p>
          {msg && <p className={msg.type === "warn" ? "ev-warn" : "ev-error"}>{msg.text}</p>}
          <button className="ev-btn" type="button" disabled={busy} onClick={() => pay("success")}>{SIMULATOR ? "Approve payment" : `Pay ${money(booking.amount)}`}</button>
          {SIMULATOR && <button className="ev-btn ghost" type="button" disabled={busy} onClick={() => pay("cancel")}>Cancel payment</button>}
          {SIMULATOR && <button className="ev-btn danger" type="button" disabled={busy} onClick={() => pay("fail")}>Simulate declined payment</button>}
        </section>
      </div>
    </PageLayout>
  );
}
