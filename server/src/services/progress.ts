import type { AppDb } from "../db.js";
import { gradeAnswer } from "../lib/grading.js";
import type { PracticeMode, ProgressStatus, QuestionRow } from "../types.js";
import { getDefaultQuizBank, toPublicQuestion } from "./questionBank.js";

export type QuestionOrderMode = "random" | "chapter";
type BankScope = { quizBankId?: number; includeEssay?: boolean };
type NewQuestionScope = BankScope & { orderMode?: QuestionOrderMode; chapter?: string };
type ReviewQuestionScope = BankScope & { orderMode?: QuestionOrderMode; chapter?: string };
type ExamScope = BankScope;

const CHAPTER_ALIASES = new Map<string, number>([
  ["导论", 0],
  ["绪论", 0],
  ["第一章", 1],
  ["第二章", 2],
  ["第三章", 3],
  ["第四章", 4],
  ["第五章", 5],
  ["第六章", 6],
  ["第七章", 7]
]);

export async function getNewQuestions(db: AppDb, userId: number, limit: number, scope: NewQuestionScope = {}) {
  const bankId = await resolveQuizBankId(db, scope.quizBankId);
  const chapter = scope.chapter?.trim();
  const orderMode = scope.orderMode ?? "random";
  const orderClause =
    orderMode === "chapter"
      ? `CASE q.type
           WHEN 'single' THEN 0
           WHEN 'judge' THEN 1
           WHEN 'multiple' THEN 2
           WHEN 'essay' THEN 3
           ELSE 4
         END,
         COALESCE(q.chapter, '未分章') ASC,
         CAST(q.id AS INTEGER) ASC,
         q.id ASC`
      : `CASE q.type
           WHEN 'single' THEN 0
           WHEN 'judge' THEN 1
           WHEN 'multiple' THEN 2
           WHEN 'essay' THEN 3
           ELSE 4
         END,
         RANDOM()`;
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, COALESCE(p.is_marked, 0) AS is_marked
     FROM questions q
     LEFT JOIN user_progress p
       ON p.question_id = q.id
      AND p.user_id = ?
      AND p.quiz_bank_id = q.quiz_bank_id
     WHERE q.quiz_bank_id = ?
       AND (? = 1 OR q.type <> 'essay')
       AND (? IS NULL OR COALESCE(q.chapter, '未分章') = ?)
       AND (p.id IS NULL OR p.status = 'unseen')
     ORDER BY ${orderClause}
     LIMIT ?`,
    userId,
    bankId,
    scope.includeEssay ? 1 : 0,
    chapter || null,
    chapter || null,
    limit
  );

  return rows.map(toPublicQuestion);
}

export async function getExamQuestions(db: AppDb, userId: number, scope: ExamScope = {}) {
  const bankId = await resolveQuizBankId(db, scope.quizBankId);
  const sections = [
    { type: "single", limit: 20 },
    { type: "judge", limit: 10 },
    { type: "multiple", limit: 5 },
    ...(scope.includeEssay ? [{ type: "essay", limit: 2 }] : [])
  ] as const;
  const result: QuestionRow[] = [];

  for (const section of sections) {
    const rows = await db.all<QuestionRow[]>(
      `SELECT q.*, COALESCE(p.is_marked, 0) AS is_marked
       FROM questions q
       LEFT JOIN user_progress p
         ON p.question_id = q.id
        AND p.user_id = ?
        AND p.quiz_bank_id = q.quiz_bank_id
       WHERE q.quiz_bank_id = ?
         AND q.type = ?
       ORDER BY RANDOM()
       LIMIT ?`,
      userId,
      bankId,
      section.type,
      section.limit
    );
    result.push(...rows);
  }

  return result.map(toPublicQuestion);
}

export async function getEssayQuestions(db: AppDb, userId: number, limit: number, scope: BankScope = {}) {
  const bankId = await resolveQuizBankId(db, scope.quizBankId);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, COALESCE(p.is_marked, 0) AS is_marked
     FROM questions q
     LEFT JOIN user_progress p
       ON p.question_id = q.id
      AND p.user_id = ?
      AND p.quiz_bank_id = q.quiz_bank_id
     WHERE q.quiz_bank_id = ?
       AND q.type = 'essay'
     ORDER BY RANDOM()
     LIMIT ?`,
    userId,
    bankId,
    limit
  );

  return rows.map(toPublicQuestion);
}

