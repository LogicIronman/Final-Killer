import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppDb } from "../db.js";
import type { QuestionInput, QuestionRow } from "../types.js";
import { getDefaultQuizBank, getQuizBanks, parseQuestionBank } from "./questionBank.js";

const PREVIEW_TTL_MS = 30 * 60 * 1000;
let mutationQueue: Promise<void> = Promise.resolve();

type StoredProgress = {
  user_id: number;
  status: string;
  total_attempts: number;
  correct_count: number;
  wrong_count: number;
  consecutive_correct: number;
  first_wrong_at: string | null;
  last_wrong_at: string | null;
  last_answered_at: string | null;
  is_marked: number;
  wrong_history_json: string | null;
  question_id: string;
};

type StoredDailyLog = {
  user_id: number;
  date: string;
  new_questions_count: number;
  review_questions_count: number;
  correct_count: number;
  wrong_count: number;
  total_time_minutes: number;
};

type PreviewRow = {
  id: string;
  quiz_bank_id: number | null;
  import_mode: "create" | "update";
  bank_name: string;
  source_file_name: string;
  questions_json: string;
  added_count: number;
  updated_count: number;
  removed_count: number;
  unchanged_count: number;
  added_ids_json: string;
  updated_ids_json: string;
  removed_ids_json: string;
  base_updated_at: string | null;
  expires_at: string;
};

type VersionRow = {
  id: number;
  quiz_bank_id: number;
  bank_name: string;
  bank_description: string | null;
  source_file_name: string;
  questions_json: string;
  progress_json: string;
  daily_logs_json: string;
  question_count: number;
  created_by: number;
  created_at: string;
  reason: string;
};

export class QuestionBankManagementError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

export async function createQuestionBankPreview(
  db: AppDb,
  params: {
    questions: unknown;
    mode?: "create" | "update";
    quizBankId?: number;
    bankName?: string;
    sourceFileName: string;
    createdBy: number;
  }
) {
  const questions = parseQuestionBank(params.questions);
  const mode = params.mode ?? "update";
  const bank = mode === "update" ? await getTargetBank(db, params.quizBankId) : null;
  const current = bank
    ? await db.all<QuestionRow[]>(
        "SELECT * FROM questions WHERE quiz_bank_id = ? ORDER BY id",
        bank.id
      )
    : [];
  const currentById = new Map(current.map((question) => [question.id, question]));
  const incomingIds = new Set(questions.map((question) => question.id));
  const addedIds: string[] = [];
  const updatedIds: string[] = [];
  let unchangedCount = 0;

  for (const question of questions) {
    const existing = currentById.get(question.id);
    if (!existing) {
      addedIds.push(question.id);
    } else if (questionSignature(question) !== rowSignature(existing)) {
      updatedIds.push(question.id);
    } else {
      unchangedCount += 1;
    }
  }

  const removedIds = current
    .filter((question) => !incomingIds.has(question.id))
    .map((question) => question.id);
  const previewId = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + PREVIEW_TTL_MS);
  const bankName = params.bankName?.trim() || bank?.name || "新题库";

  await db.run("DELETE FROM question_bank_previews WHERE expires_at <= ?", createdAt.toISOString());
  await db.run(
    `INSERT INTO question_bank_previews
     (id, quiz_bank_id, import_mode, bank_name, source_file_name, questions_json,
      added_count, updated_count, removed_count, unchanged_count,
      added_ids_json, updated_ids_json, removed_ids_json, base_updated_at,
      created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    previewId,
    bank?.id ?? null,
    mode,
    bankName,
    params.sourceFileName,
    JSON.stringify(questions),
    addedIds.length,
    updatedIds.length,
    removedIds.length,
    unchangedCount,
    JSON.stringify(addedIds),
    JSON.stringify(updatedIds),
    JSON.stringify(removedIds),
    bank?.updated_at ?? null,
    params.createdBy,
    createdAt.toISOString(),
    expiresAt.toISOString()
  );

  return {
    previewId,
    bankName,
    sourceFileName: params.sourceFileName,
    mode,
    quizBankId: bank?.id ?? null,
    currentCount: current.length,
    nextCount: questions.length,
    addedCount: addedIds.length,
    updatedCount: updatedIds.length,
    removedCount: removedIds.length,
    unchangedCount,
    addedIds,
    updatedIds,
    removedIds,
    expiresAt: expiresAt.toISOString()
  };
}

export async function applyQuestionBankPreview(
  db: AppDb,
  previewId: string,
  adminId: number
) {
  return serializeMutation(() => applyQuestionBankPreviewInternal(db, previewId, adminId));
}

async function applyQuestionBankPreviewInternal(
  db: AppDb,
  previewId: string,
  adminId: number
) {
  const preview = await getUsablePreview(db, previewId, adminId);
  const questions = parseQuestionBank(JSON.parse(preview.questions_json));
  const removedIds = JSON.parse(preview.removed_ids_json) as string[];

  await db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    let bankId = preview.quiz_bank_id;
    let versionId: number | null = null;
    const now = new Date().toISOString();

    if (preview.import_mode === "create") {
      const result = await db.run(
        `INSERT INTO quiz_banks (name, description, question_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        preview.bank_name,
        null,
        questions.length,
        now,
        now
      );
      bankId = result.lastID!;
    } else {
      if (!bankId) {
        throw new QuestionBankManagementError("BANK_NOT_FOUND", "当前题库不存在", 404);
      }
      const bankState = await db.get<{ updated_at: string }>(
        "SELECT updated_at FROM quiz_banks WHERE id = ?",
        bankId
      );
      if (!bankState || bankState.updated_at !== preview.base_updated_at) {
        throw new QuestionBankManagementError(
          "PREVIEW_STALE",
          "题库已在预览后发生变化，请重新上传并确认差异",
          409
        );
      }
      versionId = await createSnapshot(db, {
        bankId,
        createdBy: adminId,
        sourceFileName: preview.source_file_name,
        reason: "import"
      });
    }

    await upsertQuestions(db, bankId!, questions);
    await deleteQuestions(db, bankId!, removedIds);
    await db.run(
      `UPDATE quiz_banks
       SET name = ?, question_count = ?, updated_at = ?
       WHERE id = ?`,
      preview.bank_name,
      questions.length,
      now,
      bankId!
    );
    if (preview.import_mode === "create") {
      versionId = await createSnapshot(db, {
        bankId: bankId!,
        createdBy: adminId,
        sourceFileName: preview.source_file_name,
        reason: "create"
      });
    }
    await db.run("DELETE FROM question_bank_previews WHERE id = ?", previewId);
    await db.exec("COMMIT");
    return { versionId: versionId!, quizBankId: bankId!, questionCount: questions.length, bankName: preview.bank_name };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function listQuestionBankVersions(db: AppDb) {
  const rows = await db.all<VersionRow[]>(
    `SELECT * FROM question_bank_versions
     ORDER BY created_at DESC, id DESC
     LIMIT 30`
  );
  return rows.map(toVersionSummary);
}

