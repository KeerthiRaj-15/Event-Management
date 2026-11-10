import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { createBooking } from "../../api";
import { money } from "./helpers.js";

export default function BookBox({ event, left, ended }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (event.status === "Cancelled") return <p className="ev-muted">This event was cancelled.</p>;
  if (ended) return <p className="ev-muted">Booking is closed for this event.</p>;
  if (event.status !== "Published") return <p className="ev-muted">Publish this event to open booking.</p>;
  if (left < 1) return <button className="ev-btn" type="button" disabled>Sold out</button>;

  const book = async () => {
    setBusy(true);
    setError("");
    try {
      const b = await createBooking(event.id, qty, user);
      if (b.status === "CONFIRMED") navigate("/tickets", { state: { message: "Booking confirmed. Your tickets are ready." } });
      else navigate(`/checkout/${b.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="ev-book">
      <label>Tickets
        <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
          {Array.from({ length: Math.min(5, left) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <p className="ev-muted">Total: <strong>{money(event.price * qty)}</strong></p>
      {error && <p className="ev-error">{error}</p>}
      <button className="ev-btn" type="button" onClick={book} disabled={busy}>
        {event.price === 0 ? "Get free ticket" : "Continue to payment"}
      </button>
    </div>
  );
}
