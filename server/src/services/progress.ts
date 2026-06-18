import type { AppDb } from "../db.js";
import { gradeAnswer } from "../lib/grading.js";
import type { PracticeMode, ProgressStatus, QuestionRow } from "../types.js";
import { getDefaultQuizBank, toPublicQuestion } from "./questionBank.js";

export async function getNewQuestions(db: AppDb, userId: number, limit: number) {
  const bank = await getDefaultQuizBank(db);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, COALESCE(p.is_marked, 0) AS is_marked
     FROM questions q
     LEFT JOIN user_progress p
       ON p.question_id = q.id
      AND p.user_id = ?
      AND p.quiz_bank_id = q.quiz_bank_id
     WHERE q.quiz_bank_id = ?
       AND (p.id IS NULL OR p.status = 'unseen')
     ORDER BY RANDOM()
     LIMIT ?`,
    userId,
    bank.id,
    limit
  );

  return rows.map(toPublicQuestion);
}

export async function getReviewQuestions(db: AppDb, userId: number, limit: number) {
  const bank = await getDefaultQuizBank(db);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked, p.consecutive_correct, p.wrong_count
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.status = 'reviewing'
     ORDER BY
       p.consecutive_correct ASC,
       COALESCE(p.last_wrong_at, p.first_wrong_at, p.last_answered_at) ASC,
       RANDOM()
     LIMIT ?`,
    userId,
    bank.id,
    limit
  );

  return rows.map(toPublicQuestion);
}

export async function answerQuestion(
  db: AppDb,
  params: { userId: number; questionId: string; answer: string; mode: PracticeMode }
) {
  const question = await db.get<QuestionRow>(
    "SELECT * FROM questions WHERE id = ?",
    params.questionId
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

export async function getStats(db: AppDb, userId: number) {
  const bank = await getDefaultQuizBank(db);
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

export async function getWrongAnswers(db: AppDb, userId: number) {
  const bank = await getDefaultQuizBank(db);
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
    bank.id
  );

  return rows.map((row) => ({
    ...toPublicQuestion(row),
    wrongCount: row.wrong_count,
    consecutiveCorrect: row.consecutive_correct,
    lastAnsweredAt: row.last_answered_at,
    isMarked: Boolean(row.is_marked)
  }));
}

export async function getMarkedQuestions(db: AppDb, userId: number) {
  const bank = await getDefaultQuizBank(db);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.is_marked = 1
     ORDER BY COALESCE(p.last_answered_at, '') DESC, q.id ASC`,
    userId,
    bank.id
  );

  return rows.map(toPublicQuestion);
}

export async function getCompletedQuestions(db: AppDb, userId: number) {
  const bank = await getDefaultQuizBank(db);
  const rows = await db.all<QuestionRow[]>(
    `SELECT q.*, p.is_marked, p.consecutive_correct, p.wrong_count
     FROM user_progress p
     JOIN questions q ON q.id = p.question_id
     WHERE p.user_id = ?
       AND p.quiz_bank_id = ?
       AND p.status = 'done'
     ORDER BY p.last_answered_at DESC, q.id ASC`,
    userId,
    bank.id
  );

  return rows.map(toPublicQuestion);
}

export async function getQuestionDetail(db: AppDb, userId: number, questionId: string) {
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
     WHERE q.id = ?`,
    userId,
    questionId
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

export async function resetQuestionProgress(db: AppDb, userId: number, questionId: string) {
  const result = await db.run(
    "DELETE FROM user_progress WHERE user_id = ? AND question_id = ?",
    userId,
    questionId
  );
  return { questionId, reset: result.changes > 0 };
}

export async function markQuestion(
  db: AppDb,
  params: { userId: number; questionId: string; isMarked: boolean }
) {
  const question = await db.get<QuestionRow>("SELECT * FROM questions WHERE id = ?", params.questionId);
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
    return isCorrect && consecutiveCorrect >= 3 ? "done" : "reviewing";
  }
  return isCorrect ? "done" : "reviewing";
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
