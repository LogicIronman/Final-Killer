import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAuth } from "../middleware/auth.js";
import { loginUser, registerUser } from "../services/auth.js";

const router = Router();

const credentialsSchema = z.object({
  username: z.string().trim().min(3, "用户名长度必须为 3-20").max(20, "用户名长度必须为 3-20"),
  password: z.string().min(6, "密码至少需要 6 位")
});

router.post("/register", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    const result = await registerUser(await getDb(), parsed.data.username, parsed.data.password);
    return sendOk(res, result, 201);
  } catch (error) {
    return sendError(res, "REGISTER_FAILED", error instanceof Error ? error.message : "注册失败");
  }
});

router.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }

  try {
    const result = await loginUser(await getDb(), parsed.data.username, parsed.data.password);
    return sendOk(res, result);
  } catch (error) {
    return sendError(res, "LOGIN_FAILED", error instanceof Error ? error.message : "登录失败", 401);
  }
});

router.get("/me", requireAuth, (req, res) => {
  return sendOk(res, { user: req.user });
});

export default router;
