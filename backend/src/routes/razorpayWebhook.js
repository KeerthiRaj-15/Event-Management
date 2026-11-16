import { Router } from "express";
import express from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { Booking } from "../models/Booking.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { Event } from "../models/Event.js";
import { payments } from "../services/payments.js";
import { confirmBooking } from "../services/bookings.js";

const router = Router();
const paise = (rupees) => Math.round(Number(rupees) * 100);

function validSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(String(signature), "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function refundCapturedPayment(booking, payment, reason, soldOut = false) {
  // Persist the payment ID first so an administrator can reconcile the payment if the refund API fails.
  await Booking.updateOne({ _id: booking._id }, { $set: { paymentId: payment.id } });
  const fresh = await Booking.findById(booking._id);
  if (fresh.refundId) return;

  const { refundId } = await payments.refund({ ...fresh.toObject(), paymentId: payment.id });
  const update = { refundId, refundAmount: booking.amount };
  if (soldOut) {
    Object.assign(update, {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "Sold out while payment was completing. Refunded.",
    });
  }
  await Booking.updateOne({ _id: booking._id }, { $set: update });
  console.warn(`Razorpay payment ${payment.id} was refunded for booking ${booking._id}: ${reason}`);
}

async function handleCapturedPayment(payment) {
  if (!payment?.id || !payment?.order_id) {
    console.warn("Razorpay payment.captured webhook did not contain a payment/order ID.");
    return;
  }

  const booking = await Booking.findOne({ razorpayOrderId: payment.order_id });
  if (!booking) {
    console.warn(`No Gather booking found for Razorpay order ${payment.order_id}.`);
    return;
  }

  // Never issue tickets for a payment that does not exactly match this booking.
  if (payment.amount !== paise(booking.amount) || payment.currency !== config.razorpay.currency) {
    console.error(`Payment amount/currency mismatch for booking ${booking._id}, payment ${payment.id}. Manual review required.`);
    return;
  }
  if (payment.status && payment.status !== "captured") return;
  if (booking.status === "CONFIRMED") return;

  if (booking.status === "CANCELLED") {
    await refundCapturedPayment(booking, payment, "booking was already cancelled");
    return;
  }

  try {
    await confirmBooking(booking, payment.id);
    console.log(`Booking ${booking._id} confirmed from Razorpay webhook.`);
  } catch (error) {
    if (error.code === "SOLD_OUT") {
      await refundCapturedPayment(booking, payment, "event sold out while payment was completing", true);
      return;
    }
    if (error.code === "NOT_PAYABLE") {
      const latest = await Booking.findById(booking._id);
      if (latest?.status === "CANCELLED") {
        await refundCapturedPayment(latest, payment, "booking became cancelled while payment was completing");
        return;
      }
    }
    throw error;
  }
}

async function handleFailedPayment(payment) {
  if (!payment?.order_id) return;
  await Booking.updateOne(
    { razorpayOrderId: payment.order_id, status: "PENDING_PAYMENT" },
    {
      $set: {
        lastPaymentFailureAt: new Date(),
        lastPaymentFailureReason: String(payment.error_description || payment.error_reason || "Payment failed").slice(0, 300),
      },
    }
  );
  console.log(`Razorpay payment failure recorded for order ${payment.order_id}.`);
}

// IMPORTANT: this route must be mounted before express.json() in app.js.
router.post("/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  if (payments.mode !== "razorpay") {
    return res.status(503).json({ message: "Razorpay webhooks are available only when PAYMENT_MODE=razorpay." });
  }
  if (!config.razorpay.webhookSecret) {
    return res.status(503).json({ message: "RAZORPAY_WEBHOOK_SECRET is not configured." });
  }

  const signature = req.get("x-razorpay-signature");
  if (!validSignature(req.body, signature, config.razorpay.webhookSecret)) {
    return res.status(400).send("Invalid webhook signature");
  }

  let body;
  try {
    body = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON payload");
  }

  const eventName = body.event;
  const eventId = req.get("x-razorpay-event-id") || crypto.createHash("sha256").update(req.body).digest("hex");
  let eventRecord;

  try {
    eventRecord = await WebhookEvent.create({ eventId, event: eventName || "unknown", status: "PROCESSING" });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await WebhookEvent.findOne({ eventId }).lean();
      if (existing?.status === "PROCESSED") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      // Recover an event left PROCESSING by a server crash. A recent record may belong to a concurrent request.
      const stale = existing && Date.now() - new Date(existing.updatedAt).getTime() > 2 * 60 * 1000;
      if (stale) {
        await WebhookEvent.deleteOne({ _id: existing._id, status: "PROCESSING" });
        try {
          eventRecord = await WebhookEvent.create({ eventId, event: eventName || "unknown", status: "PROCESSING" });
        } catch (retryError) {
          if (retryError?.code === 11000) return res.status(200).json({ received: true, duplicate: true });
          throw retryError;
        }
      } else {
        return res.status(200).json({ received: true, duplicate: true });
      }
    } else {
      console.error("Could not record Razorpay webhook:", error);
      return res.status(500).send("Could not record webhook");
    }
  }

  try {
    const payment = body?.payload?.payment?.entity;
    if (eventName === "payment.captured") {
      await handleCapturedPayment(payment);
    } else if (eventName === "payment.failed") {
      await handleFailedPayment(payment);
    } else if (eventName === "order.paid") {
      // payment.captured is the canonical event used to confirm Gather bookings.
      // Keep order.paid subscribed only if desired; it is acknowledged without duplicate fulfillment.
      console.log("Razorpay order.paid webhook received.");
    } else {
      console.log(`Ignoring unsupported Razorpay webhook event: ${eventName}`);
    }

    eventRecord.status = "PROCESSED";
    eventRecord.processedAt = new Date();
    await eventRecord.save();
    return res.status(200).json({ received: true });
  } catch (error) {
    // Remove the idempotency record so Razorpay's retry can process this event again.
    await WebhookEvent.deleteOne({ _id: eventRecord._id }).catch(() => {});
    console.error("Razorpay webhook processing failed:", error);
    return res.status(500).send("Webhook processing failed");
  }
});

export default router;
