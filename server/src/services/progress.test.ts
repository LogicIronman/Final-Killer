import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import {
  answerQuestion,
  getChapterStats,
  getCompletedQuestions,
  getEssayQuestions,
  getMarkedQuestions,
  getNewQuestions,
  getQuestionDetail,
  getReviewQuestions,
  getStats,
  markQuestion,
  resetQuestionProgress
} from "./progress.js";

async function setupDb() {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  await db.run(
    `INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'alice', 'hash', ?)`,
    new Date().toISOString()
  );
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (1, 'Test bank', 2, ?, ?)`,
    new Date().toISOString(),
    new Date().toISOString()
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q1', 1, 'Single?', '{"A":"One","B":"Two"}', 'A', '第一章', 'single', 'Because A')`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q2', 1, 'Multi?', '{"A":"One","B":"Two","C":"Three"}', 'AB', '第一章', 'multiple', 'Because AB')`
  );
  return db;
}

test("new questions can be scoped to a selected quiz bank", async () => {
  const db = await setupDb();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO quiz_banks (id, name, question_count, created_at, updated_at)
     VALUES (2, 'Second bank', 1, ?, ?)`,
    now,
    now
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('other-q1', 2, 'Other?', '{"A":"One","B":"Two"}', 'A', '第二章', 'single', NULL)`
  );

  const questions = await getNewQuestions(db, 1, 10, { quizBankId: 2, includeEssay: false });

  assert.deepEqual(questions.map((question) => question.id), ["other-q1"]);
  assert.equal(questions[0].quizBankId, 2);
  await db.close();
});

test("new questions can follow type groups while ordering by chapter", async () => {
  const db = await setupDb();
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('10', 1, 'Late?', '{"A":"One","B":"Two"}', 'A', '第二章', 'single', NULL)`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('3', 1, 'Early?', '{"A":"One","B":"Two"}', 'A', '第二章', 'single', NULL)`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('essay-early', 1, 'Essay?', '{}', '参考答案', '导论', 'essay', NULL)`
  );

  const ordered = await getNewQuestions(db, 1, 10, { quizBankId: 1, orderMode: "chapter" });
  assert.deepEqual(ordered.map((question) => question.id), ["q1", "3", "10", "q2"]);
  assert.equal(ordered.some((question) => question.type === "essay"), false);

  const withEssay = await getNewQuestions(db, 1, 10, { quizBankId: 1, orderMode: "chapter", includeEssay: true });
  assert.deepEqual(withEssay.map((question) => question.id), ["q1", "3", "10", "q2", "essay-early"]);

  const filtered = await getNewQuestions(db, 1, 10, { quizBankId: 1, orderMode: "chapter", chapter: "第二章" });
  assert.deepEqual(filtered.map((question) => question.id), ["3", "10"]);
  await db.close();
});

test("essay questions are hidden unless explicitly enabled and reveal answers without grading", async () => {
  const db = await setupDb();
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('essay-1', 1, '简述科学社会主义。', '{}', '参考答案', '第七章', 'essay', '解析')`
  );

  const withoutEssay = await getNewQuestions(db, 1, 10, { quizBankId: 1, includeEssay: false });
  assert.equal(withoutEssay.some((question) => question.id === "essay-1"), false);

  const withEssay = await getNewQuestions(db, 1, 10, { quizBankId: 1, includeEssay: true });
  assert.equal(withEssay.some((question) => question.id === "essay-1"), true);

  const result = await answerQuestion(db, {
    userId: 1,
    questionId: "essay-1",
    answer: "",
    mode: "new"
  });

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctAnswer, "参考答案");
  assert.equal(result.progress.status, "done");
  await db.close();
});

