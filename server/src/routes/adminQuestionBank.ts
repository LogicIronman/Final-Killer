import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  applyQuestionBankPreview,
  createQuestionBankPreview,
  getQuestionBankStatus,
  listQuestionBankVersions,
  QuestionBankManagementError,
  rollbackQuestionBankVersion
} from "../services/adminQuestionBank.js";

const router = Router();
router.use(requireAdmin);

const previewSchema = z.object({
  mode: z.enum(["create", "update"]).default("update"),
  quizBankId: z.number().int().positive().optional(),
  bankName: z.string().trim().min(1).max(100).optional(),
  sourceFileName: z.string().trim().min(1).max(255),
  questions: z.unknown()
});
const previewIdSchema = z.object({ previewId: z.string().uuid() });
const versionIdSchema = z.coerce.number().int().positive();

router.get("/", async (_req, res) => {
  const db = await getDb();
  return sendOk(res, {
    ...(await getQuestionBankStatus(db)),
    versions: await listQuestionBankVersions(db)
  });
});

router.post("/preview", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", "请选择有效的 JSON 题库文件");
  }
  try {
    const preview = await createQuestionBankPreview(await getDb(), {
      questions: parsed.data.questions,
      mode: parsed.data.mode,
      quizBankId: parsed.data.quizBankId,
      bankName: parsed.data.bankName,
      sourceFileName: parsed.data.sourceFileName,
      createdBy: req.user!.id
    });
    return sendOk(res, { preview }, 201);
  } catch (error) {
    return handleManagementError(res, error, "题库校验失败");
  }
});

router.post("/import", async (req, res) => {
  const parsed = previewIdSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", "导入预览 ID 不正确");
  }
  try {
    const result = await applyQuestionBankPreview(
      await getDb(),
      parsed.data.previewId,
      req.user!.id
    );
    return sendOk(res, result);
  } catch (error) {
    return handleManagementError(res, error, "题库导入失败");
  }
});

router.post("/versions/:id/rollback", async (req, res) => {
  const parsedId = versionIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "题库版本 ID 不正确");
  }
  try {
    const result = await rollbackQuestionBankVersion(
      await getDb(),
      parsedId.data,
      req.user!.id
    );
    return sendOk(res, result);
  } catch (error) {
    return handleManagementError(res, error, "题库回滚失败");
  }
});

function handleManagementError(
  res: Parameters<typeof sendError>[0],
  error: unknown,
  fallback: string
) {
  if (error instanceof QuestionBankManagementError) {
    return sendError(res, error.code, error.message, error.status);
  }
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    const location = issue?.path.length ? `（${issue.path.join(".")}）` : "";
    return sendError(res, "QUESTION_BANK_INVALID", `${issue?.message ?? fallback}${location}`);
  }
  return sendError(res, "QUESTION_BANK_ERROR", error instanceof Error ? error.message : fallback);
}

export default router;
