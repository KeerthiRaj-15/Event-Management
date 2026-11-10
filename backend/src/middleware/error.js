import { config } from "../config.js";
import { AppError } from "../utils/http.js";

export const notFound = (_req, _res, next) => next(new AppError(404, "Route not found.", "NOT_FOUND"));

// Single place that turns any error into { message, code } JSON (the shape the frontend reads).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) return res.status(err.status).json({ message: err.message, code: err.code, ...(err.extra || {}) });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON in request.", code: "BAD_JSON" });
  if (err?.type === "entity.too.large") return res.status(413).json({ message: "Request is too large.", code: "TOO_LARGE" });
  if (err?.name === "ValidationError") return res.status(400).json({ message: Object.values(err.errors || {})[0]?.message || "Invalid data.", code: "VALIDATION" });
  if (err?.name === "CastError") return res.status(404).json({ message: "Not found.", code: "NOT_FOUND" });
  if (err?.code === 11000) return res.status(409).json({ message: "That record already exists.", code: "DUPLICATE" });
  console.error(err);
  res.status(500).json({ message: config.production ? "Something went wrong on our side." : err.message, code: "SERVER_ERROR" });
}
