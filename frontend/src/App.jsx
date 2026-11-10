import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, Ticket, Users, Settings, Search, Plus,
  Bell, ChevronDown, MapPin, Clock3, ArrowUpRight, MoreHorizontal,
  CalendarPlus, QrCode, Menu, X, CheckCircle2, Sparkles, LogOut
} from 'lucide-react';
import { useAuth } from './auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const initialEvents = [
  {
    id: 1,
    title: 'Design Futures Summit',
    category: 'Conference',
    date: '2026-11-18',
    time: '09:30 AM',
    location: 'Bengaluru International Centre',
    attendees: 248,
    capacity: 300,
    status: 'Published',
    color: 'purple'
  },
  {
    id: 2,
    title: 'Build with AI Workshop',
    category: 'Workshop',
    date: '2026-11-21',
    time: '10:00 AM',
    location: 'WeWork Galaxy, Bengaluru',
    attendees: 86,
    capacity: 100,
    status: 'Published',
    color: 'blue'
  },
  {
    id: 3,
    title: 'Indie Music Evening',
    category: 'Entertainment',
    date: '2026-11-25',
    time: '06:30 PM',
    location: 'The Courtyard, Bengaluru',
    attendees: 172,
    capacity: 250,
    status: 'Published',
    color: 'orange'
  },
  {
    id: 4,
    title: 'Startup Connect 2026',
    category: 'Networking',
    date: '2026-12-02',
    time: '02:00 PM',
    location: 'The Lalit Ashok, Bengaluru',
    attendees: 0,
    capacity: 180,
    status: 'Draft',
    color: 'green'
  }
];

const money = n =>
  new Intl.NumberFormat('en-IN').format(n);

