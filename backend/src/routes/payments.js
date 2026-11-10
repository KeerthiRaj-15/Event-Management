import { Router } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Event } from "../models/Event.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, wrap } from "../utils/http.js";
import { isPast } from "../utils/time.js";
import { config } from "../config.js";
import { payments } from "../services/payments.js";
import { confirmBooking, cancelBookingDoc, withUsedTickets } from "../services/bookings.js";

const router = Router();
const frontend = (path) => `${config.clientUrls[0]}${path}`;

async function loadMine(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, "Booking not found.", "NOT_FOUND");
  const b = await Booking.findOne({ _id: id, userEmail: user.email });
  if (!b) throw new AppError(404, "Booking not found.", "NOT_FOUND");
  return b;
}

// The booking must still be payable: event open, not started, booking unpaid.
async function assertPayable(b) {
  if (b.status === "CANCELLED") throw new AppError(409, "This booking was cancelled.", "NOT_PAYABLE");
  const ev = await Event.findById(b.eventId);
  if (!ev || ev.status !== "Published") throw new AppError(409, "This event is no longer open for booking.", "NOT_OPEN");
  if (isPast(ev)) throw new AppError(409, "This event has already started. Booking is closed.", "CLOSED");
}

// Shared by the capture route and the PayPal return redirect.
async function finishPayment(booking) {
  const { paymentId } = await payments.capture(booking);
  try {
    return await confirmBooking(booking, paymentId);
  } catch (err) {
    if (err.code !== "SOLD_OUT" && err.code !== "NOT_PAYABLE") throw err;
    // The buyer paid but the booking can no longer be fulfilled (last seats taken, or the booking/event was cancelled
    // while they were on the PayPal page): give the money back at once instead of keeping it.
    await Booking.updateOne({ _id: booking._id }, { $set: { paymentId } });
    const fresh = await Booking.findById(booking._id);
    const soldOut = err.code === "SOLD_OUT";
    try {
      const { refundId } = await payments.refund({ ...fresh.toObject(), paymentId });
      const done = { refundAmount: booking.amount, refundId };
      if (soldOut) Object.assign(done, { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Sold out while paying. Refunded." });
      await Booking.updateOne({ _id: booking._id }, { $set: done });
    } catch (e) {
      console.error(`REFUND NEEDED for booking ${booking._id} (payment ${paymentId}):`, e.message); // needs manual attention
    }
    throw soldOut
      ? new AppError(409, "Sorry, the last seats were taken while you were paying. You have been refunded.", "SOLD_OUT")
      : new AppError(409, "This booking was cancelled while you were paying. You have been refunded.", "NOT_PAYABLE");
  }
}

// POST /payments/orders { bookingId } -> { approvalUrl } (PayPal) or {} (mock: the frontend then calls /capture)
router.post("/orders", requireAuth, wrap(async (req, res) => {
  const b = await loadMine(req.body?.bookingId, req.user);
  if (b.status === "CONFIRMED") throw new AppError(409, "This booking is already paid.", "ALREADY_PAID");
  await assertPayable(b);
  const order = await payments.createOrder(b);
  if (order.orderId) await Booking.updateOne({ _id: b._id }, { $set: { paypalOrderId: order.orderId } });
  res.json(order.approvalUrl ? { approvalUrl: order.approvalUrl } : { mock: true });
}));

// POST /payments/capture { bookingId, outcome? } -> confirmed booking with tickets
// `outcome` ("success" | "cancel" | "fail") is only honoured in mock mode so the demo buttons keep working.
router.post("/capture", requireAuth, wrap(async (req, res) => {
  const b = await loadMine(req.body?.bookingId, req.user);
  if (b.status === "CONFIRMED") return res.json((await withUsedTickets([b]))[0]); // paying twice never charges twice
  await assertPayable(b);

  if (payments.mode === "mock") {
    if (req.body?.outcome === "cancel") throw new AppError(400, "Payment cancelled. No money was taken.", "CANCELLED");
    if (req.body?.outcome === "fail") throw new AppError(400, "Payment was declined. Please try again or use another method.", "DECLINED");
  } else if (!b.paypalOrderId) {
    throw new AppError(400, "Start the payment first.", "NO_ORDER");
  }
  const done = await finishPayment(b);
  res.json((await withUsedTickets([done]))[0]);
}));

// GET /payments/paypal/return?bookingId=..&token=<PayPal order id>   (PayPal sends the buyer's browser here)
// No login token is available on a redirect, so the order id PayPal gives us is what authorises the capture.
router.get("/paypal/return", wrap(async (req, res) => {
  const { bookingId, token } = req.query;
  if (!mongoose.isValidObjectId(bookingId) || typeof token !== "string") return res.redirect(frontend("/tickets"));
  const b = await Booking.findOne({ _id: bookingId, paypalOrderId: token });
  if (!b) return res.redirect(frontend("/tickets"));
  if (b.status === "CONFIRMED") return res.redirect(frontend("/tickets"));
  try {
    await assertPayable(b);
    await finishPayment(b);
    res.redirect(frontend("/tickets"));
  } catch (err) {
    console.error("PayPal return failed:", err.message);
    res.redirect(frontend(["SOLD_OUT", "NOT_PAYABLE", "NOT_OPEN", "CLOSED"].includes(err.code) ? "/tickets" : `/checkout/${b._id}`));
  }
}));

// GET /payments/paypal/cancel?bookingId=..   (buyer pressed "Cancel and return" on PayPal)
router.get("/paypal/cancel", (req, res) => {
  const id = mongoose.isValidObjectId(req.query.bookingId) ? req.query.bookingId : "";
  res.redirect(frontend(id ? `/checkout/${id}` : "/tickets"));
});

export default router;
