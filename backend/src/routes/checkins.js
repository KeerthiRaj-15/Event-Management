import { Router } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Event } from "../models/Event.js";
import { CheckIn } from "../models/CheckIn.js";
import { requireAuth, requireRole, owns } from "../middleware/auth.js";
import { AppError, wrap, str } from "../utils/http.js";
import { localDate } from "../utils/time.js";

const router = Router();
router.use(requireAuth, requireRole("Organizer", "Admin"));

// POST /checkins { eventId, code } -> { code, guest, at, by, eventId }
// Errors the gate screen understands: INVALID, WRONG_EVENT, USED, CANCELLED, NOT_TODAY.
router.post("/", wrap(async (req, res) => {
  const { eventId } = req.body || {};
  if (!mongoose.isValidObjectId(eventId)) throw new AppError(404, "Event not found.", "NOT_FOUND");
  const ev = await Event.findById(eventId);
  if (!ev) throw new AppError(404, "Event not found.", "NOT_FOUND");
  if (!owns(req.user, ev)) throw new AppError(403, "You can only check in guests for your own events.", "FORBIDDEN");

  const code = str(req.body?.code).toUpperCase();
  if (!code || code.length > 40) throw new AppError(400, "Enter or scan a ticket code.", "INVALID");

  // Gates open only on the event day. Staff can override for early entry or testing ({ override: true }).
  if (ev.date !== localDate() && req.body?.override !== true)
    throw new AppError(400, `Check-in is only open on the event day (${ev.date}). Turn on "Allow check-in on other days" to override.`, "NOT_TODAY");

  const booking = await Booking.findOne({ tickets: code });
  if (booking?.status === "CANCELLED") throw new AppError(400, "This ticket was cancelled and refunded. Do not admit.", "CANCELLED");
  if (!booking || booking.status !== "CONFIRMED") throw new AppError(400, "Invalid ticket. This code does not exist or was never paid for.", "INVALID");
  if (String(booking.eventId) !== String(ev._id)) throw new AppError(400, `Wrong event. This ticket is for "${booking.eventTitle}".`, "WRONG_EVENT");

  try {
    const entry = await CheckIn.create({ code, eventId: ev._id, by: req.user.email });
    res.status(201).json({ code, guest: booking.userName || booking.userEmail, at: entry.at, by: entry.by, eventId: String(ev._id) });
  } catch (err) {
    if (err.code !== 11000) throw err;
    // Unique index hit: this ticket was scanned already (even if two gates scanned at the same instant).
    const used = await CheckIn.findOne({ code });
    const when = used ? new Date(used.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "earlier";
    throw new AppError(409, `Already used at ${when}.`, "USED");
  }
}));

export default router;