export async function getReviewQuestions(db: AppDb, userId: number, limit: number, scope: ReviewQuestionScope = {}) {
  const bankId = await resolveQuizBankId(db, scope.quizBankId);
  const chapter = scope.chapter?.trim();
  const orderMode = scope.orderMode ?? "random";
  const orderClause =
    orderMode === "chapter"
      ? `CASE q.type
           WHEN 'single' THEN 0
           WHEN 'judge' THEN 1
           WHEN 'multiple' THEN 2
           WHEN 'essay' THEN 3
           ELSE 4
         END,
         COALESCE(q.chapter, '未分章') ASC,
         CAST(q.id AS INTEGER) ASC,
         q.id ASC`
      : "RANDOM()";
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked, p.consecutive_correct, p.wrong_count
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND (? = 1 OR q.type <> 'essay')
       AND (? IS NULL OR COALESCE(q.chapter, '未分章') = ?)
       AND p.status = 'reviewing'
     ORDER BY ${orderClause}
     LIMIT ?`,
    userId,
    bankId,
    scope.includeEssay ? 1 : 0,
    chapter || null,
    chapter || null,
    limit
  );

  return rows.map(toPublicQuestion);
}

export async function answerQuestion(
  db: AppDb,
  params: { userId: number; questionId: string; quizBankId?: number; answer: string; mode: PracticeMode }
) {
  const question = await db.get<QuestionRow>(
    params.quizBankId
      ? "SELECT * FROM questions WHERE quiz_bank_id = ? AND id = ?"
      : "SELECT * FROM questions WHERE id = ? ORDER BY quiz_bank_id LIMIT 1",
    ...(params.quizBankId ? [params.quizBankId, params.questionId] : [params.questionId])
  );

  if (!question) {
    throw new Error("题目不存在");
  }

  const options = JSON.parse(question.options_json) as Record<string, string>;
  const graded = gradeAnswer({
    type: question.type,
    answer: params.answer,
    correctAnswer: question.correct_answer,
    options
  });

  const existing = await db.get<{
    id: number;
    status: ProgressStatus;
    total_attempts: number;
    correct_count: number;
    wrong_count: number;
    consecutive_correct: number;
    first_wrong_at: string | null;
    last_wrong_at: string | null;
    wrong_history_json: string | null;
  }>(
    `SELECT * FROM user_progress
     WHERE user_id = ? AND quiz_bank_id = ? AND question_id = ?`,
    params.userId,
    question.quiz_bank_id,
    question.id
  );

  const now = new Date().toISOString();
  const previousConsecutive = existing?.consecutive_correct ?? 0;
  const consecutiveCorrect = graded.isCorrect ? previousConsecutive + 1 : 0;
  const status = nextStatus(params.mode, graded.isCorrect, consecutiveCorrect);
  const history = parseWrongHistory(existing?.wrong_history_json);

  if (!graded.isCorrect) {
    history.push({
      at: now,
      answer: graded.normalizedAnswer,
      correctAnswer: graded.normalizedCorrect
    });
  }

  if (existing) {
    await db.run(
      `UPDATE user_progress
       SET status = ?,
           total_attempts = total_attempts + 1,
           correct_count = correct_count + ?,
           wrong_count = wrong_count + ?,
           consecutive_correct = ?,
           first_wrong_at = COALESCE(first_wrong_at, ?),
           last_wrong_at = CASE WHEN ? IS NOT NULL THEN ? ELSE last_wrong_at END,
           last_answered_at = ?,
           wrong_history_json = ?
       WHERE id = ?`,
      status,
      graded.isCorrect ? 1 : 0,
      graded.isCorrect ? 0 : 1,
      consecutiveCorrect,
      graded.isCorrect ? null : now,
      graded.isCorrect ? null : now,
      graded.isCorrect ? null : now,
      now,
      JSON.stringify(history),
      existing.id
    );
  } else {
    await db.run(
      `INSERT INTO user_progress
       (user_id, quiz_bank_id, question_id, status, total_attempts, correct_count,
        wrong_count, consecutive_correct, first_wrong_at, last_wrong_at, last_answered_at, is_marked,
        wrong_history_json)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?)`,
      params.userId,
      question.quiz_bank_id,
      question.id,
      status,
      graded.isCorrect ? 1 : 0,
      graded.isCorrect ? 0 : 1,
      consecutiveCorrect,
      graded.isCorrect ? null : now,
      graded.isCorrect ? null : now,
      now,
      JSON.stringify(history)
    );
  }

  await updateDailyLog(db, {
    userId: params.userId,
    quizBankId: question.quiz_bank_id,
    mode: params.mode,
    isCorrect: graded.isCorrect
  });

  return {
    isCorrect: graded.isCorrect,
    correctAnswer: graded.normalizedCorrect,
    explanation: question.explanation,
    progress: {
      status,
      consecutiveCorrect
    }
  };
}

export async function getStats(db: AppDb, userId: number, quizBankId?: number) {
  const bankId = await resolveQuizBankId(db, quizBankId);
  const bank = await db.get<{ id: number; name: string; question_count: number }>(
    "SELECT id, name, question_count FROM quiz_banks WHERE id = ?",
    bankId
  );
  if (!bank) throw new Error("题库不存在");
  const totals = await db.get<{
    total: number;
    done: number;
    reviewing: number;
    marked: number;
    attempts: number;
    correct: number;
    today: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM questions WHERE quiz_bank_id = ?) as total,
       (SELECT COUNT(*) FROM user_progress WHERE user_id = ? AND quiz_bank_id = ? AND status = 'done') as done,
       (SELECT COUNT(*) FROM user_progress WHERE user_id = ? AND quiz_bank_id = ? AND status = 'reviewing') as reviewing,
       (SELECT COUNT(*) FROM user_progress WHERE user_id = ? AND quiz_bank_id = ? AND is_marked = 1) as marked,
       COALESCE((SELECT SUM(total_attempts) FROM user_progress WHERE user_id = ? AND quiz_bank_id = ?), 0) as attempts,
       COALESCE((SELECT SUM(correct_count) FROM user_progress WHERE user_id = ? AND quiz_bank_id = ?), 0) as correct,
       COALESCE((SELECT new_questions_count + review_questions_count FROM daily_logs WHERE user_id = ? AND quiz_bank_id = ? AND date = ?), 0) as today`,
    bank.id,
    userId,
    bank.id,
    userId,
    bank.id,
    userId,
    bank.id,
    userId,
    bank.id,
    userId,
    bank.id,
    userId,
    bank.id,
    dateKey()
  );

  const total = totals?.total ?? 0;
  const done = totals?.done ?? 0;
  const reviewing = totals?.reviewing ?? 0;
  const attempts = totals?.attempts ?? 0;
  const correct = totals?.correct ?? 0;

  return {
    quizBank: bank,
    total,
    done,
    reviewing,
    unseen: Math.max(total - done - reviewing, 0),
    marked: totals?.marked ?? 0,
    attempts,
    correct,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : 0,
    today: totals?.today ?? 0
  };
}

