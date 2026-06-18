import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.resolve(rootDir, ".env") });

export const config = {
  rootDir,
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-final-killer-secret",
  adminUsername: process.env.ADMIN_USERNAME?.trim() ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  databasePath:
    process.env.DATABASE_PATH ??
    path.resolve(rootDir, "server", "data", "final-killer.db"),
  questionBankPath: path.resolve(rootDir, "data", "questions.json")
};
