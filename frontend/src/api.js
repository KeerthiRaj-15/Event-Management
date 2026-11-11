// API layer for auth, events, bookings, payment, tickets, check-in, profile, admin and reports.
// MOCK mode (default) keeps users in localStorage so the UI works without a backend.
// When the Node/MongoDB backend is ready, set VITE_USE_MOCK=false in .env and the same
// functions call the REST endpoints listed in README.md ("Backend API contract").
import { validateEvent, validateProfile, validatePasswordChange, isPast, cancelCheck, RESET_OTP_MINUTES } from "./validation.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const newOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const fail = (message, code) => Object.assign(new Error(message), { code });

// Real-API helpers. Every request goes through `request` so network failures and expired sessions are handled in one place.
const SESSION_KEY = "gather.session";

async function request(method, path, body, withToken) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", ...(withToken ? { Authorization: `Bearer ${token()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw fail(`Cannot reach the server at ${API}. Make sure the backend is running (npm run dev in the backend folder) and try again.`, "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && withToken) {
    // Token expired or revoked: clear the session and send the user to log in again.
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    window.location.assign("/login");
    throw fail("Your session has expired. Please log in again.", "SESSION_EXPIRED");
  }
  // devOtp (development only) rides along on NOT_VERIFIED so the verify page can show the code.
  const apiError = (message, code) => Object.assign(fail(message, code), data.devOtp ? { devOtp: data.devOtp } : {});
  if (res.status === 403) throw apiError(data.message || "You do not have permission to do that.", data.code || "FORBIDDEN");
  if (!res.ok) throw apiError(data.message || "Request failed. Please try again.", data.code);
  return data;
}

const post = (path, body) => request("POST", path, body, false);

// Demo admin for testing role-based access (mock mode only). Admins are never self-registered.
function users() {
  const list = read("gather.users", null);
  if (list) return list;
  const seed = [{ name: "Admin", email: "admin@gather.com", phone: "", password: "Admin@123", role: "Admin", verified: true, active: true, createdAt: new Date().toISOString() }];
  write("gather.users", seed);
  return seed;
}

const publicUser = (u) => ({ name: u.name, email: u.email, phone: u.phone || "", role: u.role });

export async function register(form) {
  if (!MOCK) return post("/auth/register", form);
  const list = users();
  const email = form.email.trim().toLowerCase();
  if (list.some((u) => u.email === email)) throw fail("An account with this email already exists.");
  const role = form.role === "Organizer" ? "Organizer" : "Attendee";
  const otp = newOtp();
  write("gather.users", [...list, { ...form, email, role, verified: false, active: true, createdAt: new Date().toISOString(), otp }]);
  return { email, devOtp: otp }; // devOtp only exists in mock mode (no email is sent)
}

export async function verifyOtp(email, otp) {
  if (!MOCK) return post("/auth/verify-otp", { email, otp });
  const list = users();
  const user = list.find((u) => u.email === email);
  if (!user) throw fail("Account not found.");
  if (user.otp !== otp.trim()) throw fail("Incorrect code. Please try again.");
  write("gather.users", list.map((u) => (u.email === email ? { ...u, verified: true, otp: null } : u)));
  return { message: "Email verified." };
}

export async function resendOtp(email) {
  if (!MOCK) return post("/auth/resend-otp", { email });
  const list = users();
  const otp = newOtp();
  write("gather.users", list.map((u) => (u.email === email ? { ...u, otp } : u)));
  return { devOtp: otp };
}

// Forgot password. Real mode: POST /auth/forgot-password { email } then POST /auth/reset-password { email, otp, newPassword }.
// The reply is the same whether or not the email exists, so attackers cannot discover who has an account.
export async function forgotPassword(email) {
  if (!MOCK) return post("/auth/forgot-password", { email });
  const e = email.trim().toLowerCase();
  const list = users();
  const user = list.find((u) => u.email === e && u.verified);
  if (!user) return {};
  const otp = newOtp();
  write("gather.users", list.map((u) => (u.email === e ? { ...u, resetOtp: otp, resetExpires: Date.now() + RESET_OTP_MINUTES * 60000, resetTries: 0 } : u)));
  return { devOtp: otp }; // mock only: no email is sent
}

