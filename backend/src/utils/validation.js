// Server-side copy of the frontend rules (Frontend/src/validation.js). The browser can be bypassed, so these are the real checks.
import { localDate, localTime, maxEventDate, isRealDate, eventStart, hoursUntil, MAX_YEARS_AHEAD } from "./time.js";

export const MAX_PRICE = 100000;
export const MAX_CAPACITY = 100000;
export const MAX_QTY_PER_BOOKING = 5;
export const MAX_TICKETS_PER_PERSON = 10; // paid + unpaid tickets one person may hold for a single event
export const CATEGORIES = ["Conference", "Workshop", "Entertainment", "Networking", "Sports"];
export const CANCEL_CUTOFF_HOURS = 24; // keep equal to Frontend/src/validation.js
export const OTP_MINUTES = 10;
export const OTP_MAX_TRIES = 5;
export const OTP_RESEND_SECONDS = 30;

export const PHONE_RE = /^\+?[0-9 ()-]{8,16}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const first = (errs) => Object.values(errs)[0];
export { first as firstError };

export function validatePassword(pw) {
  if (!pw || pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 72) return "Password is limited to 72 characters."; // bcrypt ignores everything after 72 bytes
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use at least one letter and one number.";
  return "";
}

export function validateRegistration({ name, email, phone, password }) {
  const e = {};
  if (name.length < 2 || name.length > 60) e.name = "Name must be 2 to 60 characters.";
  if (!EMAIL_RE.test(email) || email.length > 120) e.email = "Enter a valid email address.";
  if (phone && !PHONE_RE.test(phone)) e.phone = "Enter a valid phone number (8-16 digits).";
  const pw = validatePassword(password);
  if (pw) e.password = pw;
  return e;
}

export function validateProfile({ name, phone }) {
  const e = {};
  if (name.length < 2) e.name = "Name must be at least 2 characters.";
  else if (name.length > 60) e.name = "Name is limited to 60 characters.";
  if (phone && !PHONE_RE.test(phone)) e.phone = "Enter a valid phone number (8-16 digits).";
  return e;
}

export function validatePasswordChange({ current, next }) {
  const e = {};
  if (!current) e.current = "Enter your current password.";
  const pw = validatePassword(next);
  if (pw) e.next = pw;
  else if (next === current) e.next = "New password must be different from the current one.";
  return e;
}

// `f` = request body, `original` = saved event when editing. Returns { field: message }.
export function validateEvent(f, original = null) {
  const e = {};
  const title = String(f.title ?? "").trim();
  const location = String(f.location ?? "").trim();

  if (title.length < 3) e.title = "Event name must be at least 3 characters.";
  else if (title.length > 80) e.title = "Event name is limited to 80 characters.";
  if (!location) e.location = "Venue is required.";
  else if (location.length > 100) e.location = "Venue is limited to 100 characters.";
  if (!CATEGORIES.includes(f.category)) e.category = "Choose a valid category.";

  if (!f.date) e.date = "Pick the event date.";
  else if (!isRealDate(f.date)) e.date = "That is not a valid date.";
  else if (f.date > maxEventDate()) e.date = `Date cannot be more than ${MAX_YEARS_AHEAD} years ahead.`;

  if (!f.time) e.time = "Pick the start time.";
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) e.time = "That is not a valid time.";

  if (!e.date && !e.time) {
    const unchanged = original && original.date === f.date && original.time === f.time;
    if (!unchanged) {
      if (f.date < localDate()) e.date = "The event date cannot be in the past.";
      else if (f.date === localDate() && f.time <= localTime()) e.time = "For an event today, the start time must be later than now.";
    }
  }

  const priceRaw = String(f.price ?? "").trim();
  const price = Number(priceRaw);
  if (priceRaw === "") e.price = "Enter a price (0 for a free event).";
  else if (!Number.isFinite(price)) e.price = "Price must be a number.";
  else if (price < 0) e.price = "Price cannot be negative.";
  else if (!Number.isInteger(price)) e.price = "Use whole rupees (no paise).";
  else if (price > MAX_PRICE) e.price = `Price cannot be more than ${MAX_PRICE}.`;

  const capRaw = String(f.capacity ?? "").trim();
  const cap = Number(capRaw);
  const booked = Number(original?.booked ?? 0);
  if (capRaw === "" || !Number.isInteger(cap) || cap < 1) e.capacity = "Capacity must be a whole number, at least 1.";
  else if (cap > MAX_CAPACITY) e.capacity = `Capacity cannot be more than ${MAX_CAPACITY}.`;
  else if (cap < booked) e.capacity = `Capacity cannot be below the ${booked} seats already booked.`;

  if (String(f.description ?? "").length > 500) e.description = "Description is limited to 500 characters.";
  return e;
}

// Attendee cancelling a booking. `booking` has eventDate/eventTime/status and `usedTickets`.
export function cancelCheck(booking) {
  if (booking.status === "CANCELLED") return { ok: false, reason: "Already cancelled." };
  if (booking.status === "PENDING_PAYMENT") return { ok: true, reason: "" };
  if ((booking.usedTickets || []).length > 0) return { ok: false, reason: "Some tickets were already used at the gate." };
  const h = hoursUntil({ date: booking.eventDate, time: booking.eventTime });
  if (h < 0) return { ok: false, reason: "This event has already started." };
  if (h < CANCEL_CUTOFF_HOURS) return { ok: false, reason: `Cancellation closes ${CANCEL_CUTOFF_HOURS} hours before the event.` };
  return { ok: true, reason: "" };
}

export { eventStart };
