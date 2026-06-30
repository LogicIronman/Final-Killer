import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import {
  answerQuestion,
  getChapterStats,
  getCompletedQuestions,
  getMarkedQuestions,
  getStats,
  getWrongAnswers,
  markQuestion,
  resetQuestionProgress
} from "../services/progress.js";

const router = Router();

const essayAnswerSchema = z.object({
  questionId: z.string().min(1),
  quizBankId: z.number().int().positive().optional(),
  answer: z.string(),
  mode: z.enum(["new", "review"]).default("new")
});

const markSchema = z.object({
  questionId: z.string().min(1),
  quizBankId: z.number().int().positive().optional(),
  isMarked: z.boolean()
});

const resetSchema = z.object({
  questionId: z.string().min(1),
  quizBankId: z.number().int().positive().optional()
});

router.get("/stats", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(res, await getStats(await getDb(), req.user!.id, quizBankId));
});

router.get("/chapter-stats", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(res, { chapters: await getChapterStats(await getDb(), req.user!.id, quizBankId) });
});

router.get("/wrong-answers", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(res, { questions: await getWrongAnswers(await getDb(), req.user!.id, quizBankId) });
});

router.get("/marked", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(res, { questions: await getMarkedQuestions(await getDb(), req.user!.id, quizBankId) });
});

router.get("/completed", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  return sendOk(res, { questions: await getCompletedQuestions(await getDb(), req.user!.id, quizBankId) });
});

router.post("/answer", requireAuth, async (req, res) => {
  const parsed = essayAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    const result = await answerQuestion(await getDb(), {
      userId: req.user!.id,
      questionId: parsed.data.questionId,
      quizBankId: parsed.data.quizBankId,
      answer: parsed.data.answer,
      mode: parsed.data.mode
    });
    return sendOk(res, result);
  } catch (error) {
    return sendError(res, "ANSWER_FAILED", error instanceof Error ? error.message : "提交失败");
  }
});

router.post("/mark", requireAuth, async (req, res) => {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    return sendOk(
      res,
      await markQuestion(await getDb(), {
        userId: req.user!.id,
        questionId: parsed.data.questionId,
        quizBankId: parsed.data.quizBankId,
        isMarked: parsed.data.isMarked
      })
    );
  } catch (error) {
    return sendError(res, "MARK_FAILED", error instanceof Error ? error.message : "标记失败");
  }
});

router.post("/reset", requireAuth, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  return sendOk(
    res,
    await resetQuestionProgress(
      await getDb(),
      req.user!.id,
      parsed.data.questionId,
      parsed.data.quizBankId
    )
  );
});

export default router;
