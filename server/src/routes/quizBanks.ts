import { Router } from "express";
import { getDb } from "../db.js";
import { sendOk } from "../lib/api.js";
import { getQuizBanks } from "../services/questionBank.js";

const router = Router();

router.get("/", async (_req, res) => {
  return sendOk(res, { banks: await getQuizBanks(await getDb()) });
});

export default router;
