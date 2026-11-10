import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getEvent, deleteEvent } from "../../api";
import BookBox from "./BookBox.jsx";
import { isPast } from "../../validation.js";
import { money, fmtDate, fmtTime, canManage, seatsLeft } from "./helpers.js";

export default function EventDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getEvent(id).then(setEvent).catch((e) => setError(e.message));
  }, [id]);

  const remove = async () => {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    try {
      await deleteEvent(id, user);
      navigate("/events", { replace: true });
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <PageLayout><p className="ev-error">{error}</p><Link to="/events">Back to events</Link></PageLayout>;
  if (!event) return <PageLayout><p className="ev-muted">Loading...</p></PageLayout>;
  if (user.role === "Attendee" && event.status === "Draft")
    return <PageLayout><p className="ev-muted">This event is not available.</p><Link to="/events">Back to events</Link></PageLayout>;

  const left = seatsLeft(event);
  const ended = isPast(event);
  const manage = canManage(user, event);

  return (
    <PageLayout>
      <Link to="/events" className="ev-back">Back to events</Link>
      <div className="ev-detail">
        <div>
          <span className="ev-tag">{event.category}</span>{event.status === "Cancelled" ? <span className="chip bad" style={{ marginLeft: 8 }}>Cancelled</span> : ended && <span className="chip mute" style={{ marginLeft: 8 }}>Ended</span>}
          <h1>{event.title}</h1>
          {event.status === "Cancelled" && <p className="ev-error">This event was cancelled{event.cancelReason ? `: ${event.cancelReason}` : "."} Anyone who booked has been refunded.</p>}
          <p className="ev-lead">{event.description}</p>
          <dl className="ev-facts">
            <dt>Date</dt><dd>{fmtDate(event.date)}</dd>
            <dt>Time</dt><dd>{fmtTime(event.time)}</dd>
            <dt>Venue</dt><dd>{event.location}</dd>
            <dt>Seats</dt><dd>{event.booked} booked of {event.capacity}</dd>
          </dl>
        </div>
        <aside className="ev-side">
          <p className="ev-price">{money(event.price)}</p>
          <p className="ev-muted">{ended ? "This event has ended" : left > 0 ? `${left} seats left` : "Sold out"}</p>
          <BookBox event={event} left={left} ended={ended} />
          {manage && (
            <div className="ev-manage">
              <Link className="ev-btn" to={`/events/${event.id}/manage`}>Event workspace</Link>
              {event.status !== "Cancelled" && <Link className="ev-btn ghost" to={`/events/${event.id}/edit`}>Edit event</Link>}
              <button className="ev-btn danger" type="button" onClick={remove}>Delete</button>
            </div>
          )}
        </aside>
      </div>
    </PageLayout>
  );
}
