import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { wrap, AppError } from "../utils/http.js";
import { askEventAssistant } from "../services/ai.js";

const router = Router();

router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
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

    const result = await askEventAssistant(message.trim());

    res.json(result);
  })
);

export default router;