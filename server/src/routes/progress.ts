import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import {
  answerQuestion,
  getCompletedQuestions,
  getMarkedQuestions,
  getStats,
  getWrongAnswers,
  markQuestion,
  resetQuestionProgress
} from "../services/progress.js";

const router = Router();

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1),
  mode: z.enum(["new", "review"]).default("new")
});

const markSchema = z.object({
  questionId: z.string().min(1),
  isMarked: z.boolean()
});

const resetSchema = z.object({
  questionId: z.string().min(1)
});

router.get("/stats", requireAuth, async (req, res) => {
  return sendOk(res, await getStats(await getDb(), req.user!.id));
});

router.get("/wrong-answers", requireAuth, async (req, res) => {
  return sendOk(res, { questions: await getWrongAnswers(await getDb(), req.user!.id) });
});

router.get("/marked", requireAuth, async (req, res) => {
  return sendOk(res, { questions: await getMarkedQuestions(await getDb(), req.user!.id) });
});

router.get("/completed", requireAuth, async (req, res) => {
  return sendOk(res, { questions: await getCompletedQuestions(await getDb(), req.user!.id) });
});

router.post("/answer", requireAuth, async (req, res) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    const result = await answerQuestion(await getDb(), {
      userId: req.user!.id,
      questionId: parsed.data.questionId,
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
    await resetQuestionProgress(await getDb(), req.user!.id, parsed.data.questionId)
  );
});

export default router;
