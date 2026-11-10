import crypto from "node:crypto";
import { config } from "../config.js";

export const generateOtp = () => String(crypto.randomInt(100000, 1000000));

// Codes are stored as an HMAC (never in plain text). Binding the email stops a code being reused for another account.
export const hashOtp = (email, otp) => crypto.createHmac("sha256", config.jwtSecret).update(`${email}:${String(otp).trim()}`).digest("hex");

export function otpMatches(email, otp, storedHash) {
  if (!storedHash) return false;
  const a = Buffer.from(hashOtp(email, otp), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I so codes are easy to read aloud
export function ticketCode(eventId) {
  const bytes = crypto.randomBytes(8);
  const tail = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `GTH-${String(eventId).slice(-4).toUpperCase()}-${tail}`;
}

export const shortId = (prefix) => `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
