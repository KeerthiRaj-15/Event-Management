// Event date/time strings ("2026-12-01", "19:30") have no zone, so they are read in EVENT_UTC_OFFSET (India: +05:30).
import { config } from "../config.js";

const [, sign, hh, mm] = /^([+-])(\d{2}):(\d{2})$/.exec(config.utcOffset) || [null, "+", "05", "30"];
const offsetMinutes = (sign === "-" ? -1 : 1) * (Number(hh) * 60 + Number(mm));
const pad = (n) => String(n).padStart(2, "0");

// A Date whose UTC fields read as the wall clock in the event time zone.
export const nowLocal = () => new Date(Date.now() + offsetMinutes * 60000);
export const localDate = (d = nowLocal()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const localTime = (d = nowLocal()) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

export const eventStart = (ev) => new Date(`${ev.date}T${ev.time || "00:00"}:00${config.utcOffset}`);
export const isPast = (ev) => eventStart(ev).getTime() < Date.now();
export const hoursUntil = (ev) => (eventStart(ev).getTime() - Date.now()) / 36e5;

export const MAX_YEARS_AHEAD = 3;
export const maxEventDate = () => {
  const d = nowLocal();
  d.setUTCFullYear(d.getUTCFullYear() + MAX_YEARS_AHEAD);
  return localDate(d);
};

export const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
