import { Router } from "express";
import { getDb } from "../db.js";
import { sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import { getNewQuestions, getQuestionDetail, getReviewQuestions } from "../services/progress.js";

const router = Router();

router.get("/new", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const questions = await getNewQuestions(await getDb(), req.user!.id, limit);
  return sendOk(res, { questions });
});

router.get("/review", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const questions = await getReviewQuestions(await getDb(), req.user!.id, limit);
  return sendOk(res, { questions });
});

router.get("/:id", requireAuth, async (req, res) => {
  return sendOk(res, await getQuestionDetail(await getDb(), req.user!.id, String(req.params.id)));
});

export default router;
