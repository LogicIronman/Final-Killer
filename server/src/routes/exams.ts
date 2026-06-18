import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAdmin } from "../middleware/auth.js";
import {
  createExamSchedule,
  deleteExamSchedule,
  getExamSchedules,
  updateExamSchedule
} from "../services/exams.js";

const router = Router();

const examSchema = z.object({
  courseName: z.string().trim().min(1, "请输入课程名").max(80, "课程名不能超过 80 个字符"),
  examAt: z.string().datetime({ offset: true, message: "考试时间格式不正确" })
});
const examIdSchema = z.coerce.number().int().positive();

router.get("/", async (_req, res) => {
  return sendOk(res, { exams: await getExamSchedules(await getDb()) });
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }
  const exam = await createExamSchedule(await getDb(), {
    ...parsed.data,
    createdBy: req.user!.id
  });
  return sendOk(res, { exam }, 201);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsedId = examIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "考试日程 ID 不正确");
  }
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }
  try {
    const exam = await updateExamSchedule(await getDb(), {
      id: parsedId.data,
      ...parsed.data
    });
    return sendOk(res, { exam });
  } catch (error) {
    return sendError(res, "EXAM_NOT_FOUND", error instanceof Error ? error.message : "更新失败", 404);
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const parsedId = examIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return sendError(res, "VALIDATION_ERROR", "考试日程 ID 不正确");
  }
  try {
    return sendOk(res, await deleteExamSchedule(await getDb(), parsedId.data));
  } catch (error) {
    return sendError(res, "EXAM_NOT_FOUND", error instanceof Error ? error.message : "删除失败", 404);
  }
});

export default router;
