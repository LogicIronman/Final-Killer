import { Router } from "express";
import { getDb } from "../db.js";
import { sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getEssayQuestions,
  getExamQuestions,
  getNewQuestions,
  getQuestionDetail,
  getReviewQuestions
} from "../services/progress.js";

const router = Router();

router.get("/new", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  const includeEssay = req.query.includeEssay === "1" || req.query.includeEssay === "true";
  const questions = await getNewQuestions(await getDb(), req.user!.id, limit, {
    quizBankId,
    includeEssay
  });
  return sendOk(res, { questions });
});

router.get("/review", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  const includeEssay = req.query.includeEssay === "1" || req.query.includeEssay === "true";
  const questions = await getReviewQuestions(await getDb(), req.user!.id, limit, {
    quizBankId,
    includeEssay
  });
  return sendOk(res, { questions });
});

router.get("/exam", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  const includeEssay = req.query.includeEssay === "1" || req.query.includeEssay === "true";
  const questions = await getExamQuestions(await getDb(), req.user!.id, {
    quizBankId,
    includeEssay
  });
  return sendOk(res, { questions });
});

router.get("/essay-drill", requireAuth, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  const questions = await getEssayQuestions(await getDb(), req.user!.id, limit, { quizBankId });
  return sendOk(res, { questions });
});

router.get("/:id", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(
    res,
    await getQuestionDetail(await getDb(), req.user!.id, String(req.params.id), quizBankId)
  );
});

export default router;
