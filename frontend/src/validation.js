// Shared validation. Used by the forms AND by the mock API so both enforce the same rules.
// The real backend must repeat these checks (never trust the browser).

export const MAX_PRICE = 100000;
export const MAX_CAPACITY = 100000;
export const MAX_YEARS_AHEAD = 3;

const pad = (n) => String(n).padStart(2, "0");

// Local date as YYYY-MM-DD. (toISOString() is UTC and gives yesterday in India before 5:30 AM.)
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayLocal = () => localDate();

export const maxEventDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + MAX_YEARS_AHEAD);
  return localDate(d);
};

const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

// Start of the event as a Date (local time).
export const eventStart = (ev) => new Date(`${ev.date}T${ev.time || "00:00"}`);
export const isPast = (ev) => eventStart(ev).getTime() < Date.now();

/**
 * Validates an event form. Returns { field: message } (empty object = valid).
 * `original` is the saved event when editing. A past event can still be edited,
 * but its date/time cannot be moved to another moment in the past.
 */
export function validateEvent(f, original = null) {
  const e = {};
  const title = String(f.title ?? "").trim();
  const location = String(f.location ?? "").trim();

  if (title.length < 3) e.title = "Event name must be at least 3 characters.";
  if (!location) e.location = "Venue is required.";

  // ---- Date and time ----
  if (!f.date) e.date = "Pick the event date.";
  else if (!isRealDate(f.date)) e.date = "That is not a valid date.";
  else if (f.date > maxEventDate()) e.date = `Date cannot be more than ${MAX_YEARS_AHEAD} years ahead.`;

  if (!f.time) e.time = "Pick the start time.";
  else if (!/^\d{2}:\d{2}$/.test(f.time)) e.time = "That is not a valid time.";

  if (!e.date && !e.time) {
    const unchanged = original && original.date === f.date && original.time === f.time;
    if (!unchanged) {
      if (f.date < todayLocal()) e.date = "The event date cannot be in the past.";
      else if (f.date === todayLocal() && f.time <= localTime()) e.time = "For an event today, the start time must be later than now.";
    }
  }

  // ---- Price (whole rupees, 0 = free) ----
  const priceRaw = String(f.price ?? "").trim();
  const price = Number(priceRaw);
  if (priceRaw === "") e.price = "Enter a price (0 for a free event).";
  else if (!Number.isFinite(price)) e.price = "Price must be a number.";
  else if (price < 0) e.price = "Price cannot be negative.";
  else if (!Number.isInteger(price)) e.price = "Use whole rupees (no paise).";
  else if (price > MAX_PRICE) e.price = `Price cannot be more than ₹${MAX_PRICE.toLocaleString("en-IN")}.`;

  // ---- Capacity ----
  const capRaw = String(f.capacity ?? "").trim();
  const cap = Number(capRaw);
  const booked = Number(original?.booked ?? 0);
  if (capRaw === "" || !Number.isInteger(cap) || cap < 1) e.capacity = "Capacity must be a whole number, at least 1.";
  else if (cap > MAX_CAPACITY) e.capacity = `Capacity cannot be more than ${MAX_CAPACITY.toLocaleString("en-IN")}.`;
  else if (cap < booked) e.capacity = `Capacity cannot be below the ${booked} seats already booked.`;

  if (String(f.description ?? "").length > 500) e.description = "Description is limited to 500 characters.";
  return e;
}

// ---- Profile ----
export const PHONE_RE = /^\+?[0-9 ()-]{8,16}$/;

export function validateProfile({ name, phone }) {
  const e = {};
  if (String(name ?? "").trim().length < 2) e.name = "Name must be at least 2 characters.";
  if (String(name ?? "").trim().length > 60) e.name = "Name is limited to 60 characters.";
  if (phone && !PHONE_RE.test(String(phone).trim())) e.phone = "Enter a valid phone number (8-16 digits).";
  return e;
}

export function validatePasswordChange({ current, next, confirm }) {
  const e = {};
  if (!current) e.current = "Enter your current password.";
  if (!next || next.length < 8) e.next = "New password must be at least 8 characters.";
  else if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) e.next = "Use at least one letter and one number.";
  else if (next === current) e.next = "New password must be different from the current one.";
  if (next !== confirm) e.confirm = "Passwords do not match.";
  return e;
}

// ---- Cancellation policy ----
export const CANCEL_CUTOFF_HOURS = 24; // attendees can cancel up to this many hours before the event starts
export const RESET_OTP_MINUTES = 10;

export const hoursUntil = (ev) => (eventStart(ev).getTime() - Date.now()) / 36e5;

// Returns { ok, reason } for an attendee cancelling a booking. `booking` needs eventDate/eventTime/status.
export function cancelCheck(booking) {
  if (booking.status === "CANCELLED") return { ok: false, reason: "Already cancelled." };
  if (booking.status === "PENDING_PAYMENT") return { ok: true, reason: "" };
  if ((booking.usedTickets || []).length > 0) return { ok: false, reason: "Some tickets were already used at the gate." };
  const h = hoursUntil({ date: booking.eventDate, time: booking.eventTime });
  if (h < 0) return { ok: false, reason: "This event has already started." };
  if (h < CANCEL_CUTOFF_HOURS) return { ok: false, reason: `Cancellation closes ${CANCEL_CUTOFF_HOURS} hours before the event.` };
  return { ok: true, reason: "" };
}
