import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { notFound, errorHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import eventRoutes from "./routes/events.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import checkinRoutes from "./routes/checkins.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";

const app = express();
if (config.trustProxy) app.set("trust proxy", 1); // set TRUST_PROXY=true behind Render/Nginx/etc. so rate limits see real client IPs

app.use(helmet());
// Only your frontend's origin(s) may call the API from a browser. In development any localhost / 127.0.0.1 port is also
// accepted, so it still works if Vite picks another port (5174...) or you open http://127.0.0.1:5173.
const allowedOrigins = new Set(config.clientUrls);
const localDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin) || (!config.production && localDev.test(origin))) }));
app.use(express.json({ limit: "100kb" }));
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many requests. Please slow down.", code: "RATE_LIMITED" } }));

app.get("/api/health", (_req, res) => res.json({ ok: true, payments: config.paymentMode }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
