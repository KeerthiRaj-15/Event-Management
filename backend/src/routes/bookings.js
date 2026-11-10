import { Router } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Event } from "../models/Event.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError, wrap } from "../utils/http.js";
import { isPast } from "../utils/time.js";
import { MAX_QTY_PER_BOOKING, cancelCheck } from "../utils/validation.js";
import { confirmBooking, cancelBookingDoc, withUsedTickets } from "../services/bookings.js";

const router = Router();
router.use(requireAuth);

async function loadMine(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Booking not found.", "NOT_FOUND");
  const b = await Booking.findOne({ _id: id, userEmail: user.email });
  if (!b) throw new AppError(404, "Booking not found.", "NOT_FOUND");
  return b;
}

// POST /bookings { eventId, quantity }  -> booking (free events come back CONFIRMED with tickets)
router.post("/", wrap(async (req, res) => {
  const { eventId } = req.body || {};
  const qty = Number(req.body?.quantity);
  if (!mongoose.isValidObjectId(eventId)) throw new AppError(404, "This event is not open for booking.", "NOT_FOUND");
  const ev = await Event.findById(eventId);
  if (!ev || ev.status !== "Published") throw new AppError(400, "This event is not open for booking.", "NOT_OPEN");
  if (isPast(ev)) throw new AppError(400, "This event has already started or ended. Booking is closed.", "CLOSED");
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_BOOKING) throw new AppError(400, `You can book 1 to ${MAX_QTY_PER_BOOKING} tickets at a time.`, "VALIDATION");
  if (ev.capacity - ev.booked < qty) throw new AppError(409, "Not enough seats left.", "SOLD_OUT");

  // Stop one person piling up unpaid bookings.
  if ((await Booking.countDocuments({ userEmail: req.user.email, status: "PENDING_PAYMENT" })) >= 10)
    throw new AppError(429, "You have too many unpaid bookings. Pay for or cancel some first.", "TOO_MANY_PENDING");

  let booking = await Booking.create({
    eventId: ev._id, eventTitle: ev.title, eventDate: ev.date, eventTime: ev.time, location: ev.location,
    userEmail: req.user.email, userName: req.user.name, quantity: qty, amount: ev.price * qty,
  });
  if (booking.amount === 0) booking = await confirmBooking(booking, undefined); // free: no payment step
  res.status(201).json((await withUsedTickets([booking]))[0]);
}));

// GET /bookings/mine
router.get("/mine", wrap(async (req, res) => {
  res.json(await withUsedTickets(await Booking.find({ userEmail: req.user.email }).sort({ createdAt: -1 })));
}));

// GET /bookings  -> bookings for events the user manages (Admin: all)
router.get("/", requireRole("Organizer", "Admin"), wrap(async (req, res) => {
  let filter = {};
  if (req.user.role === "Organizer") {
    const ids = await Event.find({ organizerEmail: req.user.email }, { _id: 1 }).lean();
    filter = { eventId: { $in: ids.map((e) => e._id) } };
  }
  res.json(await withUsedTickets(await Booking.find(filter).sort({ createdAt: -1 })));
}));

// GET /bookings/:id  (your own booking only)
router.get("/:id", wrap(async (req, res) => {
  res.json((await withUsedTickets([await loadMine(req.params.id, req.user)]))[0]);
}));

// POST /bookings/:id/cancel  -> cancelled booking (refund is full; cutoff and used tickets are re-checked here)
router.post("/:id/cancel", wrap(async (req, res) => {
  const b = await loadMine(req.params.id, req.user);
  const [withUsed] = await withUsedTickets([b]);
  const check = cancelCheck(withUsed);
  if (!check.ok) throw new AppError(400, check.reason, "CANNOT_CANCEL");
  const done = await cancelBookingDoc(b, { reason: "Cancelled by attendee", by: req.user.email });
  res.json((await withUsedTickets([done]))[0]);
}));

export default router;
