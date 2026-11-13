import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { wrap, AppError } from "../utils/http.js";
import { askEventAssistant, describeEvent } from "../services/ai.js";
import { CATEGORIES } from "../utils/validation.js";
import { str } from "../utils/http.js";

const router = Router();

router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user?._id || req.user?.email || "anon"), // per person, not per Wi-Fi address
  message: {
    message: "Too many AI requests. Please try again later.",
  },
});

router.post(
  "/chat",
  aiLimiter,
  wrap(async (req, res) => {
    const message = req.body?.message;

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 1000
    ) {
      throw new AppError(
        400,
        "Enter a message between 1 and 1000 characters.",
        "VALIDATION"
      );
    }

    const result = await askEventAssistant(message.trim(), req.body?.history);

    res.json(result);
  })
);

// POST /ai/describe { title, category, date, time, location, hint? } -> { text, ai }   (organizers and admins)
router.post(
  "/describe",
  requireRole("Organizer", "Admin"),
  aiLimiter,
  wrap(async (req, res) => {
    const b = req.body || {};
    const f = { title: str(b.title), category: str(b.category), date: str(b.date), time: str(b.time), location: str(b.location), hint: str(b.hint).slice(0, 200) };
    if (f.title.length < 3 || f.title.length > 80) throw new AppError(400, "Enter the event name first (3 to 80 characters).", "VALIDATION");
    if (!f.location || f.location.length > 100) throw new AppError(400, "Enter the venue first.", "VALIDATION");
    if (!CATEGORIES.includes(f.category)) throw new AppError(400, "Choose a valid category.", "VALIDATION");
    res.json(await describeEvent(f));
  })
);

export default router;