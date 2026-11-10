import { Booking } from "../models/Booking.js";
import { Event } from "../models/Event.js";
import { CheckIn } from "../models/CheckIn.js";
import { AppError } from "../utils/http.js";
import { ticketCode } from "../utils/otp.js";
import { payments } from "./payments.js";

// Adds `usedTickets` (codes already scanned at the gate) to each booking, as the frontend expects.
export async function withUsedTickets(list) {
  const codes = list.flatMap((b) => b.tickets || []);
  const used = codes.length ? new Set((await CheckIn.find({ code: { $in: codes } }, { code: 1 }).lean()).map((c) => c.code)) : new Set();
  return list.map((b) => ({ ...b.toJSON(), usedTickets: (b.tickets || []).filter((t) => used.has(t)) }));
}

/**
 * Turns a PENDING_PAYMENT booking into CONFIRMED: takes the seats and issues one ticket code per seat.
 * Safe against double-clicks and two requests at once: only one caller can claim the booking, and the
 * seat count is increased with a single atomic update that refuses to go over capacity.
 * (Without a database transaction, a server crash between the seat update and the final save could leave
 * seats taken but the booking still pending. Use a MongoDB replica set + transactions if that matters to you.)
 */
export async function confirmBooking(booking, paymentId) {
  const claimed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "PENDING_PAYMENT", processing: { $ne: true } },
    { $set: { processing: true } },
    { new: true }
  );
  if (!claimed) {
    const current = await Booking.findById(booking._id);
    if (current?.status === "CONFIRMED") return current; // already done: paying twice never charges or issues twice
    throw new AppError(409, "This booking can no longer be paid.", "NOT_PAYABLE");
  }

  const seats = await Event.findOneAndUpdate(
    { _id: claimed.eventId, status: "Published", $expr: { $lte: [{ $add: ["$booked", claimed.quantity] }, "$capacity"] } },
    { $inc: { booked: claimed.quantity } }
  );
  if (!seats) {
    await Booking.updateOne({ _id: claimed._id }, { $set: { processing: false } });
    throw new AppError(409, "Not enough seats left.", "SOLD_OUT");
  }

  const tickets = Array.from({ length: claimed.quantity }, () => ticketCode(claimed.eventId));
  return Booking.findByIdAndUpdate(claimed._id, { $set: { status: "CONFIRMED", tickets, paymentId, processing: false } }, { new: true });
}

/**
 * Cancels one booking: frees the seats and refunds if it was paid. Used by the attendee ("cancel booking")
 * and by the organizer ("cancel event"). The status flips first (atomically) so a double click can never
 * refund twice; if the refund fails the booking is put back exactly as it was.
 */
export async function cancelBookingDoc(booking, { reason, by }) {
  const prev = await Booking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ["PENDING_PAYMENT", "CONFIRMED"] }, processing: { $ne: true } },
    { $set: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: by, cancelReason: reason } },
    { new: false }
  );
  if (!prev) throw new AppError(409, "This booking is already cancelled or is being processed.", "CANNOT_CANCEL");

  const wasPaid = prev.status === "CONFIRMED";
  let refundId = null;
  let refundAmount = 0;
  if (wasPaid) {
    try {
      if (prev.amount > 0) refundId = (await payments.refund(prev)).refundId;
      refundAmount = prev.amount;
    } catch {
      await Booking.updateOne(
        { _id: prev._id },
        { $set: { status: "CONFIRMED" }, $unset: { cancelledAt: 1, cancelledBy: 1, cancelReason: 1 } }
      );
      throw new AppError(502, "The refund could not be processed, so nothing was cancelled. Please try again shortly.", "REFUND_FAILED");
    }
    await Event.updateOne({ _id: prev.eventId, booked: { $gte: prev.quantity } }, { $inc: { booked: -prev.quantity } });
  }
  return Booking.findByIdAndUpdate(prev._id, { $set: { refundAmount, refundId } }, { new: true });
}
