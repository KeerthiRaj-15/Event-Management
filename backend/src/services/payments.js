// Payment provider. PAYMENT_MODE=mock confirms instantly (development, no money moves).
// PAYMENT_MODE=razorpay uses the Razorpay Orders API (test keys rzp_test_... = test money, live keys = real money).
//
// Flow: server creates an order -> browser opens Razorpay Checkout -> browser gets
// { razorpay_payment_id, razorpay_signature } -> server verifies the signature AND asks Razorpay for the
// payment itself (status, amount, order) before any ticket is issued.
import crypto from "node:crypto";
import { config } from "../config.js";
import { AppError } from "../utils/http.js";
import { shortId } from "../utils/otp.js";

const BASE = "https://api.razorpay.com/v1";
const paise = (rupees) => Math.round(Number(rupees) * 100); // Razorpay amounts are in the smallest unit

async function razorpay(method, path, body) {
  const basic = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString("base64");
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const mock = {
  mode: "mock",
  async createOrder() { return {}; }, // no order: the frontend then calls /payments/capture directly
  async capture() { return { paymentId: shortId("PAY") }; },
  async refund() { return { refundId: shortId("RF") }; },
};

const real = {
  mode: "razorpay",

  async createOrder(booking) {
    const { ok, data } = await razorpay("POST", "/orders", {
      amount: paise(booking.amount),
      currency: config.razorpay.currency,
      receipt: String(booking._id), // 24 chars, limit is 40
      notes: { bookingId: String(booking._id), event: String(booking.eventTitle || "").slice(0, 100) },
    });
    if (!ok || !data.id) {
      console.error("Razorpay order failed:", data?.error?.description || data);
      throw new AppError(502, "Could not start the payment. Please try again.", "PAYMENT_ORDER");
    }
    return { orderId: data.id, checkout: { keyId: config.razorpay.keyId, orderId: data.id, amount: data.amount, currency: data.currency } };
  },

  // proof = { razorpayPaymentId, razorpaySignature } from the browser. Never trust it until verified here.
  async capture(booking, proof = {}) {
    const { razorpayPaymentId: paymentId, razorpaySignature: signature } = proof;
    if (!booking.razorpayOrderId) throw new AppError(400, "Start the payment first.", "NO_ORDER");
    if (!paymentId || !signature) throw new AppError(400, "Payment details are missing.", "PAYMENT_NOT_COMPLETED");

    // 1. Signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret). The order id comes from OUR database.
    const expected = crypto.createHmac("sha256", config.razorpay.keySecret).update(`${booking.razorpayOrderId}|${paymentId}`).digest("hex");
    if (!safeEqual(expected, signature)) throw new AppError(400, "Payment could not be verified.", "BAD_SIGNATURE");

    // 2. Ask Razorpay what really happened to this payment.
    let { ok, data: pay } = await razorpay("GET", `/payments/${encodeURIComponent(paymentId)}`);
    if (!ok) throw new AppError(400, "The payment was not completed. Please try again.", "PAYMENT_NOT_COMPLETED");
    if (pay.order_id !== booking.razorpayOrderId || pay.amount !== paise(booking.amount) || pay.currency !== config.razorpay.currency)
      throw new AppError(400, "The paid amount does not match this booking.", "AMOUNT_MISMATCH");

    // 3. If your Razorpay account is not set to auto-capture, capture it now.
    if (pay.status === "authorized") {
      const cap = await razorpay("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: pay.amount, currency: pay.currency });
      if (!cap.ok) throw new AppError(400, "The payment could not be captured. Please try again.", "PAYMENT_NOT_COMPLETED");
      pay = cap.data;
    }
    if (pay.status !== "captured") throw new AppError(400, "The payment is not completed yet.", "PAYMENT_NOT_COMPLETED");
    return { paymentId: pay.id };
  },

  async refund(booking) {
    const { ok, data } = await razorpay("POST", `/payments/${encodeURIComponent(booking.paymentId)}/refund`, {
      amount: paise(booking.amount),
      speed: "normal",
      notes: { bookingId: String(booking._id), reason: "Gather booking cancelled" },
    });
    if (!ok || !data.id) {
      console.error("Razorpay refund failed:", data?.error?.description || data);
      throw new AppError(502, "Refund failed.", "REFUND_FAILED");
    }
    return { refundId: data.id };
  },
};

export const payments = config.paymentMode === "razorpay" ? real : mock;