export async function resetPassword(email, otp, newPassword) {
  if (!MOCK) return post("/auth/reset-password", { email, otp, newPassword });
  const e = email.trim().toLowerCase();
  const list = users();
  const u = list.find((x) => x.email === e);
  const bad = () => fail("That code is incorrect or has expired. Request a new one.", "BAD_CODE");
  if (!u || !u.resetOtp) throw bad();
  if (Date.now() > u.resetExpires || u.resetTries >= 5) {
    write("gather.users", list.map((x) => (x.email === e ? { ...x, resetOtp: null } : x)));
    throw bad();
  }
  if (u.resetOtp !== String(otp).trim()) {
    write("gather.users", list.map((x) => (x.email === e ? { ...x, resetTries: (x.resetTries || 0) + 1 } : x)));
    throw bad();
  }
  const errs = validatePasswordChange({ current: "x", next: newPassword, confirm: newPassword });
  if (errs.next) throw fail(errs.next);
  write("gather.users", list.map((x) => (x.email === e ? { ...x, password: newPassword, resetOtp: null, resetTries: 0 } : x)));
  return { message: "Password reset." };
}

export async function login(email, password) {
  if (!MOCK) return post("/auth/login", { email, password });
  const user = users().find((u) => u.email === email.trim().toLowerCase());
  if (!user || user.password !== password) throw fail("Invalid email or password.");
  if (!user.verified) throw fail("Please verify your email first.", "NOT_VERIFIED");
  if (user.active === false) throw fail("This account has been deactivated. Contact an administrator.", "DEACTIVATED");
  return { token: "mock-" + user.email, user: publicUser(user) };
}

// ---------------- Profile (any logged-in user) ----------------
// Real mode: PUT /users/me  and  PUT /users/me/password
export async function updateProfile(email, { name, phone }) {
  if (!MOCK) return authed("PUT", "/users/me", { name, phone });
  const errs = validateProfile({ name, phone });
  if (Object.keys(errs).length) throw fail(Object.values(errs)[0]);
  const list = users();
  if (!list.some((u) => u.email === email)) throw fail("Account not found.");
  const next = list.map((u) => (u.email === email ? { ...u, name: name.trim(), phone: (phone || "").trim() } : u));
  write("gather.users", next);
  return publicUser(next.find((u) => u.email === email));
}

export async function changePassword(email, current, next) {
  if (!MOCK) return authed("PUT", "/users/me/password", { currentPassword: current, newPassword: next });
  const list = users();
  const me = list.find((u) => u.email === email);
  if (!me) throw fail("Account not found.");
  if (me.password !== current) throw fail("Current password is incorrect.", "BAD_PASSWORD");
  const errs = validatePasswordChange({ current, next, confirm: next });
  if (Object.keys(errs).length) throw fail(Object.values(errs)[0]);
  write("gather.users", list.map((u) => (u.email === email ? { ...u, password: next } : u)));
  return { message: "Password updated." };
}

// ---------------- Events ----------------
const EVENTS_KEY = "gather.events";
const token = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.token; } catch { return null; } };

const authed = (method, path, body) => request(method, path, body, true);

export async function chatWithAssistant(message) {
  if (MOCK) throw fail("The AI assistant needs the real backend. Set VITE_USE_MOCK=false in frontend/.env, then sign in using a backend account.", "MOCK_MODE");
  return authed("POST", "/ai/chat", { message });
}


const ymd = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function events() {
  const list = read(EVENTS_KEY, null);
  // Old builds stored a different shape (attendees, no price). Rebuild so nothing shows NaN.
  if (list && list.every((e) => typeof e.booked === "number" && typeof e.price === "number")) return list;
  const base = { organizerEmail: "admin@gather.com", status: "Published", booked: 0 };
  const seed = [
    { ...base, id: "1", title: "Design Futures Summit", category: "Conference", date: ymd(8), time: "09:30", location: "Bengaluru International Centre", description: "A one-day summit on product design, research and the future of interfaces.", price: 499, capacity: 300, booked: 248 },
    { ...base, id: "2", title: "Build with AI Workshop", category: "Workshop", date: ymd(11), time: "10:00", location: "WeWork Galaxy, Bengaluru", description: "Hands-on session building small apps with language model APIs.", price: 0, capacity: 100, booked: 86 },
    { ...base, id: "3", title: "Indie Music Evening", category: "Entertainment", date: ymd(15), time: "18:30", location: "The Courtyard, Bengaluru", description: "Live sets from five independent bands.", price: 250, capacity: 250, booked: 172 },
    { ...base, id: "4", title: "Startup Connect 2026", category: "Networking", date: ymd(22), time: "14:00", location: "The Lalit Ashok, Bengaluru", description: "Meet founders and investors. Draft until the venue is confirmed.", price: 150, capacity: 180, status: "Draft" },
  ];
  write(EVENTS_KEY, seed);
  return seed;
}

