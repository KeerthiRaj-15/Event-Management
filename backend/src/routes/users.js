import { Router } from "express";
import bcrypt from "bcryptjs";
import { User, publicUser } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError, wrap, str } from "../utils/http.js";
import { validateProfile, validatePasswordChange, firstError } from "../utils/validation.js";

const router = Router();
router.use(requireAuth);

// PUT /users/me { name, phone } -> updated user
router.put("/me", wrap(async (req, res) => {
  const data = { name: str(req.body?.name), phone: str(req.body?.phone) };
  const errs = validateProfile(data);
  if (Object.keys(errs).length) throw new AppError(400, firstError(errs), "VALIDATION", { errors: errs });
  req.user.name = data.name;
  req.user.phone = data.phone;
  await req.user.save();
  res.json(publicUser(req.user));
}));

// PUT /users/me/password { currentPassword, newPassword }
router.put("/me/password", wrap(async (req, res) => {
  const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const next = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!(await bcrypt.compare(current, req.user.passwordHash))) throw new AppError(400, "Current password is incorrect.", "BAD_PASSWORD");
  const errs = validatePasswordChange({ current, next });
  if (Object.keys(errs).length) throw new AppError(400, firstError(errs), "VALIDATION", { errors: errs });
  req.user.passwordHash = await bcrypt.hash(next, 12);
  await req.user.save();
  res.json({ message: "Password updated." });
}));

export default router;