export async function getChapterStats(db: AppDb, userId: number, quizBankId?: number) {
  const bankId = await resolveQuizBankId(db, quizBankId);
  const rows = await db.all<
    Array<{
      chapter: string | null;
      total: number;
      done: number;
      reviewing: number;
      attempts: number;
      correct: number;
    }>
  >(
    `SELECT
       COALESCE(q.chapter, '未分章') as chapter,
       COUNT(q.id) as total,
       COALESCE(SUM(CASE WHEN p.status = 'done' THEN 1 ELSE 0 END), 0) as done,
       COALESCE(SUM(CASE WHEN p.status = 'reviewing' THEN 1 ELSE 0 END), 0) as reviewing,
       COALESCE(SUM(p.total_attempts), 0) as attempts,
       COALESCE(SUM(p.correct_count), 0) as correct
     FROM questions q
     LEFT JOIN user_progress p
       ON p.question_id = q.id
      AND p.user_id = ?
      AND p.quiz_bank_id = q.quiz_bank_id
     WHERE q.quiz_bank_id = ?
     GROUP BY COALESCE(q.chapter, '未分章')
     ORDER BY COALESCE(q.chapter, '未分章') ASC`,
    userId,
    bankId
  );

  return rows
    .map((row) => ({
      chapter: row.chapter ?? "未分章",
      total: Number(row.total),
      done: Number(row.done),
      reviewing: Number(row.reviewing),
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: Number(row.attempts) > 0 ? Math.round((Number(row.correct) / Number(row.attempts)) * 1000) / 10 : 0
    }))
    .sort((a, b) => compareChapterNames(a.chapter, b.chapter));
}