const isStaff = (u) => u && (u.role === "Admin" || u.role === "Organizer");
const owns = (u, ev) => u && (u.role === "Admin" || (u.role === "Organizer" && ev.organizerEmail === u.email));

export async function listEvents() {
  return MOCK ? events() : authed("GET", "/events");
}

// Events the user may manage (Admin: all, Organizer: own). Real mode: GET /events?mine=true
export async function listManagedEvents(user) {
  if (!MOCK) return authed("GET", "/events?mine=true");
  return events().filter((e) => owns(user, e));
}

export async function getEvent(id) {
  if (!MOCK) return authed("GET", `/events/${id}`);
  const found = events().find((e) => e.id === String(id));
  if (!found) throw fail("Event not found.");
  return found;
}

export async function saveEvent(ev, user) {
  if (!MOCK) return authed(ev.id ? "PUT" : "POST", ev.id ? `/events/${ev.id}` : "/events", ev);
  if (!isStaff(user)) throw fail("Only organizers and admins can manage events.");
  const list = events();
  const original = ev.id ? list.find((x) => x.id === ev.id) : null;
  if (ev.id && !original) throw fail("Event not found.");
  if (original && !owns(user, original)) throw fail("You can only edit your own events.");
  if (original?.status === "Cancelled") throw fail("A cancelled event cannot be edited.");
  const errs = validateEvent(ev, original);
  if (Object.keys(errs).length) throw fail(Object.values(errs)[0]);

  const clean = {
    title: ev.title.trim(), category: ev.category, date: ev.date, time: ev.time,
    location: ev.location.trim(), description: (ev.description || "").trim(),
    price: Number(ev.price), capacity: Number(ev.capacity), status: ev.status === "Published" ? "Published" : "Draft",
  };
  if (original) {
    const saved = { ...original, ...clean }; // booked / organizerEmail / id can never be overwritten by the form
    write(EVENTS_KEY, list.map((x) => (x.id === original.id ? saved : x)));
    return saved;
  }
  const created = { ...clean, id: String(Date.now()), booked: 0, organizerEmail: user.email };
  write(EVENTS_KEY, [...list, created]);
  return created;
}

// Quick publish/unpublish from lists. Real mode: PATCH /events/:id/status
export async function setEventStatus(id, status, user) {
  if (!MOCK) return authed("PATCH", `/events/${id}/status`, { status });
  const list = events();
  const ev = list.find((e) => e.id === String(id));
  if (!ev) throw fail("Event not found.");
  if (!owns(user, ev)) throw fail("You can only change your own events.");
  if (ev.status === "Cancelled") throw fail("A cancelled event cannot be changed.");
  if (status === "Published" && isPast(ev)) throw fail("This event has already started or ended. Edit its date before publishing.");
  const saved = { ...ev, status };
  write(EVENTS_KEY, list.map((e) => (e.id === ev.id ? saved : e)));
  return saved;
}

export async function deleteEvent(id, user) {
  if (!MOCK) return authed("DELETE", `/events/${id}`);
  const ev = events().find((e) => e.id === String(id));
  if (!ev) throw fail("Event not found.");
  if (user && !owns(user, ev)) throw fail("You can only delete your own events.");
  const hasBookings = ev.booked > 0 || bookings().some((b) => b.eventId === ev.id);
  if (hasBookings) throw fail("This event already has bookings, so it cannot be deleted. Cancel the event instead (everyone is refunded) or move it to Draft.", "HAS_BOOKINGS");
  write(EVENTS_KEY, events().filter((e) => e.id !== String(id)));
  return { message: "Deleted." };
}

