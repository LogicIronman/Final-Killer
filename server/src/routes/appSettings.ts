import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { sendError, sendOk } from "../lib/api.js";
import { requireAdmin } from "../middleware/auth.js";
import { getPublicAppSettings, updateTopGameLink } from "../services/appSettings.js";

const router = Router();

const topGameLinkSchema = z.object({
  topGameLink: z.string().max(500)
});

router.get("/public", async (_req, res) => {
  return sendOk(res, await getPublicAppSettings(await getDb()));
});

router.put("/top-game-link", requireAdmin, async (req, res) => {
  const parsed = topGameLinkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "输入不合法");
  }
  try {
    return sendOk(res, await updateTopGameLink(await getDb(), parsed.data.topGameLink));
  } catch (error) {
    return sendError(res, "VALIDATION_ERROR", error instanceof Error ? error.message : "链接不合法");
  }
});

export default router;
