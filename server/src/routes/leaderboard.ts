import { Router } from "express";
import { getDb } from "../db.js";
import { sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import { getLeaderboard } from "../services/leaderboard.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  return sendOk(res, { entries: await getLeaderboard(await getDb(), req.user!.id) });
});

export default router;