function compareChapterNames(left: string, right: string) {
  const leftRank = chapterRank(left);
  const rightRank = chapterRank(right);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.localeCompare(right, "zh-CN", { numeric: true });
}

function chapterRank(chapter: string) {
  const normalized = chapter.trim();
  return CHAPTER_ALIASES.get(normalized) ?? Number.MAX_SAFE_INTEGER;
}

export async function getWrongAnswers(db: AppDb, userId: number, quizBankId?: number) {
  const bankId = await resolveQuizBankId(db, quizBankId);
  const rows = await db.all<
    Array<
      QuestionRow & {
        wrong_count: number;
        consecutive_correct: number;
        last_answered_at: string | null;
        is_marked: number;
      }
    >
  >(
    `SELECT q.*, p.wrong_count, p.consecutive_correct, p.last_answered_at, p.is_marked
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.wrong_count > 0
     ORDER BY p.last_answered_at DESC`,
    userId,
    bankId
  );

  return rows.map((row) => ({
    ...toPublicQuestion(row),
    wrongCount: row.wrong_count,
    consecutiveCorrect: row.consecutive_correct,
    lastAnsweredAt: row.last_answered_at,
    isMarked: Boolean(row.is_marked)
  }));
}

export async function getMarkedQuestions(db: AppDb, userId: number, quizBankId?: number) {
  const bankId = await resolveQuizBankId(db, quizBankId);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.is_marked = 1
     ORDER BY COALESCE(p.last_answered_at, '') DESC, q.id ASC`,
    userId,
    bankId
  );

  return rows.map(toPublicQuestion);
}

export async function getCompletedQuestions(db: AppDb, userId: number, quizBankId?: number) {
  const bankId = await resolveQuizBankId(db, quizBankId);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked, p.consecutive_correct, p.wrong_count
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.status = 'done'
     ORDER BY p.last_answered_at DESC, q.id ASC`,
    userId,
    bankId
  );

  return rows.map(toPublicQuestion);
}

export async function getQuestionDetail(db: AppDb, userId: number, questionId: string, quizBankId?: number) {
  const row = await db.get<
    QuestionRow & {
      status: ProgressStatus | null;
      total_attempts: number | null;
      correct_count: number | null;
      wrong_count: number | null;
      consecutive_correct: number | null;
      last_answered_at: string | null;
      wrong_history_json: string | null;
      is_marked: number | null;
    }
  >(
    `SELECT q.*,
       p.status,
       p.total_attempts,
       p.correct_count,
       p.wrong_count,
       p.consecutive_correct,
       p.last_answered_at,
       p.wrong_history_json,
       p.is_marked
     FROM questions q
     LEFT JOIN user_progress p
       ON p.question_id = q.id
      AND p.user_id = ?
      AND p.quiz_bank_id = q.quiz_bank_id
     WHERE q.id = ?
       AND (? IS NULL OR q.quiz_bank_id = ?)
     ORDER BY q.quiz_bank_id
     LIMIT 1`,
    userId,
    questionId,
    quizBankId ?? null,
    quizBankId ?? null
  );

  if (!row) {
    throw new Error("题目不存在");
  }

  return {
    question: {
      ...toPublicQuestion(row),
      correctAnswer: row.correct_answer
    },
    progress:
      row.status == null
        ? null
        : {
            status: row.status,
            totalAttempts: Number(row.total_attempts ?? 0),
            correctCount: Number(row.correct_count ?? 0),
            wrongCount: Number(row.wrong_count ?? 0),
            consecutiveCorrect: Number(row.consecutive_correct ?? 0),
            lastAnsweredAt: row.last_answered_at,
            isMarked: Boolean(row.is_marked),
            wrongHistory: parseWrongHistory(row.wrong_history_json)
          }
  };
}

