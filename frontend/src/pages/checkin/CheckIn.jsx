import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { listManagedEvents, listManagedBookings, listCheckIns, checkIn } from "../../api";
import { isPast } from "../../validation.js";
import { fmtDate } from "../events/helpers.js";
import { localDate } from "../../validation.js";
import QrScanner, { scannerSupported } from "../../components/QrScanner.jsx";

// Gate screen: scan the ticket QR with the camera, or type/paste the code (a USB/Bluetooth scanner types it and presses Enter).
export default function CheckIn() {
  const { user } = useAuth();
  const { state } = useLocation();
  const [events, setEvents] = useState(null);
  const [eventId, setEventId] = useState(state?.eventId ? String(state.eventId) : "");
  const [sold, setSold] = useState(0);
  const [used, setUsed] = useState([]);
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    listManagedEvents(user).then((l) => {
      const list = l.filter((e) => e.status === "Published").sort((a, b) => a.date.localeCompare(b.date));
      setEvents(list);
      setEventId((cur) => cur || (list.find((e) => !isPast(e)) || list[0])?.id || "");
    }).catch((e) => setError(e.message));
  }, [user]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    const [u, b] = await Promise.all([listCheckIns(eventId), listManagedBookings(user)]);
    setUsed(u);
    setSold(b.filter((x) => x.eventId === String(eventId) && x.status === "CONFIRMED").reduce((s, x) => s + x.quantity, 0));
  }, [eventId, user]);
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, [refresh]);

  const event = (events || []).find((e) => e.id === String(eventId));

  // One path for typed and scanned codes.
  const admit = async (raw) => {
    const value = String(raw || "").trim();
    if (!value) return;
    setBusy(true); setResult(null);
    try {
      const r = await checkIn(eventId, value, user);
      setResult({ type: "ok", text: `Welcome, ${r.guest}. Ticket ${r.code} accepted.` });
      setCode("");
      navigator.vibrate?.(80);
      await refresh();
    } catch (err) {
      setResult({ type: err.code === "USED" ? "warn" : "bad", text: err.message });
      navigator.vibrate?.([60, 40, 60]);
    } finally {
      setBusy(false);
      if (!camera) input.current?.focus();
    }
  };

  const submit = (e) => { e.preventDefault(); admit(code); };

  const pct = sold ? Math.round((used.length / sold) * 100) : 0;
  const notToday = event && event.date !== localDate();

  return (
    <PageLayout>
      <h1>QR check-in</h1>
      <p className="ws-sub">Scan or type each guest's ticket code at the entrance. Each ticket works once.</p>
      {error && <p className="ev-error">{error}</p>}
      {events && events.length === 0 && <div className="ws-panel ws-empty"><h3>No published events</h3><p>Publish an event first. Check-in is only for published events.</p></div>}

      {events && events.length > 0 && (
        <div className="ws-grid2">
          <section className="ws-panel">
            <label style={{ display: "grid", gap: 4, fontWeight: 600, marginBottom: 14 }}>Event
              <select value={eventId} onChange={(e) => { setEventId(e.target.value); setResult(null); }}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title} — {fmtDate(e.date)}</option>)}
              </select>
            </label>
            {notToday && <p className="ev-warn">This event is on {fmtDate(event.date)}, not today. You can still check guests in.</p>}
            {camera ? (
              <QrScanner onDetect={admit} onClose={() => setCamera(false)} />
            ) : (
              scannerSupported()
                ? <button className="ev-btn" type="button" onClick={() => { setCamera(true); setResult(null); }}>Scan with camera</button>
                : <p className="ev-muted">Camera scanning needs Chrome or Edge on a secure (https) page. You can still type the code or use a USB scanner.</p>
            )}
            <form className="scan-box" onSubmit={submit} style={{ marginTop: 12 }}>
              <input ref={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="GTH-0001-ABC123" aria-label="Ticket code" autoFocus={!camera} autoComplete="off" />
              <button className="ev-btn" type="submit" disabled={busy || !code.trim()}>{busy ? "Checking..." : "Check in"}</button>
            </form>
            {result && <div className={`scan-result ${result.type}`} role="status">{result.type === "ok" ? "✓ " : result.type === "warn" ? "! " : "✕ "}{result.text}</div>}
          </section>

          <aside className="ws-panel">
            <h2>Entry progress</h2>
            <strong style={{ font: "800 28px Manrope,sans-serif" }}>{used.length}</strong> <span className="ev-muted">of {sold} tickets</span>
            <div className="progress"><i style={{ width: `${pct}%` }} /></div>
            <h2 style={{ marginTop: 16, fontSize: 15 }}>Recently checked in</h2>
            {used.length === 0 ? <p className="ev-muted">Nobody yet.</p> : (
              <ul className="ws-list">
                {used.slice(0, 8).map((u) => <li key={u.code}><span>{u.code}</span><span className="ev-muted">{new Date(u.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></li>)}
              </ul>
            )}
          </aside>
        </div>
      )}
    </PageLayout>
  );
}
