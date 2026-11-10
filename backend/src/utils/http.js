// Small helpers shared by every route.
export class AppError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Express 4 does not catch rejected promises, so every async handler goes through this.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Always work with plain trimmed strings so objects like { "$gt": "" } can never reach a Mongo query.
export const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
export const email = (v) => str(v).toLowerCase();