const dateLabel = value =>
  new Date(value + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const [events, setEvents] = useState(() => { try { return JSON.parse(localStorage.getItem('gather.events')) || initialEvents; } catch { return initialEvents; } });
  const [registrations, setRegistrations] = useState(() => { try { return JSON.parse(localStorage.getItem('gather.registrations')) || []; } catch { return []; } });
  const [active, setActive] = useState('Overview');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [registrationDone, setRegistrationDone] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  React.useEffect(() => { localStorage.setItem('gather.events', JSON.stringify(events)); }, [events]);
  React.useEffect(() => { localStorage.setItem('gather.registrations', JSON.stringify(registrations)); }, [registrations]);
  React.useEffect(() => {
    const sync = e => {
      if (e.key === 'gather.events' && e.newValue) setEvents(JSON.parse(e.newValue));
      if (e.key === 'gather.registrations' && e.newValue) setRegistrations(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const [registration, setRegistration] = useState({
    name: '',
    email: '',
    phone: '',
    eventId: String(initialEvents[0].id),
    notes: ''
  });

  const [form, setForm] = useState({
    title: '',
    category: 'Conference',
    date: '',
    time: '',
    location: '',
    capacity: '100'
  });

  const filtered = useMemo(
    () =>
      events.filter(e =>
        `${e.title} ${e.category} ${e.location}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [events, search]
  );

  const totalAttendees = events.reduce(
    (sum, e) => sum + e.attendees,
    0
  );

  const published = events.filter(
    e => e.status === 'Published'
  ).length;

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function createEvent(e) {
    e.preventDefault();

    const newEvent = {
      id: Date.now(),
      ...form,
      attendees: 0,
      capacity: Number(form.capacity),
      status: 'Draft',
      color: 'purple'
    };

    setEvents(prev => [newEvent, ...prev]);
    setShowCreate(false);

    setForm({
      title: '',
      category: 'Conference',
      date: '',
      time: '',
      location: '',
      capacity: '100'
    });

    notify('Event saved as a draft');
    setActive('My events');
  }

  function toggleEvent(event) {
    const next = event.status === 'Published' ? 'Draft' : 'Published';
    setEvents(prev => prev.map(item => item.id === event.id ? { ...item, status: next } : item));
    notify(`${event.title} moved to ${next.toLowerCase()}`);
  }

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'My events', icon: CalendarDays },
    { label: 'Registrations', icon: Users },
    { label: 'Register attendee', icon: CalendarPlus },
    { label: 'Tickets', icon: Ticket },
    { label: 'Browse events', icon: Search, to: '/events' },
    { label: 'My tickets', icon: QrCode, to: '/tickets' }
  ].filter(item => user.role !== 'Attendee' || ['Overview', 'Browse events', 'My tickets'].includes(item.label));

  return (
    <div className="app-shell">

      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>

        <div className="brand">
          <span className="brand-mark">
            <CalendarDays size={19} />
          </span>
          <span>
            gather<span className="brand-dot">.</span>
          </span>
        </div>

        <div className="workspace">
          <div className="workspace-avatar">E</div>
          <div>
            <strong>Event workspace</strong>
            <small>Personal account</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <p className="nav-caption">WORKSPACE</p>

        <nav>
          {navItems.map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              className={`nav-link ${active === label ? 'active' : ''}`}
              onClick={() => {
                if (to) return navigate(to);
                setActive(label);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Registrations' && <em>{registrations.length}</em>}
            </button>
          ))}
        </nav>

        <p className="nav-caption tools-caption">
          PREFERENCES
        </p>

        <button
          className="nav-link"
          onClick={() =>
            notify('Settings will be connected in a later phase')
          }
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <div className="sidebar-bottom">

          <div className="help-card">
            <div className="help-icon">
              <Sparkles size={17} />
            </div>

            <strong>Make your next event a hit</strong>

            <p>
              Keep your event details and attendees organized
              in one place.
            </p>

            <button onClick={() => setShowCreate(true)}>
              Create an event <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="profile">
            <div className="profile-avatar">{initials}</div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button className="logout-btn" onClick={logout} title="Log out" aria-label="Log out">
              <LogOut size={18} />
            </button>
          </div>

        </div>
      </aside>

      {mobileNav && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}

      <main className="main-area">

        <header className="topbar">

          <button
            className="mobile-menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{active}</strong>
          </div>

          <div className="top-actions">

            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events..."
              />
            </label>

            <button
              className="icon-button notification"
              onClick={() => notify('You are all caught up')}
            >
              <Bell size={18} />
              <i />
            </button>

            <div className="top-avatar">{initials}</div>

          </div>
        </header>

        <div className="content">

          <section className="welcome-row">

            <div>
              <p className="eyebrow">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </p>

              <h1>
                {active === 'Overview'
                  ? 'Good morning, Keerthi'
                  : active}
                <span className="wave">✦</span>
              </h1>

              <p className="subheading">
                {active === 'Overview'
                  ? 'Here’s what’s happening with your events today.'
                  : 'Manage and keep track of everything in your event workspace.'}
              </p>
            </div>

            <button
              className="primary-btn"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={18} /> Create event
            </button>

          </section>

          {active === 'Overview' && (
            <>
              <section className="stats-grid">

                <StatCard
                  label="Total events"
                  value={events.length.toString().padStart(2, '0')}
                  note="+2 this month"
                  icon={<CalendarDays size={19} />}
                  tone="lavender"
                />

                <StatCard
                  label="Total attendees"
                  value={money(totalAttendees)}
                  note="Across all events"
                  icon={<Users size={19} />}
                  tone="mint"
                />

                <StatCard
                  label="Tickets registered"
                  value={money(registrations.length)}
                  note="Confirmed registrations"
                  icon={<Ticket size={19} />}
                  tone="peach"
                />

                <StatCard
                  label="Published events"
                  value={published.toString().padStart(2, '0')}
                  note="Visible to attendees"
                  icon={<CheckCircle2 size={19} />}
                  tone="sky"
                />

              </section>

              <section className="dashboard-grid">

                <div className="panel upcoming-panel">

                  <div className="panel-heading">
                    <div>
                      <h2>Upcoming events</h2>
                      <p>Your next events at a glance</p>
                    </div>

                    <button
                      className="text-btn"
                      onClick={() => setActive('My events')}
                    >
                      View all <ArrowUpRight size={15} />
                    </button>
                  </div>

                  <EventList events={filtered.slice(0, 3)} onAction={event => toggleEvent(event)} />

                </div>

                <div className="panel activity-panel">

                  <div className="panel-heading">
                    <div>
                      <h2>Quick overview</h2>
                      <p>Your event performance</p>
                    </div>

                    <span className="period-pill">
                      This month <ChevronDown size={13} />
                    </span>
                  </div>

                  <div className="overview-number">
                    <strong>{money(totalAttendees)}</strong>
                    <span>total registrations</span>
                  </div>

                  <div className="mini-chart">
                    <div className="chart-bars">
                      {[35, 53, 43, 72, 58, 88, 67, 95, 74, 83, 62, 100].map(
                        (h, i) => (
                          <span
                            key={i}
                            style={{ height: `${h}%` }}
                            className={i === 11 ? 'bar-highlight' : ''}
                          />
                        )
                      )}
                    </div>

                    <div className="chart-labels">
                      <span>Week 1</span>
                      <span>Week 2</span>
                      <span>Week 3</span>
                      <span>Week 4</span>
                    </div>
                  </div>

                  <div className="activity-foot">
                    <span>
                      <i className="legend-dot purple-dot" />
                      Registrations
                    </span>
                    <strong>Live summary</strong>
                  </div>

                </div>
              </section>

              <section className="panel bottom-panel">

                <div className="panel-heading">
                  <div>
                    <h2>Get started</h2>
                    <p>Three simple steps to run a successful event</p>
                  </div>
                </div>

                <div className="steps">

                  <div className="step">
                    <span>01</span>
                    <div>
                      <strong>Create your event</strong>
                      <p>Add a title, date, venue and capacity.</p>
                    </div>
                    <CheckCircle2 size={18} />
                  </div>

                  <div className="step">
                    <span>02</span>
                    <div>
                      <strong>Open registrations</strong>
                      <p>Let attendees reserve their spot.</p>
                    </div>
                    <Clock3 size={18} />
                  </div>

                  <div className="step">
                    <span>03</span>
                    <div>
                      <strong>Issue QR tickets</strong>
                      <p>Make check-in quick and simple.</p>
                    </div>
                    <QrCode size={18} />
                  </div>

                </div>
              </section>
            </>
          )}

          {active === 'My events' && (
            <section className="panel events-page">

              <div className="panel-heading">
                <div>
                  <h2>All events</h2>
                  <p>{filtered.length} events in your workspace</p>
                </div>

                <button
                  className="primary-btn small"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus size={16} /> New event
                </button>
              </div>

              <EventList events={filtered} onAction={event => toggleEvent(event)} />

            </section>
          )}

          {active === 'Registrations' && (
            <section className="panel events-page">
              <div className="panel-heading"><div><h2>Attendee registrations</h2><p>{registrations.length} confirmed registrations · live across tabs</p></div><button className="primary-btn small" onClick={() => setActive('Register attendee')}><Plus size={16}/> Add attendee</button></div>
              {registrations.length ? <div className="event-list">{registrations.map(r => <div className="event-row" key={r.id}><div className="event-art purple"><Ticket size={22}/><span>TICKET</span></div><div className="event-info"><strong>{r.name}</strong><div className="event-meta"><span>{r.email}</span><span>{r.phone}</span><span>{r.eventTitle}</span></div></div><div className="attendee-count"><strong>{r.id}</strong><span>Ticket ID</span></div></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Users size={27}/></div><h2>No registrations yet</h2><p>Register your first attendee to see them listed here.</p><button className="secondary-btn" onClick={() => setActive('Register attendee')}>Open registration form</button></div>}
            </section>
          )}

          {active === 'Register attendee' && (
            <section className="registration-layout">

              <div className="registration-intro">

                <span className="form-kicker">
                  ATTENDEE REGISTRATION
                </span>

                <h2>
                  Save your spot.
                  <br />
                  <span>Be part of it.</span>
                </h2>

                <p>
                  Complete the form to register for an upcoming
                  event. Your details will be used only for
                  event communication.
                </p>

                <div className="registration-perk">
                  <CheckCircle2 size={17} />
                  <span>Quick and easy registration</span>
                </div>

                <div className="registration-perk">
                  <Ticket size={17} />
                  <span>Ticket details after confirmation</span>
                </div>

                <div className="registration-decoration">
                  <CalendarDays size={90} />
                </div>

              </div>

              <div className="registration-form-card">

                {registrationDone ? (
                  <div className="registration-success">

                    <div className="success-icon">
                      <CheckCircle2 size={34} />
                    </div>

                    <h2>You’re on the list!</h2>

                    <p>
                      Your registration is confirmed. Your ticket ID is {lastTicket?.id}. Keep this ID for event check-in.
                    </p>

                    <button
                      className="primary-btn"
                      onClick={() => {
                        setRegistrationDone(false);
                        setRegistration({
                          name: '',
                          email: '',
                          phone: '',
                          eventId: String(initialEvents[0].id),
                          notes: ''
                        });
                      }}
                    >
                      Register another attendee
                    </button>

                  </div>
                ) : (

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const selected = events.find(ev => String(ev.id) === registration.eventId);
                      if (!selected || selected.status !== 'Published') return notify('Choose a published event');
                      if (selected.attendees >= selected.capacity) return notify('Sorry, this event is full');
                      if (registrations.some(r => r.eventId === selected.id && r.email.toLowerCase() === registration.email.toLowerCase())) return notify('This email is already registered for this event');
                      const ticket = { id: `GTH-${Date.now().toString(36).toUpperCase()}`, ...registration, eventId: selected.id, eventTitle: selected.title, createdAt: new Date().toISOString() };
                      setRegistrations(prev => [ticket, ...prev]);
                      setEvents(prev => prev.map(ev => ev.id === selected.id ? { ...ev, attendees: ev.attendees + 1 } : ev));
                      setLastTicket(ticket);
                      setRegistrationDone(true);
                    }}
                  >

                    <div className="form-card-heading">
                      <h2>Registration details</h2>
                      <p>Fields marked with * are required.</p>
                    </div>

                    <label>
                      Full name *
                      <input
                        required
                        value={registration.name}
                        onChange={e =>
                          setRegistration({
                            ...registration,
                            name: e.target.value
                          })
                        }
                        placeholder="Enter your full name"
                      />
                    </label>

                    <label>
                      Email address *
                      <input
                        required
                        type="email"
                        value={registration.email}
                        onChange={e =>
                          setRegistration({
                            ...registration,
                            email: e.target.value
                          })
                        }
                        placeholder="you@example.com"
                      />
                    </label>

                    <label>
                      Phone number *
                      <input
                        required
                        type="tel"
                        pattern="[0-9+() -]{8,16}"
                        value={registration.phone}
                        onChange={e =>
                          setRegistration({
                            ...registration,
                            phone: e.target.value
                          })
                        }
                        placeholder="Enter your phone number"
                      />
                    </label>

                    <label>
                      Select event *
                      <select
                        required
                        value={registration.eventId}
                        onChange={e =>
                          setRegistration({
                            ...registration,
                            eventId: e.target.value
                          })
                        }
                      >
                        {events
                          .filter(ev => ev.status === 'Published')
                          .map(ev => (
                            <option
                              key={ev.id}
                              value={String(ev.id)}
                            >
                              {ev.title} — {dateLabel(ev.date)}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      Additional notes
                      <textarea
                        rows="3"
                        value={registration.notes}
                        onChange={e =>
                          setRegistration({
                            ...registration,
                            notes: e.target.value
                          })
                        }
                        placeholder="Any accessibility needs or questions? (optional)"
                      />
                    </label>

                    <button
                      className="primary-btn register-submit"
                      type="submit"
                    >
                      Complete registration
                      <ArrowUpRight size={16} />
                    </button>

                    <p className="privacy-note">
                      By registering, you agree to receive
                      updates about this event.
                    </p>

                  </form>
                )}

              </div>
            </section>
          )}

          {active === 'Tickets' && (
            <section className="panel events-page">
              <div className="panel-heading"><div><h2>Tickets</h2><p>Automatically issued after registration</p></div></div>
              {registrations.length ? registrations.map(r => <div className="ticket-card" key={r.id}><div><span className="form-kicker">GATHER · ADMISSION</span><h2>{r.eventTitle}</h2><p>{r.name} · {r.email}</p><strong>{r.id}</strong></div><QrCode size={48}/></div>) : <div className="empty-state"><div className="empty-icon"><QrCode size={27}/></div><h2>No tickets issued yet</h2><p>Confirmed registrations will generate ticket IDs here.</p><button className="secondary-btn" onClick={() => setActive('Register attendee')}>Register attendee</button></div>}
            </section>
          )}

        </div>

        <footer>
          © 2026 Gather.
          <span>Made for better events.</span>
        </footer>

      </main>

      {showCreate && (
        <div
          className="modal-backdrop"
          onMouseDown={e =>
            e.target === e.currentTarget && setShowCreate(false)
          }
        >

          <form className="modal" onSubmit={createEvent}>

            <div className="modal-heading">
              <div>
                <p className="eyebrow">EVENT DETAILS</p>
                <h2>Create an event</h2>
                <p>Start with the basics. You can edit details later.</p>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCreate(false)}
              >
                <X size={20} />
              </button>
            </div>

            <label>
              Event name
              <input
                required
                value={form.title}
                onChange={e =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="e.g. Product Design Meetup"
              />
            </label>

            <div className="form-row">

              <label>
                Category
                <select
                  value={form.category}
                  onChange={e =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option>Conference</option>
                  <option>Workshop</option>
                  <option>Networking</option>
                  <option>Entertainment</option>
                  <option>Webinar</option>
                </select>
              </label>

              <label>
                Capacity
                <input
                  required
                  min="1"
                  type="number"
                  value={form.capacity}
                  onChange={e =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                />
              </label>

            </div>

            <div className="form-row">

              <label>
                Date
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={e =>
                    setForm({ ...form, date: e.target.value })
                  }
                />
              </label>

              <label>
                Time
                <input
                  required
                  type="time"
                  value={form.time}
                  onChange={e =>
                    setForm({ ...form, time: e.target.value })
                  }
                />
              </label>

            </div>

            <label>
              Venue / meeting link
              <input
                required
                value={form.location}
                onChange={e =>
                  setForm({ ...form, location: e.target.value })
                }
                placeholder="Enter event location"
              />
            </label>

            <div className="modal-actions">

              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>

              <button type="submit" className="primary-btn">
                Save as draft <ArrowUpRight size={16} />
              </button>

            </div>

          </form>
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <p>{label}</p>
      <div className="stat-value">{value}</div>
      <span>{note}</span>
    </div>
  );
}

function EventList({ events, onAction }) {
  if (!events.length) {
    return (
      <div className="no-results">
        No events found. Try another search or create a new event.
      </div>
    );
  }

  return (
    <div className="event-list">
      {events.map(event => (
        <div className="event-row" key={event.id}>

          <div className={`event-art ${event.color}`}>
            <CalendarDays size={23} />
            <span>{event.category}</span>
          </div>

          <div className="event-info">
            <strong>{event.title}</strong>

            <div className="event-meta">
              <span>
                <CalendarDays size={13} />
                {dateLabel(event.date)}
              </span>

              <span>
                <Clock3 size={13} />
                {event.time || 'Time not set'}
              </span>

              <span>
                <MapPin size={13} />
                {event.location}
              </span>
            </div>
          </div>

          <div className="attendee-count">
            <strong>{event.attendees}</strong>
            <span>/ {event.capacity} seats</span>
          </div>

          <span className={`status ${event.status.toLowerCase()}`}>
            {event.status}
          </span>

          <button
            className="more-btn"
            onClick={() => onAction(event)}
            aria-label="Toggle event publishing status"
            title={event.status === 'Published' ? 'Unpublish event' : 'Publish event'}
          >
            <MoreHorizontal size={19} />
          </button>

        </div>
      ))}
    </div>
  );
}

export default App;