test("essay drill only returns essay questions", async () => {
  const db = await setupDb();
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('essay-1', 1, '简述科学社会主义。', '{}', '参考答案', '第七章', 'essay', '解析')`
  );

  const questions = await getEssayQuestions(db, 1, 10, { quizBankId: 1 });

  assert.deepEqual(questions.map((question) => question.id), ["essay-1"]);
  assert.equal(questions[0].type, "essay");
  await db.close();
});

test("new correct answer marks the question done", async () => {
  const db = await setupDb();
  const result = await answerQuestion(db, {
    userId: 1,
    questionId: "q1",
    answer: "A",
    mode: "new"
  });

  assert.equal(result.isCorrect, true);
  assert.equal(result.progress.status, "done");

  const stats = await getStats(db, 1);
  assert.equal(stats.done, 1);
  assert.equal(stats.reviewing, 0);
  await db.close();
});

test("new wrong answer moves to reviewing and writes wrong history", async () => {
  const db = await setupDb();
  const result = await answerQuestion(db, {
    userId: 1,
    questionId: "q1",
    answer: "B",
    mode: "new"
  });

  assert.equal(result.isCorrect, false);
  assert.equal(result.progress.status, "reviewing");

  const row = await db.get<{ wrong_count: number; wrong_history_json: string }>(
    "SELECT wrong_count, wrong_history_json FROM user_progress WHERE question_id = 'q1'"
  );

  assert.equal(row?.wrong_count, 1);
  assert.match(row?.wrong_history_json ?? "", /"answer":"B"/);
  await db.close();
});

test("stats counts unseen, reviewing, done, and accuracy", async () => {
  const db = await setupDb();
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "A", mode: "new" });
  await answerQuestion(db, { userId: 1, questionId: "q2", answer: "A", mode: "new" });

  const stats = await getStats(db, 1);
  assert.equal(stats.total, 2);
  assert.equal(stats.done, 1);
  assert.equal(stats.reviewing, 1);
  assert.equal(stats.unseen, 0);
  assert.equal(stats.accuracy, 50);
  await db.close();
});

test("chapter stats calculate progress and accuracy per chapter", async () => {
  const db = await setupDb();
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q0', 1, 'Intro?', '{"A":"One","B":"Two"}', 'A', '导论', 'single', NULL)`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q3', 1, 'Other?', '{"A":"One","B":"Two"}', 'A', '第二章', 'single', NULL)`
  );
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q7', 1, 'Last?', '{"A":"One","B":"Two"}', 'A', '第七章', 'single', NULL)`
  );
  await db.run("UPDATE quiz_banks SET question_count = 5 WHERE id = 1");
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "A", mode: "new" });
  await answerQuestion(db, { userId: 1, questionId: "q2", answer: "A", mode: "new" });

  const chapters = await getChapterStats(db, 1, 1);

  assert.deepEqual(chapters, [
    { chapter: "导论", total: 1, done: 0, reviewing: 0, attempts: 0, correct: 0, accuracy: 0 },
    { chapter: "第一章", total: 2, done: 1, reviewing: 1, attempts: 2, correct: 1, accuracy: 50 },
    { chapter: "第二章", total: 1, done: 0, reviewing: 0, attempts: 0, correct: 0, accuracy: 0 },
    { chapter: "第七章", total: 1, done: 0, reviewing: 0, attempts: 0, correct: 0, accuracy: 0 }
  ]);
  await db.close();
});

test("marking an unanswered question keeps it in the new-question pool", async () => {
  const db = await setupDb();
  await markQuestion(db, { userId: 1, questionId: "q1", isMarked: true });

  const marked = await getMarkedQuestions(db, 1);
  const newQuestions = await getNewQuestions(db, 1, 10);

  assert.deepEqual(marked.map((question) => question.id), ["q1"]);
  assert.equal(marked[0].isMarked, true);
  assert.equal(newQuestions.some((question) => question.id === "q1"), true);
  await db.close();
});

test("review questions can follow chapter mode and filter a chapter", async () => {
  const db = await setupDb();
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "B", mode: "new" });
  await answerQuestion(db, { userId: 1, questionId: "q2", answer: "C", mode: "new" });
  await db.run(
    `INSERT INTO questions (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES ('q3', 1, 'Other?', '{"A":"One","B":"Two"}', 'A', '第二章', 'single', NULL)`
  );
  await answerQuestion(db, { userId: 1, questionId: "q3", answer: "B", mode: "new" });

  const questions = await getReviewQuestions(db, 1, 10, { orderMode: "chapter" });
  assert.deepEqual(questions.map((question) => question.id), ["q1", "q3", "q2"]);

  const filtered = await getReviewQuestions(db, 1, 10, { orderMode: "chapter", chapter: "第二章" });
  assert.deepEqual(filtered.map((question) => question.id), ["q3"]);
  await db.close();
});

test("two consecutive correct review answers mark a question done", async () => {
  const db = await setupDb();
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "B", mode: "new" });

  const first = await answerQuestion(db, { userId: 1, questionId: "q1", answer: "A", mode: "review" });
  const second = await answerQuestion(db, { userId: 1, questionId: "q1", answer: "A", mode: "review" });

  assert.equal(first.progress.status, "reviewing");
  assert.equal(first.progress.consecutiveCorrect, 1);
  assert.equal(second.progress.status, "done");
  assert.equal(second.progress.consecutiveCorrect, 2);
  assert.deepEqual((await getCompletedQuestions(db, 1)).map((question) => question.id), ["q1"]);
  await db.close();
});

test("a wrong review answer resets the consecutive correct count", async () => {
  const db = await setupDb();
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "B", mode: "new" });
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "A", mode: "review" });

  const result = await answerQuestion(db, {
    userId: 1,
    questionId: "q1",
    answer: "B",
    mode: "review"
  });

  assert.equal(result.progress.status, "reviewing");
  assert.equal(result.progress.consecutiveCorrect, 0);
  await db.close();
});

test("question detail exposes history and reset returns it to unseen", async () => {
  const db = await setupDb();
  await answerQuestion(db, { userId: 1, questionId: "q1", answer: "B", mode: "new" });

  const detail = await getQuestionDetail(db, 1, "q1");
  assert.equal(detail.question.correctAnswer, "A");
  assert.equal(detail.progress?.wrongCount, 1);
  assert.equal(detail.progress?.wrongHistory.length, 1);

  const reset = await resetQuestionProgress(db, 1, "q1");
  assert.equal(reset.reset, true);
  assert.equal((await getQuestionDetail(db, 1, "q1")).progress, null);
  assert.equal((await getNewQuestions(db, 1, 10)).some((question) => question.id === "q1"), true);
  await db.close();
});
