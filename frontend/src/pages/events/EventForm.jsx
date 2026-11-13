import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getEvent, saveEvent, describeEvent } from "../../api";
import { CATEGORIES, canManage } from "./helpers.js";
import { validateEvent, todayLocal, maxEventDate, MAX_PRICE, MAX_CAPACITY } from "../../validation.js";

const blank = { title: "", category: CATEGORIES[0], date: "", time: "10:00", location: "", description: "", price: "0", capacity: "100", status: "Draft" };

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [original, setOriginal] = useState(null);
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");

  useEffect(() => {
    if (!editing) return;
    getEvent(id)
      .then((e) => { setOriginal(e); setForm({ ...e, price: String(e.price), capacity: String(e.capacity) }); setLoaded(true); })
      .catch((e) => setError(e.message));
  }, [id, editing]);

  const errors = useMemo(() => validateEvent(form, original), [form, original]);
  const show = (f) => (submitted || touched[f]) && errors[f];

  const set = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const blur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));
  const field = (name) => ({ name, value: form[name], onChange: set, onBlur: blur, "aria-invalid": Boolean(show(name)) });
  const Err = ({ name }) => (show(name) ? <small className="err" role="alert">{errors[name]}</small> : null);

  // "Write with AI": needs the basics first. The result goes into the box for the organizer to edit; nothing is saved automatically.
  const writeWithAi = async () => {
    setAiNote("");
    if (form.title.trim().length < 3 || !form.location.trim()) {
      setTouched((t) => ({ ...t, title: true, location: true }));
      return setAiNote("Fill in the event name and venue first, then try again.");
    }
    setAiBusy(true);
    try {
      const r = await describeEvent({ title: form.title.trim(), category: form.category, date: form.date, time: form.time, location: form.location.trim() });
      setForm((p) => ({ ...p, description: r.text.slice(0, 500) }));
      setAiNote(r.ai ? "Written by AI. Please read it and fix anything that is wrong before saving." : "Quick draft added (AI is not available right now). Please edit it.");
    } catch (err) {
      setAiNote(err.message || "Could not write a description. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (Object.keys(errors).length) return setError("Please fix the highlighted fields.");
    setSaving(true);
    try {
      const saved = await saveEvent({ ...form }, user);
      navigate(`/events/${saved.id}/manage`, { state: { message: editing ? "Changes saved." : "Event created." } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (editing && error && !loaded) return <PageLayout><p className="ev-error">{error}</p><Link to="/my-events">Back to my events</Link></PageLayout>;
  if (editing && loaded && !canManage(user, form))
    return <PageLayout><p className="ev-error">You can only edit your own events.</p><Link to="/events">Back to events</Link></PageLayout>;

  if (editing && loaded && form.status === "Cancelled")
    return <PageLayout><p className="ev-error">This event was cancelled and can no longer be edited.</p><Link to={`/events/${id}/manage`}>Back to event workspace</Link></PageLayout>;

  const hasBookings = editing && original?.booked > 0;
  const priceChanged = hasBookings && Number(form.price) !== original.price;

  return (
    <PageLayout>
      <h1>{editing ? "Edit event" : "Create event"}</h1>
      <p className="ws-sub">{editing ? "Update the details. Attendees see changes straight away." : "Fill in the details. Save as Draft to keep it hidden until you are ready."}</p>
      {error && <p className="ev-error" role="alert">{error}</p>}
      {loaded && (
        <form className="ev-form" onSubmit={submit} noValidate>
          <label>Event name
            <input {...field("title")} maxLength={80} required />
            <Err name="title" />
          </label>
          <label>Category
            <select {...field("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <div className="ev-two">
            <label>Date
              <input type="date" {...field("date")} min={original && original.date < todayLocal() ? undefined : todayLocal()} max={maxEventDate()} required />
              <Err name="date" />
            </label>
            <label>Start time
              <input type="time" {...field("time")} required />
              <Err name="time" />
            </label>
          </div>
          <label>Venue
            <input {...field("location")} maxLength={100} required />
            <Err name="location" />
          </label>
          <label>Description
            <textarea {...field("description")} rows={4} maxLength={500} />
            <small className="hint">{form.description.length}/500</small>
          </label>
          <div className="ai-row">
            <button className="ws-btn" type="button" onClick={writeWithAi} disabled={aiBusy}>{aiBusy ? "Writing..." : "\u2728 Write with AI"}</button>
            {aiNote && <small className="hint" role="status">{aiNote}</small>}
          </div>
          <div className="ev-two">
            <label>Ticket price in rupees
              <input type="number" {...field("price")} min="0" max={MAX_PRICE} step="1" inputMode="numeric" required />
              {show("price") ? <Err name="price" /> : <small className="hint">Enter 0 for a free event.</small>}
            </label>
            <label>Capacity
              <input type="number" {...field("capacity")} min={hasBookings ? original.booked || 1 : 1} max={MAX_CAPACITY} step="1" inputMode="numeric" required />
              {show("capacity") ? <Err name="capacity" /> : <small className="hint">{hasBookings ? `${original.booked} seats already booked.` : "Total seats available."}</small>}
            </label>
          </div>
          {priceChanged && <p className="ev-warn">People who already booked keep the price they paid. The new price applies to new bookings only.</p>}
          <label>Status
            <select {...field("status")}><option>Draft</option><option>Published</option></select>
            <small className="hint">Only Published events can be booked by attendees.</small>
          </label>
          <div className="ev-manage">
            <button className="ev-btn" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create event"}</button>
            <Link className="ev-btn ghost" to={editing ? `/events/${id}/manage` : "/my-events"}>Cancel</Link>
          </div>
        </form>
      )}
    </PageLayout>
  );
}
