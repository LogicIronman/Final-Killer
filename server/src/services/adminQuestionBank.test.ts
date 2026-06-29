import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import {
  applyQuestionBankPreview,
  createQuestionBankPreview,
  listQuestionBankVersions,
  rollbackQuestionBankVersion
} from "./adminQuestionBank.js";

async function setupDb() {
  const db = await openDb(
    path.join(os.tmpdir(), `final-killer-bank-admin-${Date.now()}-${Math.random()}.db`)
  );
  await migrate(db);
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     VALUES (1, 'admin', 'hash', 'admin', ?), (2, 'alice', 'hash', 'user', ?)`,
    now,
    now
  );
  await db.run(
    `INSERT INTO quiz_banks (id, name, description, question_count, created_at, updated_at)
     VALUES (1, '旧题库', '测试题库', 3, ?, ?)`,
    now,
    now
  );
  await db.run(
    `INSERT INTO questions
     (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES
       ('q1', 1, '保持不变', '{"A":"是","B":"否"}', 'A', '第一章', 'single', '旧解析'),
       ('q2', 1, '即将修改', '{"A":"旧","B":"新"}', 'A', '第一章', 'single', NULL),
       ('q-old', 1, '即将删除', '{"A":"是","B":"否"}', 'A', '第二章', 'single', NULL)`
  );
  await db.run(
    `INSERT INTO user_progress
     (user_id, quiz_bank_id, question_id, status, total_attempts, correct_count, wrong_count)
     VALUES (2, 1, 'q1', 'done', 1, 1, 0), (2, 1, 'q2', 'reviewing', 2, 1, 1)`
  );
  await db.run(
    `INSERT INTO daily_logs
     (user_id, quiz_bank_id, date, new_questions_count, review_questions_count, correct_count, wrong_count)
     VALUES (2, 1, '2026-06-18', 2, 0, 1, 1)`
  );
  return db;
}

const incoming = [
  {
    id: "q1",
    question: "保持不变",
    options: { A: "是", B: "否" },
    correctAnswer: "A",
    chapter: "第一章",
    type: "single" as const,
    explanation: "旧解析"
  },
  {
    id: "q2",
    question: "已经修改",
    options: { A: "旧", B: "新" },
    correctAnswer: "B",
    chapter: "第一章",
    type: "single" as const
  },
  {
    id: "q3",
    question: "新增题目",
    options: { A: "是", B: "否" },
    correctAnswer: "A",
    chapter: "第三章",
    type: "single" as const
  }
];

test("question bank preview validates and reports exact differences", async () => {
  const db = await setupDb();
  const preview = await createQuestionBankPreview(db, {
    questions: incoming,
    bankName: "新题库",
    sourceFileName: "questions-v2.json",
    createdBy: 1
  });

  assert.equal(preview.currentCount, 3);
  assert.equal(preview.nextCount, 3);
  assert.deepEqual(preview.addedIds, ["q3"]);
  assert.deepEqual(preview.updatedIds, ["q2"]);
  assert.deepEqual(preview.removedIds, ["q-old"]);
  assert.equal(preview.unchangedCount, 1);

  await assert.rejects(
    () => createQuestionBankPreview(db, {
      questions: [incoming[0], incoming[0]],
      sourceFileName: "invalid.json",
      createdBy: 1
    }),
    /id 重复/
  );
  await db.close();
});

test("creating a new question bank allows reused source question ids", async () => {
  const db = await setupDb();
  const preview = await createQuestionBankPreview(db, {
    mode: "create",
    questions: [
      {
        id: "q1",
        question: "新科目同名编号",
        options: { A: "是", B: "否" },
        correctAnswer: "A",
        chapter: "第一章",
        type: "single" as const
      }
    ],
    bankName: "新科目",
    sourceFileName: "new-bank.json",
    createdBy: 1
  });

  const imported = await applyQuestionBankPreview(db, preview.previewId, 1);

  assert.equal(imported.bankName, "新科目");
  assert.equal(imported.questionCount, 1);
  assert.equal((await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM quiz_banks"))?.count, 2);
  assert.equal(
    (await db.get<{ count: number }>("SELECT COUNT(*) AS count FROM questions WHERE id = 'q1'"))?.count,
    2
  );
  await db.close();
});

test("import preserves unchanged progress, snapshots old state, and rollback restores it", async () => {
  const db = await setupDb();
  const preview = await createQuestionBankPreview(db, {
    questions: incoming,
    bankName: "新题库",
    sourceFileName: "questions-v2.json",
    createdBy: 1
  });
  const imported = await applyQuestionBankPreview(db, preview.previewId, 1);

  assert.equal(imported.questionCount, 3);
  assert.equal((await db.get<{ question: string }>("SELECT question FROM questions WHERE id = 'q2'"))?.question, "已经修改");
  assert.equal(await db.get("SELECT 1 FROM questions WHERE id = 'q-old'"), undefined);
  assert.ok(await db.get("SELECT 1 FROM user_progress WHERE question_id = 'q1'"));
  assert.ok(await db.get("SELECT 1 FROM user_progress WHERE question_id = 'q2'"));
  assert.equal((await listQuestionBankVersions(db)).length, 1);

  const rolledBack = await rollbackQuestionBankVersion(db, imported.versionId, 1);
  assert.equal(rolledBack.questionCount, 3);
  assert.equal((await db.get<{ name: string }>("SELECT name FROM quiz_banks WHERE id = 1"))?.name, "旧题库");
  assert.equal((await db.get<{ question: string }>("SELECT question FROM questions WHERE id = 'q2'"))?.question, "即将修改");
  assert.ok(await db.get("SELECT 1 FROM questions WHERE id = 'q-old'"));
  assert.ok(await db.get("SELECT 1 FROM user_progress WHERE question_id = 'q2'"));
  assert.ok(await db.get("SELECT 1 FROM daily_logs WHERE date = '2026-06-18'"));
  assert.equal((await listQuestionBankVersions(db)).length, 2);
  await db.close();
});

test("an import preview cannot be applied after the active bank changes", async () => {
  const db = await setupDb();
  const preview = await createQuestionBankPreview(db, {
    questions: incoming,
    sourceFileName: "questions-v2.json",
    createdBy: 1
  });
  await db.run("UPDATE quiz_banks SET updated_at = ? WHERE id = 1", new Date(Date.now() + 1000).toISOString());
  await assert.rejects(() => applyQuestionBankPreview(db, preview.previewId, 1), /重新上传/);
  await db.close();
});
