import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/http.js";
import { cleanQuery, searchTicketmaster } from "../services/external.js";

// `auth` can be swapped in tests; the app always uses requireAuth.
export function externalRouter(auth = requireAuth) {
  const router = Router();
  router.use(auth);
  // Per person, not per address: a whole college behind one Wi-Fi must not share one limit.
  router.use(rateLimit({
    windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id || req.user?.email || "anon"),
    message: { message: "Too many searches. Please wait a minute.", code: "RATE_LIMITED" },
  }));

  // GET /external/events?q=&city=&from=YYYY-MM-DD&page=0 -> { events: [...], hasMore }
  router.get("/events", wrap(async (req, res) => {
    res.json(await searchTicketmaster(cleanQuery(req.query)));
  }));
  return router;
}

export default externalRouter();
