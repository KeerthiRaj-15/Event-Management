// Payment provider. PAYMENT_MODE=mock confirms instantly (development, no money moves).
// PAYMENT_MODE=paypal uses the PayPal Orders v2 API (sandbox or live).
import { config } from "../config.js";
import { AppError } from "../utils/http.js";
import { shortId } from "../utils/otp.js";

const BASE = config.paypal.env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
const money = (n) => Number(n).toFixed(2);

let cached = { token: null, expires: 0 };
async function accessToken() {
  if (cached.token && Date.now() < cached.expires - 30000) return cached.token;
  const basic = Buffer.from(`${config.paypal.clientId}:${config.paypal.secret}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(502, "Payment provider sign-in failed.", "PAYPAL_AUTH");
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function paypal(path, body, requestId) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      // Same id = PayPal returns the earlier result instead of charging or refunding twice.
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const mock = {
  mode: "mock",
  async createOrder() { return {}; }, // no approvalUrl: the frontend then calls /payments/capture directly
  async capture() { return { paymentId: shortId("PAY") }; },
  async refund() { return { refundId: shortId("RF") }; },
};

const real = {
  mode: "paypal",
  async createOrder(booking) {
    const { ok, data } = await paypal("/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: String(booking._id),
        custom_id: String(booking._id),
        description: `${booking.quantity} ticket(s) for ${booking.eventTitle}`.slice(0, 120),
        amount: { currency_code: config.paypal.currency, value: money(booking.amount) },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Gather",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${config.apiPublicUrl}/api/payments/paypal/return?bookingId=${booking._id}`,
            cancel_url: `${config.apiPublicUrl}/api/payments/paypal/cancel?bookingId=${booking._id}`,
          },
        },
      },
    }, `order-${booking._id}-${booking.amount}`);
    if (!ok) throw new AppError(502, "Could not start the PayPal payment. Please try again.", "PAYPAL_ORDER");
    const link = (data.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve");
    if (!link) throw new AppError(502, "PayPal did not return an approval link.", "PAYPAL_ORDER");
    return { orderId: data.id, approvalUrl: link.href };
  },

  // Called after the buyer approved on PayPal. Verifies the money really arrived and matches the booking.
  async capture(booking) {
    const { ok, data } = await paypal(`/v2/checkout/orders/${booking.paypalOrderId}/capture`, null, `capture-${booking.paypalOrderId}`);
    if (!ok) throw new AppError(400, "The payment was not completed. No money was taken, or it is still pending. Please try again.", "PAYMENT_NOT_COMPLETED");
    const cap = data.purchase_units?.[0]?.payments?.captures?.[0];
    if (!cap || cap.status !== "COMPLETED") throw new AppError(400, "The payment is not completed yet.", "PAYMENT_NOT_COMPLETED");
    if (cap.amount?.value !== money(booking.amount) || cap.amount?.currency_code !== config.paypal.currency)
      throw new AppError(400, "The paid amount does not match this booking.", "AMOUNT_MISMATCH");
    return { paymentId: cap.id };
  },

  async refund(booking) {
    const { ok, data } = await paypal(`/v2/payments/captures/${booking.paymentId}/refund`, {
      amount: { value: money(booking.amount), currency_code: config.paypal.currency },
      note_to_payer: "Gather booking cancelled",
    }, `refund-${booking.paymentId}`);
    if (!ok || !["COMPLETED", "PENDING"].includes(data.status)) throw new AppError(502, "Refund failed.", "REFUND_FAILED");
    return { refundId: data.id };
  },
};

export const payments = config.paymentMode === "paypal" ? real : mock;
