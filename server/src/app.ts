import path from "node:path";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { migrate, getDb } from "./db.js";
import { sendError } from "./lib/api.js";
import authRouter from "./routes/auth.js";
import examsRouter from "./routes/exams.js";
import leaderboardRouter from "./routes/leaderboard.js";
import progressRouter from "./routes/progress.js";
import questionsRouter from "./routes/questions.js";
import adminQuestionBankRouter from "./routes/adminQuestionBank.js";
import { ensureQuestionBank } from "./services/questionBank.js";
import { ensureAdminUser } from "./services/auth.js";

export async function createApp() {
  const db = await getDb();
  await migrate(db);
  await ensureAdminUser(db);
  await ensureQuestionBank(db, config.questionBankPath);

  const app = express();
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { status: "ready" }, error: null });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/admin/question-bank", adminQuestionBankRouter);
  app.use("/api/exams", examsRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/questions", questionsRouter);
  app.use("/api/progress", progressRouter);

  const clientDist = path.resolve(config.rootDir, "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return sendError(res, "NOT_FOUND", "接口不存在", 404);
    }
    return res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) next();
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    return sendError(res, "INTERNAL_ERROR", "服务器错误", 500);
  });

  return app;
}