export async function getQuestionBankStatus(db: AppDb) {
  const bank = await getDefaultQuizBank(db);
  const latest = await db.get<VersionRow>(
    "SELECT * FROM question_bank_versions ORDER BY created_at DESC, id DESC LIMIT 1"
  );
  return {
    bank: { id: bank.id, name: bank.name, questionCount: bank.question_count },
    banks: await getQuizBanks(db),
    latestVersion: latest ? toVersionSummary(latest) : null
  };
}

export async function rollbackQuestionBankVersion(
  db: AppDb,
  versionId: number,
  adminId: number
) {
  return serializeMutation(() => rollbackQuestionBankVersionInternal(db, versionId, adminId));
}

async function rollbackQuestionBankVersionInternal(
  db: AppDb,
  versionId: number,
  adminId: number
) {
  const version = await db.get<VersionRow>(
    "SELECT * FROM question_bank_versions WHERE id = ?",
    versionId
  );
  if (!version) {
    throw new QuestionBankManagementError("VERSION_NOT_FOUND", "题库备份版本不存在", 404);
  }

  const questions = parseQuestionBank(JSON.parse(version.questions_json));
  const progress = z.array(progressSchema).parse(JSON.parse(version.progress_json));
  const dailyLogs = z.array(dailyLogSchema).parse(JSON.parse(version.daily_logs_json));

  await db.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const undoVersionId = await createSnapshot(db, {
      bankId: version.quiz_bank_id,
      createdBy: adminId,
      sourceFileName: `rollback-before-version-${versionId}.json`,
      reason: "rollback"
    });
    await db.run("DELETE FROM user_progress WHERE quiz_bank_id = ?", version.quiz_bank_id);
    await db.run("DELETE FROM daily_logs WHERE quiz_bank_id = ?", version.quiz_bank_id);
    await db.run("DELETE FROM questions WHERE quiz_bank_id = ?", version.quiz_bank_id);
    await insertQuestions(db, version.quiz_bank_id, questions);
    await restoreProgress(db, version.quiz_bank_id, progress);
    await restoreDailyLogs(db, version.quiz_bank_id, dailyLogs);
    await db.run(
      `UPDATE quiz_banks
       SET name = ?, description = ?, question_count = ?, updated_at = ?
       WHERE id = ?`,
      version.bank_name,
      version.bank_description,
      questions.length,
      new Date().toISOString(),
      version.quiz_bank_id
    );
    await db.exec("COMMIT");
    return {
      restoredVersionId: versionId,
      undoVersionId,
      questionCount: questions.length,
      bankName: version.bank_name
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function getUsablePreview(db: AppDb, previewId: string, adminId: number) {
  const preview = await db.get<PreviewRow & { created_by: number }>(
    "SELECT * FROM question_bank_previews WHERE id = ?",
    previewId
  );
  if (!preview || preview.created_by !== adminId) {
    throw new QuestionBankManagementError("PREVIEW_NOT_FOUND", "导入预览不存在，请重新上传题库", 404);
  }
  if (new Date(preview.expires_at).getTime() <= Date.now()) {
    await db.run("DELETE FROM question_bank_previews WHERE id = ?", previewId);
    throw new QuestionBankManagementError("PREVIEW_EXPIRED", "导入预览已过期，请重新上传题库", 410);
  }
  return preview;
}

async function createSnapshot(
  db: AppDb,
  params: { bankId: number; createdBy: number; sourceFileName: string; reason: string }
) {
  const bank = await db.get<{
    name: string;
    description: string | null;
    question_count: number;
  }>("SELECT name, description, question_count FROM quiz_banks WHERE id = ?", params.bankId);
  if (!bank) {
    throw new QuestionBankManagementError("BANK_NOT_FOUND", "当前题库不存在", 404);
  }
  const questionRows = await db.all<QuestionRow[]>(
    "SELECT * FROM questions WHERE quiz_bank_id = ? ORDER BY id",
    params.bankId
  );
  const questions = questionRows.map(rowToQuestionInput);
  const progress = await db.all<StoredProgress[]>(
    `SELECT user_id, status, total_attempts, correct_count, wrong_count,
            consecutive_correct, first_wrong_at, last_wrong_at, last_answered_at,
            is_marked, wrong_history_json, question_id
     FROM user_progress WHERE quiz_bank_id = ? ORDER BY id`,
    params.bankId
  );
  const dailyLogs = await db.all<StoredDailyLog[]>(
    `SELECT user_id, date, new_questions_count, review_questions_count,
            correct_count, wrong_count, total_time_minutes
     FROM daily_logs WHERE quiz_bank_id = ? ORDER BY id`,
    params.bankId
  );
  const result = await db.run(
    `INSERT INTO question_bank_versions
     (quiz_bank_id, bank_name, bank_description, source_file_name,
      questions_json, progress_json, daily_logs_json, question_count,
      created_by, created_at, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params.bankId,
    bank.name,
    bank.description,
    params.sourceFileName,
    JSON.stringify(questions),
    JSON.stringify(progress),
    JSON.stringify(dailyLogs),
    questions.length,
    params.createdBy,
    new Date().toISOString(),
    params.reason
  );
  return result.lastID!;
}

async function insertQuestions(db: AppDb, bankId: number, questions: QuestionInput[]) {
  const statement = await db.prepare(
    `INSERT INTO questions
     (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const question of questions) {
      await statement.run(
        question.id,
        bankId,
        question.question,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.chapter ?? null,
        question.type,
        question.explanation ?? null
      );
    }
  } finally {
    await statement.finalize();
  }
}

async function upsertQuestions(db: AppDb, bankId: number, questions: QuestionInput[]) {
  const statement = await db.prepare(
    `INSERT INTO questions
     (id, quiz_bank_id, question, options_json, correct_answer, chapter, type, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(quiz_bank_id, id) DO UPDATE SET
       quiz_bank_id = excluded.quiz_bank_id,
       question = excluded.question,
       options_json = excluded.options_json,
       correct_answer = excluded.correct_answer,
       chapter = excluded.chapter,
       type = excluded.type,
       explanation = excluded.explanation`
  );
  try {
    for (const question of questions) {
      await statement.run(
        question.id,
        bankId,
        question.question,
        JSON.stringify(question.options),
        question.correctAnswer,
        question.chapter ?? null,
        question.type,
        question.explanation ?? null
      );
    }
  } finally {
    await statement.finalize();
  }
}

async function deleteQuestions(db: AppDb, bankId: number, questionIds: string[]) {
  const statement = await db.prepare(
    "DELETE FROM questions WHERE quiz_bank_id = ? AND id = ?"
  );
  try {
    for (const questionId of questionIds) await statement.run(bankId, questionId);
  } finally {
    await statement.finalize();
  }
}

async function restoreProgress(db: AppDb, bankId: number, rows: StoredProgress[]) {
  const statement = await db.prepare(
    `INSERT INTO user_progress
     (user_id, quiz_bank_id, question_id, status, total_attempts, correct_count,
      wrong_count, consecutive_correct, first_wrong_at, last_wrong_at,
      last_answered_at, is_marked, wrong_history_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const row of rows) {
      await statement.run(
        row.user_id, bankId, row.question_id, row.status, row.total_attempts,
        row.correct_count, row.wrong_count, row.consecutive_correct,
        row.first_wrong_at, row.last_wrong_at, row.last_answered_at,
        row.is_marked, row.wrong_history_json
      );
    }
  } finally {
    await statement.finalize();
  }
}

async function restoreDailyLogs(db: AppDb, bankId: number, rows: StoredDailyLog[]) {
  const statement = await db.prepare(
    `INSERT INTO daily_logs
     (user_id, quiz_bank_id, date, new_questions_count, review_questions_count,
      correct_count, wrong_count, total_time_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const row of rows) {
      await statement.run(
        row.user_id, bankId, row.date, row.new_questions_count,
        row.review_questions_count, row.correct_count, row.wrong_count,
        row.total_time_minutes
      );
    }
  } finally {
    await statement.finalize();
  }
}

function rowToQuestionInput(row: QuestionRow): QuestionInput {
  return {
    id: row.id,
    question: row.question,
    options: JSON.parse(row.options_json) as Record<string, string>,
    correctAnswer: row.correct_answer,
    chapter: row.chapter ?? undefined,
    type: row.type,
    explanation: row.explanation ?? undefined
  };
}

function questionSignature(question: QuestionInput) {
  return JSON.stringify({
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    chapter: question.chapter ?? null,
    type: question.type,
    explanation: question.explanation ?? null
  });
}

function rowSignature(row: QuestionRow) {
  return questionSignature(rowToQuestionInput(row));
}

function toVersionSummary(row: VersionRow) {
  return {
    id: row.id,
    bankName: row.bank_name,
    sourceFileName: row.source_file_name,
    questionCount: row.question_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reason: row.reason as "import" | "rollback" | "create"
  };
}

async function getTargetBank(db: AppDb, quizBankId?: number) {
  const fallback = quizBankId ? null : await getDefaultQuizBank(db);
  const bankId = quizBankId ?? fallback?.id;
  const bank = await db.get<{
    id: number;
    name: string;
    question_count: number;
    updated_at: string;
  }>("SELECT id, name, question_count, updated_at FROM quiz_banks WHERE id = ?", bankId ?? 0);
  if (!bank) {
    throw new QuestionBankManagementError("BANK_NOT_FOUND", "目标题库不存在", 404);
  }
  return bank;
}

const progressSchema = z.object({
  user_id: z.number().int().positive(),
  status: z.string(),
  total_attempts: z.number().int().nonnegative(),
  correct_count: z.number().int().nonnegative(),
  wrong_count: z.number().int().nonnegative(),
  consecutive_correct: z.number().int().nonnegative(),
  first_wrong_at: z.string().nullable(),
  last_wrong_at: z.string().nullable(),
  last_answered_at: z.string().nullable(),
  is_marked: z.number().int(),
  wrong_history_json: z.string().nullable(),
  question_id: z.string()
});

const dailyLogSchema = z.object({
  user_id: z.number().int().positive(),
  date: z.string(),
  new_questions_count: z.number().int().nonnegative(),
  review_questions_count: z.number().int().nonnegative(),
  correct_count: z.number().int().nonnegative(),
  wrong_count: z.number().int().nonnegative(),
  total_time_minutes: z.number().int().nonnegative()
});
