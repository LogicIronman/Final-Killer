import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import type { QuestionType } from "../types.js";
import {
  answerExamAttemptQuestion,
  getCurrentExamAttempt,
  getExamAttemptRecords,
  startExamAttempt,
  submitExamAttempt
} from "./examAttempts.js";

async function setupDb() {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-exam-attempt-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, username, password_hash, created_at)
     VALUES (1, 'alice', 'hash', ?)`,
    now
  );
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (1, 'Exam bank', 44, ?, ?)`,
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
        type === "multiple" ? "AB" : "A",
        type
      );
    }
  }
  return db;
}

test("exam attempt saves in-progress answers and resumes the same paper", async () => {
  const db = await setupDb();
  const attempt = await startExamAttempt(db, { userId: 1, quizBankId: 1, includeEssay: true });

  assert.equal(attempt.status, "active");
  assert.equal(attempt.questions.length, 37);
  assert.equal(attempt.durationSeconds, 2400);

  await answerExamAttemptQuestion(db, {
    userId: 1,
    attemptId: attempt.id,
    questionId: attempt.questions[0].id,
    answer: "A"
  });

  const resumed = await getCurrentExamAttempt(db, { userId: 1, quizBankId: 1 });

  assert.equal(resumed?.id, attempt.id);
  assert.deepEqual(resumed?.questions.map((question) => question.id), attempt.questions.map((question) => question.id));
  assert.equal(resumed?.answers[attempt.questions[0].id]?.answer, "A");
  await db.close();
});

test("answering an exam question grades immediately and writes progress once", async () => {
  const db = await setupDb();
  const attempt = await startExamAttempt(db, { userId: 1, quizBankId: 1, includeEssay: true });
  const single = attempt.questions.find((question) => question.type === "single")!;

  const answered = await answerExamAttemptQuestion(db, {
    userId: 1,
    attemptId: attempt.id,
    questionId: single.id,
    answer: "B"
  });

  assert.equal(answered.answers[single.id]?.answer, "B");
  assert.equal(answered.answers[single.id]?.isCorrect, false);
  assert.equal(answered.answers[single.id]?.correctAnswer, "A");
  assert.equal(answered.answers[single.id]?.explanation, null);
  assert.match(answered.answers[single.id]?.gradedAt ?? "", /^\d{4}-/);

  await submitExamAttempt(db, { userId: 1, attemptId: attempt.id, reason: "manual" });
  const progress = await db.get<{ total_attempts: number; wrong_count: number }>(
    "SELECT total_attempts, wrong_count FROM user_progress WHERE user_id = 1 AND quiz_bank_id = 1 AND question_id = ?",
    single.id
  );

  assert.equal(progress?.total_attempts, 1);
  assert.equal(progress?.wrong_count, 1);
  await db.close();
});

test("legacy ungraded exam answers are graded once during submit", async () => {
  const db = await setupDb();
  const attempt = await startExamAttempt(db, { userId: 1, quizBankId: 1, includeEssay: false });
  const single = attempt.questions.find((question) => question.type === "single")!;
  await db.run(
    "UPDATE exam_attempts SET answers_json = ? WHERE id = ?",
    JSON.stringify({ [single.id]: { answer: "A", answeredAt: new Date().toISOString() } }),
    attempt.id
  );

  const submitted = await submitExamAttempt(db, { userId: 1, attemptId: attempt.id, reason: "manual" });
  const progress = await db.get<{ total_attempts: number; correct_count: number }>(
    "SELECT total_attempts, correct_count FROM user_progress WHERE user_id = 1 AND quiz_bank_id = 1 AND question_id = ?",
    single.id
  );

  assert.equal(submitted.answers[single.id]?.isCorrect, true);
  assert.equal(submitted.summary.score, 2);
  assert.equal(progress?.total_attempts, 1);
  assert.equal(progress?.correct_count, 1);
  await db.close();
});

test("submitted exam attempt scores objective sections and saves a record", async () => {
  const db = await setupDb();
  const attempt = await startExamAttempt(db, { userId: 1, quizBankId: 1, includeEssay: true });

  for (const question of attempt.questions) {
    const answer = question.type === "multiple" ? "AB" : question.type === "essay" ? "" : "A";
    await answerExamAttemptQuestion(db, {
      userId: 1,
      attemptId: attempt.id,
      questionId: question.id,
      answer
    });
  }

  const submitted = await submitExamAttempt(db, { userId: 1, attemptId: attempt.id, reason: "manual" });

  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.summary.score, 70);
  assert.equal(submitted.summary.totalScore, 70);
  assert.deepEqual(submitted.summary.byType.map((row) => [row.type, row.total, row.correct, row.possibleScore]), [
    ["single", 20, 20, 40],
    ["judge", 10, 10, 10],
    ["multiple", 5, 5, 20],
    ["essay", 2, 0, 0]
  ]);

  const records = await getExamAttemptRecords(db, { userId: 1 });
  assert.equal(records.length, 1);
  assert.equal(records[0].score, 70);
  assert.equal(records[0].totalScore, 70);
  await db.close();
});

test("current exam attempt auto-submits after the deadline", async () => {
  const db = await setupDb();
  const attempt = await startExamAttempt(db, { userId: 1, quizBankId: 1, includeEssay: false });
  await db.run(
    "UPDATE exam_attempts SET deadline_at = ? WHERE id = ?",
    new Date(Date.now() - 1000).toISOString(),
    attempt.id
  );

  const current = await getCurrentExamAttempt(db, { userId: 1, quizBankId: 1 });

  assert.equal(current?.status, "expired");
  assert.equal(current?.summary.score, 0);
  assert.equal(current?.summary.totalScore, 70);
  await db.close();
});
