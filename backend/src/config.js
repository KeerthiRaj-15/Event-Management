import "dotenv/config";

const env = process.env;
const flag = (v, fallback) => (v === undefined || v === "" ? fallback : String(v).toLowerCase() === "true");

const nodeEnv = env.NODE_ENV || "development";
const production = nodeEnv === "production";

export const config = {
  production,
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGO_URI,
  jwtSecret: env.JWT_SECRET,
  jwtExpires: env.JWT_EXPIRES || "7d",
  clientUrls: (env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
  apiPublicUrl: (env.API_PUBLIC_URL || `http://localhost:${Number(env.PORT) || 5000}`).replace(/\/$/, ""),
  utcOffset: env.EVENT_UTC_OFFSET || "+05:30",
  trustProxy: flag(env.TRUST_PROXY, false),
  smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT) || 587, user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.MAIL_FROM || "Gather <no-reply@example.com>" },
  // When true the API returns the OTP in its response (development only, so the frontend can display it).
  exposeDevOtp: flag(env.EXPOSE_DEV_OTP, !production && !env.SMTP_HOST),
  paymentMode: (env.PAYMENT_MODE || "mock").toLowerCase(),
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,         // rzp_test_... for testing, rzp_live_... for real money
    keySecret: env.RAZORPAY_KEY_SECRET, // server only. Never put this in the frontend.
    currency: "INR",
  },
};

// Fail fast with a clear message instead of misbehaving later.
export function assertConfig() {
  const problems = [];
  if (!config.mongoUri) problems.push("MONGO_URI is not set.");
  if (!config.jwtSecret || config.jwtSecret.length < 16) problems.push("JWT_SECRET must be set to a long random string (16+ characters).");
  if (!/^[+-]\d{2}:\d{2}$/.test(config.utcOffset)) problems.push('EVENT_UTC_OFFSET must look like "+05:30".');
  if (!["mock", "razorpay"].includes(config.paymentMode)) problems.push('PAYMENT_MODE must be "mock" or "razorpay".');
  if (config.paymentMode === "razorpay" && (!config.razorpay.keyId || !config.razorpay.keySecret)) problems.push("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_MODE=razorpay.");
  if (config.production && config.paymentMode === "razorpay" && config.razorpay.keyId?.startsWith("rzp_test_")) problems.push("Use live Razorpay keys (rzp_live_...) in production.");
  if (config.production && config.paymentMode === "mock") problems.push("PAYMENT_MODE=mock is not allowed in production (it confirms bookings without taking money).");
  if (config.production && config.exposeDevOtp) problems.push("EXPOSE_DEV_OTP must be off in production (it would leak login codes).");
  if (problems.length) throw new Error("Configuration problems:\n - " + problems.join("\n - "));
}
