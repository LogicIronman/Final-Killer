import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrate, openDb } from "../db.js";
import {
  createExamSchedule,
  deleteExamSchedule,
  getExamSchedules,
  updateExamSchedule
} from "./exams.js";

test("exam schedules support default seed and administrator CRUD", async () => {
  const db = await openDb(path.join(os.tmpdir(), `final-killer-exams-${Date.now()}-${Math.random()}.db`));
  await migrate(db);
  await db.run(
    `INSERT INTO users (id, username, password_hash, role, created_at)
     VALUES (1, 'admin', 'hash', 'admin', ?)`,
    new Date().toISOString()
  );

  const seeded = await getExamSchedules(db);
  assert.equal(seeded.length, 1);
  assert.equal(seeded[0].courseName, "马克思主义基本原理");

  const created = await createExamSchedule(db, {
    courseName: "大学英语",
    examAt: "2026-07-05T01:00:00.000Z",
    createdBy: 1
  });
  assert.equal(created.courseName, "大学英语");

  const earlier = await createExamSchedule(db, {
    courseName: "计算机基础",
    examAt: "2026-06-30T01:00:00.000Z",
    createdBy: 1
  });
  assert.deepEqual(
    (await getExamSchedules(db)).map((exam) => exam.courseName),
    ["计算机基础", "马克思主义基本原理", "大学英语"]
  );

  const updated = await updateExamSchedule(db, {
    id: created.id,
    courseName: "大学英语 A",
    examAt: "2026-07-06T01:00:00.000Z"
  });
  assert.equal(updated.courseName, "大学英语 A");

  const deleted = await deleteExamSchedule(db, created.id);
  assert.equal(deleted.deleted, true);
  await assert.rejects(() => deleteExamSchedule(db, created.id), /考试日程不存在/);
  await deleteExamSchedule(db, earlier.id);
  assert.equal((await getExamSchedules(db)).length, 1);
  await db.close();
});
