import fs from "node:fs/promises";
import { z } from "zod";
import type { AppDb } from "../db.js";
import type { PublicQuestion, QuestionInput, QuestionRow, QuestionType } from "../types.js";

const questionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.record(z.string().min(1)),
  correctAnswer: z.string().min(1),
  chapter: z.string().optional(),
  type: z.enum(["single", "multiple", "judge"]),
  explanation: z.string().optional()
});

const bankSchema = z.array(questionSchema);

export function parseQuestionBank(input: unknown): QuestionInput[] {
  const parsed = bankSchema.parse(input) as QuestionInput[];
  validateQuestions(parsed);
  return parsed;
}

export function toPublicQuestion(row: QuestionRow): PublicQuestion {
  const question: PublicQuestion = {
    id: row.id,
    quizBankId: row.quiz_bank_id,
    question: row.question,
    options: JSON.parse(row.options_json) as Record<string, string>,
    chapter: row.chapter,
    type: row.type,
    explanation: row.explanation,
    isMarked: Boolean(row.is_marked)
  };

  if (row.consecutive_correct != null && row.wrong_count != null) {
    question.reviewProgress = {
      consecutiveCorrect: Number(row.consecutive_correct),
      wrongCount: Number(row.wrong_count)
    };
  }

  return question;
}

export async function importQuestionBank(
  db: AppDb,
  jsonPath: string,
  name = "马克思主义基本原理"
) {
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = parseQuestionBank(JSON.parse(raw));

  const now = new Date().toISOString();
  await db.exec("BEGIN TRANSACTION");
  try {
    await db.run("DELETE FROM user_progress");
    await db.run("DELETE FROM daily_logs");
    await db.run("DELETE FROM questions");
    await db.run("DELETE FROM quiz_banks");

    const result = await db.run(
      `INSERT INTO quiz_banks (name, description, question_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      name,
      "期末杀手默认题库",
      parsed.length,
      now,
      now
    );

    const quizBankId = result.lastID!;
    const statement = await db.prepare(
      `INSERT INTO questions
       (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    try {
      for (const item of parsed) {
        await statement.run(
          item.id,
          quizBankId,
          item.question,
          JSON.stringify(item.options),
          item.correctAnswer,
          item.chapter ?? null,
          item.type,
          item.explanation ?? null
        );
      }
    } finally {
      await statement.finalize();
    }

    await db.exec("COMMIT");
    return { quizBankId, count: parsed.length };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function ensureQuestionBank(db: AppDb, jsonPath: string) {
  const row = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM questions");
  if (!row?.count) {
    return importQuestionBank(db, jsonPath);
  }
  const bank = await getDefaultQuizBank(db);
  return { quizBankId: bank.id, count: row.count };
}

export async function getDefaultQuizBank(db: AppDb) {
  const bank = await db.get<{
    id: number;
    name: string;
    question_count: number;
  }>("SELECT id, name, question_count FROM quiz_banks ORDER BY id LIMIT 1");

  if (!bank) {
    throw new Error("Question bank is not initialized");
  }
  return bank;
}

export async function getQuestionById(db: AppDb, questionId: string) {
  const row = await db.get<QuestionRow>("SELECT * FROM questions WHERE id = ?", questionId);
  return row ? toPublicQuestion(row) : null;
}

function validateQuestions(questions: QuestionInput[]) {
  const ids = new Set<string>();

  questions.forEach((question, index) => {
    const line = index + 1;
    if (ids.has(question.id)) {
      throw new Error(`题库第 ${line} 题 id 重复：${question.id}`);
    }
    ids.add(question.id);

    const optionKeys = Object.keys(question.options);
    if (optionKeys.length < 2) {
      throw new Error(`题库第 ${line} 题至少需要 2 个选项`);
    }

    validateAnswer(question.type, question.correctAnswer, optionKeys, line);
  });
}

function validateAnswer(
  type: QuestionType,
  answer: string,
  optionKeys: string[],
  line: number
) {
  if (type === "judge" && ["对", "错"].includes(answer.trim())) {
    return;
  }

  const valid = new Set(optionKeys.map((key) => key.toUpperCase()));
  const answers = type === "multiple" ? answer.toUpperCase().split("") : [answer.toUpperCase()];
  for (const key of answers) {
    if (!valid.has(key)) {
      throw new Error(`题库第 ${line} 题答案 ${answer} 不在选项中`);
    }
  }
}
