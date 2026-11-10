import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User, publicUser } from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { AppError, wrap, str, email as normEmail } from "../utils/http.js";
import { generateOtp, hashOtp, otpMatches } from "../utils/otp.js";
import { sendOtpMail } from "../utils/mailer.js";
import { config } from "../config.js";
import { validateRegistration, validatePasswordChange, firstError, OTP_MINUTES, OTP_MAX_TRIES, OTP_RESEND_SECONDS } from "../utils/validation.js";

const router = Router();

// Slows down password guessing and code guessing from one address.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a few minutes and try again.", code: "RATE_LIMITED" } }));

const devOtp = (otp) => (config.exposeDevOtp ? { devOtp: otp } : {});
const fresh = (user, kind) => Date.now() - (user[`${kind}SentAt`]?.getTime?.() ?? 0) < OTP_RESEND_SECONDS * 1000;

// A password hash to compare against when the email is unknown, so "no such user" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Stores a new verification code on the user and emails it. Returns the plain code (for devOtp only).
async function issueVerificationCode(user) {
  const otp = generateOtp();
  await User.updateOne({ _id: user._id }, { $set: {
    otpHash: hashOtp(user.email, otp), otpExpires: new Date(Date.now() + OTP_MINUTES * 60000), otpTries: 0, otpSentAt: new Date(),
  } });
  await sendOtpMail(user.email, otp, "verify");
  return otp;
}

// POST /auth/register { name, email, phone, password, role }
router.post("/register", wrap(async (req, res) => {
  const b = req.body || {};
  const data = { name: str(b.name), email: normEmail(b.email), phone: str(b.phone), password: typeof b.password === "string" ? b.password : "" };
  const errs = validateRegistration(data);
  if (Object.keys(errs).length) throw new AppError(400, firstError(errs), "VALIDATION", { errors: errs });
  const role = b.role === "Organizer" ? "Organizer" : "Attendee"; // Admin can never be self-registered

  const existing = await User.findOne({ email: data.email });
  if (existing?.verified) throw new AppError(409, "An account with this email already exists.", "EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(data.password, 12);
  let user;
  if (existing) {
    // Never verified: let the person start over (new details, new code) instead of locking the email forever.
    user = await User.findByIdAndUpdate(existing._id, { $set: { name: data.name, phone: data.phone, passwordHash, role, active: true } }, { new: true });
  } else {
    try { user = await User.create({ name: data.name, email: data.email, phone: data.phone, passwordHash, role }); }
    catch (e) { if (e.code === 11000) throw new AppError(409, "An account with this email already exists.", "EMAIL_TAKEN"); throw e; }
  }
  const otp = await issueVerificationCode(user);
  res.status(201).json({ email: user.email, ...devOtp(otp) });
}));

// POST /auth/verify-otp { email, otp }
router.post("/verify-otp", wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  const otp = str(req.body?.otp);
  const bad = () => new AppError(400, "Incorrect code. Please try again.", "BAD_CODE");
  const user = await User.findOne({ email });
  if (!user || !user.otpHash) throw bad();
  if (user.otpTries >= OTP_MAX_TRIES) throw new AppError(429, "Too many wrong attempts. Please request a new code.", "TOO_MANY_TRIES");
  if (!user.otpExpires || user.otpExpires < new Date()) throw new AppError(400, "This code has expired. Please request a new one.", "EXPIRED");
  if (!otpMatches(email, otp, user.otpHash)) {
    await User.updateOne({ _id: user._id }, { $inc: { otpTries: 1 } });
    throw bad();
  }
  await User.updateOne({ _id: user._id }, { $set: { verified: true }, $unset: { otpHash: 1, otpExpires: 1, otpSentAt: 1 } });
  res.json({ message: "Email verified." });
}));

// POST /auth/resend-otp { email }  (same reply whether or not the account exists)
router.post("/resend-otp", wrap(async (req, res) => {
  const user = await User.findOne({ email: normEmail(req.body?.email) });
  if (!user || user.verified) return res.json({});
  if (fresh(user, "otp")) throw new AppError(429, "Please wait a few seconds before asking for another code.", "COOLDOWN");
  res.json(devOtp(await issueVerificationCode(user)));
}));

// POST /auth/login { email, password } -> { token, user }
router.post("/login", wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password.", "BAD_CREDENTIALS");
  if (!user.verified) {
    // Send a fresh code so the verify page has something to type (ignore failures; they can press "resend").
    const otp = fresh(user, "otp") ? null : await issueVerificationCode(user).catch(() => null);
    throw new AppError(403, "Please verify your email first.", "NOT_VERIFIED", otp ? devOtp(otp) : undefined);
  }
  if (!user.active) throw new AppError(403, "This account has been deactivated. Contact an administrator.", "DEACTIVATED");
  res.json({ token: signToken(user), user: publicUser(user) });
}));

// POST /auth/forgot-password { email }  (always 200: never reveals whether the email has an account)
router.post("/forgot-password", wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  const user = await User.findOne({ email, verified: true, active: true });
  if (!user || fresh(user, "reset")) return res.json({});
  const otp = generateOtp();
  await User.updateOne({ _id: user._id }, { $set: { resetHash: hashOtp(email, otp), resetExpires: new Date(Date.now() + OTP_MINUTES * 60000), resetTries: 0, resetSentAt: new Date() } });
  await sendOtpMail(email, otp, "reset");
  res.json(devOtp(otp));
}));

// POST /auth/reset-password { email, otp, newPassword }
router.post("/reset-password", wrap(async (req, res) => {
  const email = normEmail(req.body?.email);
  const otp = str(req.body?.otp);
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const bad = () => new AppError(400, "That code is incorrect or has expired. Request a new one.", "BAD_CODE");
  const user = await User.findOne({ email });
  if (!user || !user.resetHash) throw bad();
  if (!user.resetExpires || user.resetExpires < new Date() || user.resetTries >= OTP_MAX_TRIES) {
    await User.updateOne({ _id: user._id }, { $unset: { resetHash: 1, resetExpires: 1 } });
    throw bad();
  }
  if (!otpMatches(email, otp, user.resetHash)) {
    await User.updateOne({ _id: user._id }, { $inc: { resetTries: 1 } });
    throw bad();
  }
  const errs = validatePasswordChange({ current: "x", next: newPassword });
  if (errs.next) throw new AppError(400, errs.next, "VALIDATION");
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12) }, $unset: { resetHash: 1, resetExpires: 1, resetSentAt: 1 } });
  res.json({ message: "Password reset." });
}));

export default router;
