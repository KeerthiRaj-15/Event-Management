import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, X, Send, Sparkles, LoaderCircle, CalendarDays, MapPin, Clock3, Ticket } from "lucide-react";
import { chatWithAssistant } from "../api.js";
import "./EventAssistant.css";

const starters = [
  "Show me upcoming events",
  "Find free events",
  "Find technology events in Bengaluru",
];

function displayDate(value) {
  if (!value) return "Date to be announced";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function EventCard({ event }) {
  const isGather = event.source === "Gather";
  const href = event.url || (isGather && event.id ? `/events/${event.id}` : null);
  return (
    <article className="gather-ai-event-card">
      {event.image && <img className="gather-ai-event-image" src={event.image} alt="" loading="lazy" />}
      <div className="gather-ai-event-content">
        <div className="gather-ai-event-topline">
          <span className="gather-ai-event-source">{event.source || "Event"}</span>
          {event.category && <span className="gather-ai-event-category">{event.category}</span>}
        </div>
        <strong className="gather-ai-event-title">{event.title}</strong>
        <div className="gather-ai-event-detail"><CalendarDays size={14} />{displayDate(event.date)}</div>
        {event.time && <div className="gather-ai-event-detail"><Clock3 size={14} />{event.time}</div>}
        {event.location && <div className="gather-ai-event-detail"><MapPin size={14} />{event.location}</div>}
        {event.description && <p className="gather-ai-event-description">{event.description}</p>}
        <div className="gather-ai-event-bottom">
          <span className="gather-ai-event-price"><Ticket size={14} />{event.price || "Price not listed"}</span>
          {Number.isFinite(event.availableSeats) && (
            <span className="gather-ai-event-seats">{event.availableSeats} seats left</span>
          )}
        </div>
        {href ? (
          <a className="gather-ai-event-link" href={href} target={isGather ? undefined : "_blank"}
            rel={isGather ? undefined : "noreferrer"}>
            {isGather ? "View event" : "View ticket page"} →
          </a>
        ) : (
          <span className="gather-ai-event-no-link">Event link unavailable</span>
        )}
      </div>
    </article>
  );
}

export default function EventAssistant() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I’m Gather AI. Ask me about events, bookings, tickets, payments, your account, or how to use Gather. I can also help you find events and send you to Browse events for the full details." },
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, open]);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      // Send the last few turns (without the welcome text) so follow-up questions work.
      const history = messages.slice(1).slice(-6).map((m) => ({ role: m.role, text: m.text }));
      const result = await chatWithAssistant(message, history);
      const eventIntent = /\b(events?|concerts?|workshops?|conferences?|meetups?)\b|\b(browse|find|discover|search|show)\b.*\b(events?|concerts?|workshops?|conferences?|meetups?)\b|\b(upcoming|free) events\b/i.test(message);
      const events = eventIntent ? (result.events || []) : [];
      setMessages((current) => [...current, {
        role: "assistant",
        text: result.reply || (events.length ? "I found matching events. Open Browse events to see the details." : "I’m here to help. Tell me a little more about what you need."),
        events,
        searchTerm: message,
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        text: error.message || "Sorry, the assistant is unavailable. Please try again.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gather-ai">
      {open && (
        <section className="gather-ai-panel" aria-label="Gather AI assistant">
          <header className="gather-ai-header">
            <div className="gather-ai-avatar"><Bot size={19} /></div>
            <div><strong>Gather AI</strong><small>Event discovery assistant</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={19} /></button>
          </header>
          <div className="gather-ai-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`gather-ai-message ${message.role} ${message.events?.length ? "has-events" : ""}`} key={index}>
                <div>{message.text}</div>
                {message.events?.length > 0 && (
                  <div className="gather-ai-event-list">
                    <p className="gather-ai-results-note">
                      I found {message.events.length} matching event{message.events.length === 1 ? "" : "s"}.
                      Their full details are available in Browse events.
                    </p>
                    <Link className="gather-ai-browse-link" to={`/events?search=${encodeURIComponent(message.searchTerm || "")}`}>
                      View events in Browse events →
                    </Link>
                  </div>
                )}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="gather-ai-starters">
                {starters.map((prompt) => (
                  <button type="button" key={prompt} onClick={() => send(prompt)}>{prompt}</button>
                ))}
              </div>
            )}
            {busy && <div className="gather-ai-message assistant typing"><LoaderCircle size={15} /> Searching events…</div>}
            <div ref={endRef} />
          </div>
          <form className="gather-ai-compose" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000}
              placeholder="Ask me anything about Gather…" aria-label="Message Gather AI" disabled={busy} />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message"><Send size={17} /></button>
          </form>
          <p className="gather-ai-footnote">Gather events open on this website. External listings open on their provider's site.</p>
        </section>
      )}
      <button type="button" className="gather-ai-launcher" onClick={() => setOpen((value) => !value)}
        aria-expanded={open} aria-label={open ? "Close Gather AI" : "Open Gather AI"}>
        {open ? <X size={21} /> : <><Sparkles size={18} /><span>Ask Gather AI</span></>}
      </button>
    </div>
  );
}
