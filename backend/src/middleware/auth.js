import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";
import { AppError, wrap } from "../utils/http.js";

export const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpires });

// Reads "Authorization: Bearer <token>", then loads the user from the database on EVERY request,
// so a deactivated account or changed role takes effect immediately (not only after the token expires).
// 401 makes the frontend clear its session and go to the login page.
export const requireAuth = wrap(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new AppError(401, "Please log in.", "NO_TOKEN");
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); }
  catch { throw new AppError(401, "Your session has expired. Please log in again.", "TOKEN_INVALID"); }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, "Your session is no longer valid. Please log in again.", "TOKEN_INVALID");
  if (!user.active) throw new AppError(401, "This account has been deactivated. Contact an administrator.", "DEACTIVATED");
  req.user = user;
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, "You do not have permission to do that.", "FORBIDDEN"));

export const isStaff = (u) => u.role === "Admin" || u.role === "Organizer";
// Admin manages everything; an Organizer only their own events.
export const owns = (user, ev) => user.role === "Admin" || (user.role === "Organizer" && ev.organizerEmail === user.email);
