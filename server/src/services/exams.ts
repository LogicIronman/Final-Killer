import type { AppDb } from "../db.js";

export type ExamSchedule = {
  id: number;
  courseName: string;
  examAt: string;
  createdAt: string;
  updatedAt: string;
};

type ExamRow = {
  id: number;
  course_name: string;
  exam_at: string;
  created_at: string;
  updated_at: string;
};

export async function getExamSchedules(db: AppDb) {
  const rows = await db.all<ExamRow[]>(
    "SELECT id, course_name, exam_at, created_at, updated_at FROM exam_schedules ORDER BY exam_at ASC, id ASC"
  );
  return rows.map(toExamSchedule);
}

export async function createExamSchedule(
  db: AppDb,
  params: { courseName: string; examAt: string; createdBy: number }
) {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO exam_schedules (course_name, exam_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    params.courseName.trim(),
    params.examAt,
    params.createdBy,
    now,
    now
  );
  return getExamSchedule(db, result.lastID!);
}

export async function updateExamSchedule(
  db: AppDb,
  params: { id: number; courseName: string; examAt: string }
) {
  const result = await db.run(
    "UPDATE exam_schedules SET course_name = ?, exam_at = ?, updated_at = ? WHERE id = ?",
    params.courseName.trim(),
    params.examAt,
    new Date().toISOString(),
    params.id
  );
  if (!result.changes) throw new Error("考试日程不存在");
  return getExamSchedule(db, params.id);
}

export async function deleteExamSchedule(db: AppDb, id: number) {
  const result = await db.run("DELETE FROM exam_schedules WHERE id = ?", id);
  if (!result.changes) throw new Error("考试日程不存在");
  return { id, deleted: true };
}

async function getExamSchedule(db: AppDb, id: number) {
  const row = await db.get<ExamRow>(
    "SELECT id, course_name, exam_at, created_at, updated_at FROM exam_schedules WHERE id = ?",
    id
  );
  if (!row) throw new Error("考试日程不存在");
  return toExamSchedule(row);
}

function toExamSchedule(row: ExamRow): ExamSchedule {
  return {
    id: row.id,
    courseName: row.course_name,
    examAt: row.exam_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