export async function resetQuestionProgress(db: AppDb, userId: number, questionId: string, quizBankId?: number) {
  const result = await db.run(
    `DELETE FROM user_progress
     WHERE user_id = ? AND question_id = ? AND (? IS NULL OR quiz_bank_id = ?)`,
    userId,
    questionId,
    quizBankId ?? null,
    quizBankId ?? null
  );
  return { questionId, reset: result.changes > 0 };
}

export async function markQuestion(
  db: AppDb,
  params: { userId: number; questionId: string; quizBankId?: number; isMarked: boolean }
) {
  const question = await db.get<QuestionRow>(
    params.quizBankId
      ? "SELECT * FROM questions WHERE quiz_bank_id = ? AND id = ?"
      : "SELECT * FROM questions WHERE id = ? ORDER BY quiz_bank_id LIMIT 1",
    ...(params.quizBankId ? [params.quizBankId, params.questionId] : [params.questionId])
  );
  if (!question) {
    throw new Error("题目不存在");
  }

  await db.run(
    `INSERT INTO user_progress
      (user_id, quiz_bank_id, question_id, status, is_marked, wrong_history_json)
     VALUES (?, ?, ?, 'unseen', ?, '[]')
     ON CONFLICT(user_id, quiz_bank_id, question_id)
     DO UPDATE SET is_marked = excluded.is_marked`,
    params.userId,
    question.quiz_bank_id,
    question.id,
    params.isMarked ? 1 : 0
  );

  return { questionId: params.questionId, isMarked: params.isMarked };
}

function nextStatus(mode: PracticeMode, isCorrect: boolean, consecutiveCorrect: number): ProgressStatus {
  if (mode === "review") {
    return isCorrect && consecutiveCorrect >= 2 ? "done" : "reviewing";
  }
  return isCorrect ? "done" : "reviewing";
}

async function resolveQuizBankId(db: AppDb, quizBankId?: number) {
  if (quizBankId) {
    const bank = await db.get<{ id: number }>("SELECT id FROM quiz_banks WHERE id = ?", quizBankId);
    if (!bank) throw new Error("题库不存在");
    return bank.id;
  }
  return (await getDefaultQuizBank(db)).id;
}

function parseWrongHistory(raw?: string | null) {
  if (!raw) {
    return [] as Array<{ at: string; answer: string; correctAnswer: string }>;
  }
  try {
    return JSON.parse(raw) as Array<{ at: string; answer: string; correctAnswer: string }>;
  } catch {
    return [];
  }
}

async function updateDailyLog(
  db: AppDb,
  params: { userId: number; quizBankId: number; mode: PracticeMode; isCorrect: boolean }
) {
  await db.run(
    `INSERT INTO daily_logs
      (user_id, quiz_bank_id, date, new_questions_count, review_questions_count, correct_count, wrong_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, quiz_bank_id, date)
     DO UPDATE SET
      new_questions_count = new_questions_count + excluded.new_questions_count,
      review_questions_count = review_questions_count + excluded.review_questions_count,
      correct_count = correct_count + excluded.correct_count,
      wrong_count = wrong_count + excluded.wrong_count`,
    params.userId,
    params.quizBankId,
    dateKey(),
    params.mode === "new" ? 1 : 0,
    params.mode === "review" ? 1 : 0,
    params.isCorrect ? 1 : 0,
    params.isCorrect ? 0 : 1
  );
}

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}
