import { Router } from "express";
import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { Booking } from "../models/Booking.js";
import { CheckIn } from "../models/CheckIn.js";
import { requireAuth, requireRole, owns } from "../middleware/auth.js";
import { AppError, wrap, str } from "../utils/http.js";
import { isPast } from "../utils/time.js";
import { validateEvent, firstError } from "../utils/validation.js";
import { cancelBookingDoc } from "../services/bookings.js";

const router = Router();
router.use(requireAuth);
const STAFF = requireRole("Organizer", "Admin");

async function load(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Event not found.", "NOT_FOUND");
  const ev = await Event.findById(id);
  if (!ev) throw new AppError(404, "Event not found.", "NOT_FOUND");
  return ev;
}
const loadOwned = async (id, user, verb = "change") => {
  const ev = await load(id);
  if (!owns(user, ev)) throw new AppError(403, `You can only ${verb} your own events.`, "FORBIDDEN");
  return ev;
};

// Only the fields a form may set. booked / organizerEmail / status Cancelled can never come from the browser.
const cleanFields = (b) => ({
  title: str(b.title), category: str(b.category), date: str(b.date), time: str(b.time),
  location: str(b.location), description: str(b.description),
  price: typeof b.price === "number" ? b.price : str(b.price), // raw until validated, then converted by toNumbers()
  capacity: typeof b.capacity === "number" ? b.capacity : str(b.capacity),
  status: b.status === undefined ? undefined : b.status === "Published" ? "Published" : "Draft",
});
const toNumbers = (f) => ({ ...f, price: Number(f.price), capacity: Number(f.capacity) });

// GET /events            everyone: published + cancelled events, plus your own drafts (Admin: everything)
// GET /events?mine=true  Organizer: own events, Admin: all events
router.get("/", wrap(async (req, res) => {
  let filter;
  if (req.query.mine === "true") {
    if (req.user.role === "Attendee") throw new AppError(403, "You do not have permission to do that.", "FORBIDDEN");
    filter = req.user.role === "Admin" ? {} : { organizerEmail: req.user.email };
  } else {
    filter = req.user.role === "Admin" ? {} : { $or: [{ status: { $in: ["Published", "Cancelled"] } }, { organizerEmail: req.user.email }] };
  }
  res.json(await Event.find(filter).sort({ date: 1, time: 1 }));
}));

// GET /events/:id
router.get("/:id", wrap(async (req, res) => {
  const ev = await load(req.params.id);
  if (ev.status === "Draft" && !owns(req.user, ev)) throw new AppError(404, "Event not found.", "NOT_FOUND");
  res.json(ev);
}));

// POST /events
router.post("/", STAFF, wrap(async (req, res) => {
  const f = cleanFields(req.body || {});
  const errs = validateEvent(f);
  if (Object.keys(errs).length) throw new AppError(400, firstError(errs), "VALIDATION", { errors: errs });
  res.status(201).json(await Event.create({ ...toNumbers(f), status: f.status || "Draft", booked: 0, organizerEmail: req.user.email }));
}));

// PUT /events/:id
router.put("/:id", STAFF, wrap(async (req, res) => {
  const ev = await loadOwned(req.params.id, req.user, "edit");
  if (ev.status === "Cancelled") throw new AppError(400, "A cancelled event cannot be edited.", "CANCELLED");
  const f = cleanFields(req.body || {});
  const errs = validateEvent(f, ev);
  if (Object.keys(errs).length) throw new AppError(400, firstError(errs), "VALIDATION", { errors: errs });
  const next = { ...toNumbers(f), status: f.status || ev.status };
  if (next.status === "Published" && ev.status !== "Published" && isPast(next))
    throw new AppError(400, "This event has already started or ended. Move the date before publishing.", "VALIDATION");

  Object.assign(ev, next);
  await ev.save();
  // Keep what bookings display (and the 24h cancellation cutoff) in line with the event.
  await Booking.updateMany({ eventId: ev._id }, { $set: { eventTitle: ev.title, eventDate: ev.date, eventTime: ev.time, location: ev.location } });
  res.json(ev);
}));

// PATCH /events/:id/status { status: "Published" | "Draft" }
router.patch("/:id/status", STAFF, wrap(async (req, res) => {
  const ev = await loadOwned(req.params.id, req.user);
  const status = req.body?.status;
  if (!["Published", "Draft"].includes(status)) throw new AppError(400, "Status must be Published or Draft.", "VALIDATION");
  if (ev.status === "Cancelled") throw new AppError(400, "A cancelled event cannot be changed.", "CANCELLED");
  if (status === "Published" && isPast(ev)) throw new AppError(400, "This event has already started or ended. Edit its date before publishing.", "VALIDATION");
  ev.status = status;
  await ev.save();
  res.json(ev);
}));

// DELETE /events/:id  (409 HAS_BOOKINGS if anyone ever booked)
router.delete("/:id", STAFF, wrap(async (req, res) => {
  const ev = await loadOwned(req.params.id, req.user, "delete");
  if (ev.booked > 0 || (await Booking.exists({ eventId: ev._id })))
    throw new AppError(409, "This event already has bookings, so it cannot be deleted. Cancel the event instead (everyone is refunded) or move it to Draft.", "HAS_BOOKINGS");
  await ev.deleteOne();
  res.json({ message: "Deleted." });
}));

// POST /events/:id/cancel { reason }  -> { bookings, refunded }
// The event is closed first (so nobody can book or pay), then every booking is cancelled and refunded.
// If some refunds fail the call can simply be repeated: finished bookings are skipped.
router.post("/:id/cancel", STAFF, wrap(async (req, res) => {
  const ev = await loadOwned(req.params.id, req.user, "cancel");
  const why = str(req.body?.reason);
  if (why.length < 5) throw new AppError(400, "Give attendees a reason (at least 5 characters).", "VALIDATION");
  const active = await Booking.find({ eventId: ev._id, status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] } });
  if (ev.status === "Cancelled" && active.length === 0) throw new AppError(400, "This event is already cancelled.", "CANCELLED");
  if (ev.status !== "Cancelled" && isPast(ev)) throw new AppError(400, "This event has already started, so it cannot be cancelled.", "VALIDATION");

  await Event.updateOne({ _id: ev._id }, { $set: { status: "Cancelled", cancelReason: why } });
  let bookings = 0, refunded = 0, failed = 0;
  for (const b of active) {
    try {
      const done = await cancelBookingDoc(b, { reason: `Event cancelled: ${why}`, by: req.user.email });
      bookings += 1; refunded += done.refundAmount || 0;
    } catch { failed += 1; }
  }
  if (failed) throw new AppError(502, `The event is cancelled, but ${failed} refund(s) failed. Press cancel again to retry them.`, "REFUND_FAILED");
  await Event.updateOne({ _id: ev._id }, { $set: { booked: 0 } });
  res.json({ bookings, refunded });
}));

// GET /events/:id/checkins -> [{ code, at, by, eventId }] newest first
router.get("/:id/checkins", STAFF, wrap(async (req, res) => {
  const ev = await loadOwned(req.params.id, req.user, "view");
  res.json(await CheckIn.find({ eventId: ev._id }).sort({ at: -1 }));
}));

export default router;
