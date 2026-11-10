import { Router } from "express";
import { User, publicUser, adminUser } from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AppError, wrap, email as normEmail } from "../utils/http.js";

const router = Router();
router.use(requireAuth, requireRole("Admin"));

// GET /admin/users
router.get("/users", wrap(async (_req, res) => {
  res.json((await User.find().sort({ createdAt: -1 })).map(adminUser));
}));

// PATCH /admin/users/:email { role?, active? }
router.patch("/users/:email", wrap(async (req, res) => {
  const email = normEmail(req.params.email);
  if (email === req.user.email) throw new AppError(400, "You cannot change your own role or status.", "SELF_CHANGE");
  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, "User not found.", "NOT_FOUND");
  const { role, active } = req.body || {};
  if (role !== undefined) {
    if (!["Attendee", "Organizer", "Admin"].includes(role)) throw new AppError(400, "Unknown role.", "VALIDATION");
    user.role = role;
  }
  if (active !== undefined) {
    if (typeof active !== "boolean") throw new AppError(400, "active must be true or false.", "VALIDATION");
    user.active = active;
  }
  await user.save();
  res.json(publicUser(user));
}));

export default router;