// ---------------- Bookings, payment, tickets ----------------
const BOOK_KEY = "gather.bookings";
const bookings = () => read(BOOK_KEY, []);
const saveBookings = (l) => write(BOOK_KEY, l);
const ticketCode = (eventId) => `GTH-${String(eventId).slice(-4)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

// Takes the seats and issues one ticket code per seat (mock server logic).
function confirmBooking(b) {
  const list = events();
  const ev = list.find((e) => e.id === b.eventId);
  if (!ev || ev.capacity - ev.booked < b.quantity) throw fail("Not enough seats left.");
  write(EVENTS_KEY, list.map((e) => (e.id === ev.id ? { ...e, booked: e.booked + b.quantity } : e)));
  return { ...b, status: "CONFIRMED", tickets: Array.from({ length: b.quantity }, () => ticketCode(b.eventId)) };
}

export async function createBooking(eventId, quantity, user) {
  if (!MOCK) return authed("POST", "/bookings", { eventId, quantity });
  const ev = events().find((e) => e.id === String(eventId));
  if (!ev || ev.status !== "Published") throw fail("This event is not open for booking.");
  if (isPast(ev)) throw fail("This event has already started or ended. Booking is closed.");
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 5) throw fail("You can book 1 to 5 tickets at a time.");
  if (ev.capacity - ev.booked < qty) throw fail("Not enough seats left.");
  let b = {
    id: "B" + Date.now(), eventId: ev.id, eventTitle: ev.title, eventDate: ev.date, eventTime: ev.time,
    location: ev.location, userEmail: user.email, userName: user.name, quantity: qty, amount: ev.price * qty,
    status: "PENDING_PAYMENT", tickets: [], createdAt: new Date().toISOString(),
  };
  if (b.amount === 0) b = confirmBooking(b); // free events need no payment
  saveBookings([...bookings(), b]);
  return b;
}

export async function listBookings(user) {
  if (!MOCK) return authed("GET", "/bookings/mine");
  const used = checkins();
  return bookings().filter((b) => b.userEmail === user.email).map((b) => ({ ...b, usedTickets: b.tickets.filter((t) => used[t]) })).reverse();
}

// Admin: every booking. Organizer: bookings for their own events. Real mode: GET /bookings
export async function listManagedBookings(user) {
  if (!MOCK) return authed("GET", "/bookings");
  const mine = new Set(events().filter((e) => owns(user, e)).map((e) => e.id));
  return bookings().filter((b) => mine.has(b.eventId)).reverse();
}

export async function getBooking(id, user) {
  if (!MOCK) return authed("GET", `/bookings/${id}`);
  const b = bookings().find((x) => x.id === id && x.userEmail === user.email);
  if (!b) throw fail("Booking not found.");
  return b;
}

// Real mode: backend creates the PayPal order and returns approvalUrl (see the payment module).
export async function startPayment(id) {
  if (!MOCK) return authed("POST", "/payments/orders", { bookingId: id });
  return { mock: true };
}

// Mock sandbox result: "success" | "cancel" | "fail". Paying twice never charges twice.
export async function completePayment(id, outcome, user) {
  if (!MOCK) return authed("POST", "/payments/capture", { bookingId: id, outcome }); // outcome is only used by the backend's mock payment mode
  const list = bookings();
  const b = list.find((x) => x.id === id && x.userEmail === user.email);
  if (!b) throw fail("Booking not found.");
  if (b.status === "CONFIRMED") return b;
  if (outcome === "cancel") throw fail("Payment cancelled. No money was taken.", "CANCELLED");
  if (outcome === "fail") throw fail("Payment was declined. Please try again or use another method.", "DECLINED");
  const done = { ...confirmBooking(b), paymentId: "PAY-" + Math.random().toString(36).slice(2, 10).toUpperCase() };
  saveBookings(list.map((x) => (x.id === id ? done : x)));
  return done;
}

// ---------------- Cancellation and refunds ----------------
const refundId = () => "RF-" + Math.random().toString(36).slice(2, 10).toUpperCase();

// Cancels one booking in storage, frees the seats and refunds if it was paid. Mock server logic.
function applyCancel(b, reason, by) {
  const paid = b.status === "CONFIRMED";
  if (paid) {
    const list = events();
    write(EVENTS_KEY, list.map((e) => (e.id === b.eventId ? { ...e, booked: Math.max(0, e.booked - b.quantity) } : e)));
  }
  return {
    ...b, status: "CANCELLED", cancelledAt: new Date().toISOString(), cancelledBy: by, cancelReason: reason,
    refundAmount: paid ? b.amount : 0, refundId: paid && b.amount > 0 ? refundId() : null,
  };
}

// Attendee cancels their own booking. Real mode: POST /bookings/:id/cancel (server re-checks the cutoff and refunds via PayPal).
export async function cancelBooking(id, user) {
  if (!MOCK) return authed("POST", `/bookings/${id}/cancel`);
  const list = bookings();
  const b = list.find((x) => x.id === id && x.userEmail === user.email);
  if (!b) throw fail("Booking not found.");
  const used = checkins();
  const chk = cancelCheck({ ...b, usedTickets: b.tickets.filter((t) => used[t]) });
  if (!chk.ok) throw fail(chk.reason, "CANNOT_CANCEL");
  const done = applyCancel(b, "Cancelled by attendee", user.email);
  saveBookings(list.map((x) => (x.id === id ? done : x)));
  return done;
}

// Organizer/Admin cancels the whole event: every booking is cancelled and refunded. Real mode: POST /events/:id/cancel { reason }
export async function cancelEvent(id, reason, user) {
  if (!MOCK) return authed("POST", `/events/${id}/cancel`, { reason });
  const ev = events().find((e) => e.id === String(id));
  if (!ev) throw fail("Event not found.");
  if (!owns(user, ev)) throw fail("You can only cancel your own events.");
  if (ev.status === "Cancelled") throw fail("This event is already cancelled.");
  if (isPast(ev)) throw fail("This event has already started, so it cannot be cancelled.");
  const why = String(reason || "").trim();
  if (why.length < 5) throw fail("Give attendees a reason (at least 5 characters).");
  let refunded = 0, count = 0;
  const next = bookings().map((b) => {
    if (b.eventId !== ev.id || b.status === "CANCELLED") return b;
    const c = applyCancel(b, `Event cancelled: ${why}`, user.email);
    refunded += c.refundAmount; count += 1;
    return c;
  });
  saveBookings(next);
  write(EVENTS_KEY, events().map((e) => (e.id === ev.id ? { ...e, status: "Cancelled", booked: 0, cancelReason: why } : e)));
  return { bookings: count, refunded };
}

// ---------------- QR check-in (Organizer / Admin) ----------------
const CHECKIN_KEY = "gather.checkins"; // { [ticketCode]: { at, by, eventId } }
const checkins = () => read(CHECKIN_KEY, {});

// Used tickets for one event, newest first. Real mode: GET /events/:id/checkins
export async function listCheckIns(eventId) {
  if (!MOCK) return authed("GET", `/events/${eventId}/checkins`);
  return Object.entries(checkins())
    .filter(([, v]) => v.eventId === String(eventId))
    .map(([code, v]) => ({ code, ...v }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

// Real mode: POST /checkins { eventId, code }
export async function checkIn(eventId, rawCode, user) {
  if (!MOCK) return authed("POST", "/checkins", { eventId, code: rawCode });
  const ev = events().find((e) => e.id === String(eventId));
  if (!ev) throw fail("Event not found.");
  if (!owns(user, ev)) throw fail("You can only check in guests for your own events.");
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) throw fail("Enter or scan a ticket code.");
  const any = bookings().find((b) => b.tickets.includes(code));
  if (any?.status === "CANCELLED") throw fail("This ticket was cancelled and refunded. Do not admit.", "CANCELLED");
  const booking = bookings().find((b) => b.status === "CONFIRMED" && b.tickets.includes(code));
  if (!booking) throw fail("Invalid ticket. This code does not exist or was never paid for.", "INVALID");
  if (booking.eventId !== ev.id) throw fail(`Wrong event. This ticket is for "${booking.eventTitle}".`, "WRONG_EVENT");
  const used = checkins()[code];
  if (used) throw fail(`Already used at ${new Date(used.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}.`, "USED");
  const entry = { at: new Date().toISOString(), by: user.email, eventId: ev.id };
  write(CHECKIN_KEY, { ...checkins(), [code]: entry });
  return { code, guest: booking.userName || booking.userEmail, ...entry };
}

// ---------------- Admin ----------------
// Real mode: GET /admin/users, PATCH /admin/users/:email  { role?, active? }
export async function listUsers() {
  if (!MOCK) return authed("GET", "/admin/users");
  return users().map((u) => ({ ...publicUser(u), verified: u.verified, active: u.active !== false, createdAt: u.createdAt || null }));
}

export async function updateUserAdmin(email, patch, admin) {
  if (!MOCK) return authed("PATCH", `/admin/users/${encodeURIComponent(email)}`, patch);
  if (admin.role !== "Admin") throw fail("Admins only.");
  if (email === admin.email) throw fail("You cannot change your own role or status.");
  const list = users();
  const target = list.find((u) => u.email === email);
  if (!target) throw fail("User not found.");
  const next = { ...target };
  if (patch.role) {
    if (!["Attendee", "Organizer", "Admin"].includes(patch.role)) throw fail("Unknown role.");
    next.role = patch.role;
  }
  if (typeof patch.active === "boolean") next.active = patch.active;
  write("gather.users", list.map((u) => (u.email === email ? next : u)));
  return publicUser(next);
}
