import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import {
  answerExamAttemptQuestion,
  getCurrentExamAttempt,
  getExamAttempt,
  getExamAttemptRecords,
  startExamAttempt,
  submitExamAttempt
} from "../services/examAttempts.js";

const router = Router();

const startSchema = z.object({
  quizBankId: z.number().int().positive().optional(),
  includeEssay: z.boolean().default(false)
});

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string()
});

const idSchema = z.coerce.number().int().positive();

router.post("/start", requireAuth, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    return sendOk(
      res,
      await startExamAttempt(await getDb(), {
        userId: req.user!.id,
        quizBankId: parsed.data.quizBankId,
        includeEssay: parsed.data.includeEssay
      }),
      201
    );
  } catch (error) {
    return sendError(res, "EXAM_START_FAILED", error instanceof Error ? error.message : "考试开始失败");
  }
});

router.get("/current", requireAuth, async (req, res) => {
  const quizBankId = req.query.quizBankId ? Number(req.query.quizBankId) : undefined;
  try {
    return sendOk(res, {
      attempt: await getCurrentExamAttempt(await getDb(), { userId: req.user!.id, quizBankId })
    });
  } catch (error) {
    return sendError(res, "EXAM_LOAD_FAILED", error instanceof Error ? error.message : "考试加载失败");
  }
});

router.get("/", requireAuth, async (_req, res) => {
  return sendOk(res, { records: await getExamAttemptRecords(await getDb(), { userId: _req.user!.id }) });
});

router.get("/:id", requireAuth, async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "考试记录 ID 不正确");
  }

  try {
    return sendOk(res, { attempt: await getExamAttempt(await getDb(), { userId: req.user!.id, attemptId: parsedId.data }) });
  } catch (error) {
    return sendError(res, "EXAM_LOAD_FAILED", error instanceof Error ? error.message : "考试记录加载失败");
  }
});

router.post("/:id/answer", requireAuth, async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "考试记录 ID 不正确");
  }
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    return sendOk(
      res,
      await answerExamAttemptQuestion(await getDb(), {
        userId: req.user!.id,
        attemptId: parsedId.data,
        questionId: parsed.data.questionId,
        answer: parsed.data.answer
      })
    );
  } catch (error) {
    return sendError(res, "EXAM_ANSWER_FAILED", error instanceof Error ? error.message : "答案保存失败");
  }
});

router.post("/:id/submit", requireAuth, async (req, res) => {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "考试记录 ID 不正确");
  }

  try {
    return sendOk(
      res,
      await submitExamAttempt(await getDb(), {
        userId: req.user!.id,
        attemptId: parsedId.data,
        reason: "manual"
      })
    );
  } catch (error) {
    return sendError(res, "EXAM_SUBMIT_FAILED", error instanceof Error ? error.message : "考试提交失败");
  }
});

export default router;
