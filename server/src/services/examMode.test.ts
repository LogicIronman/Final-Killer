import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import { getExamQuestions } from "./progress.js";
import type { QuestionType } from "../types.js";

async function setupDb() {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-exam-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, username, password_hash, created_at)
     VALUES (1, 'alice', 'hash', ?)` ,
    now
  );
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (1, 'Exam bank', 40, ?, ?)`,
    now,
    now
  );

  for (const [type, count] of [
    ["single", 22],
    ["judge", 12],
    ["multiple", 7],
    ["essay", 3]
  ] as Array<[QuestionType, number]>) {
    for (let index = 1; index <= count; index += 1) {
      await db.run(
        `INSERT INTO questions
         (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
         VALUES (?, 1, ?, ?, ?, '测试章', ?, NULL)`,
        `${type}-${index}`,
        `${type} question ${index}`,
        type === "essay" ? "{}" : '{"A":"一","B":"二","C":"三","D":"四"}',
        type === "judge" ? "A" : type === "multiple" ? "AB" : "A",
        type
      );
    }
  }
  return db;
}

test("exam mode builds ordered sections with configured counts", async () => {
  const db = await setupDb();
  const questions = await getExamQuestions(db, 1, {
    quizBankId: 1,
    includeEssay: true
  });

  assert.equal(questions.length, 37);
  assert.deepEqual(typeCounts(questions), {
    single: 20,
    judge: 10,
    multiple: 5,
    essay: 2
  });
  assert.deepEqual(questions.slice(0, 20).map((question) => question.type), Array(20).fill("single"));
  assert.deepEqual(questions.slice(20, 30).map((question) => question.type), Array(10).fill("judge"));
  assert.deepEqual(questions.slice(30, 35).map((question) => question.type), Array(5).fill("multiple"));
  assert.deepEqual(questions.slice(35).map((question) => question.type), Array(2).fill("essay"));
  await db.close();
});

test("exam mode omits essay questions when disabled", async () => {
  const db = await setupDb();
  const questions = await getExamQuestions(db, 1, {
    quizBankId: 1,
    includeEssay: false
  });

  assert.equal(questions.length, 35);
  assert.equal(questions.some((question) => question.type === "essay"), false);
  await db.close();
});

function typeCounts(questions: Awaited<ReturnType<typeof getExamQuestions>>) {
  return questions.reduce(
    (counts, question) => {
      counts[question.type] += 1;
      return counts;
    },
    { single: 0, judge: 0, multiple: 0, essay: 0 } as Record<QuestionType, number>
  );
}
