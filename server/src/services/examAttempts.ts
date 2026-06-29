import type { AppDb } from "../db.js";
import { gradeAnswer } from "../lib/grading.js";
import type { PublicQuestion, QuestionRow, QuestionType } from "../types.js";
import { answerQuestion, getExamQuestions } from "./progress.js";
import { getDefaultQuizBank, toPublicQuestion } from "./questionBank.js";

export type ExamAttemptStatus = "active" | "submitted" | "expired";
export type ExamSubmitReason = "manual" | "timeout";

export type ExamAnswerState = {
  answer: string;
  answeredAt: string;
  isCorrect?: boolean;
  correctAnswer?: string;
  explanation?: string | null;
  gradedAt?: string;
};

export type ExamSummaryRow = {
  type: QuestionType;
  label: string;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  score: number;
  possibleScore: number;
};

export type ExamSummary = {
  score: number;
  totalScore: number;
  answeredCount: number;
  questionCount: number;
  objectiveWrongCount: number;
  essayCount: number;
  essayAnsweredCount: number;
  byType: ExamSummaryRow[];
};

export type ExamAttemptDetail = {
  id: number;
  quizBankId: number;
  status: ExamAttemptStatus;
  questions: PublicQuestion[];
  answers: Record<string, ExamAnswerState>;
  summary: ExamSummary;
  includeEssay: boolean;
  durationSeconds: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  submitReason: string | null;
};

export type ExamAttemptRecord = {
  id: number;
  quizBankId: number;
  quizBankName: string;
  status: ExamAttemptStatus;
  score: number;
  totalScore: number;
  questionCount: number;
  answeredCount: number;
  objectiveWrongCount: number;
  essayCount: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  submitReason: string | null;
};

type AttemptRow = {
  id: number;
  user_id: number;
  quiz_bank_id: number;
  status: ExamAttemptStatus;
  question_ids_json: string;
  answers_json: string;
  summary_json: string | null;
  include_essay: number;
  duration_seconds: number;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  submit_reason: string | null;
};

const EXAM_DURATION_SECONDS = 40 * 60;

export async function startExamAttempt(
  db: AppDb,
  params: { userId: number; quizBankId?: number; includeEssay: boolean }
) {
  const quizBankId = await resolveQuizBankId(db, params.quizBankId);
  const existing = await db.get<AttemptRow>(
    `SELECT * FROM exam_attempts
     WHERE user_id = ? AND quiz_bank_id = ? AND status = 'active'
     ORDER BY started_at DESC, id DESC
     LIMIT 1`,
    params.userId,
    quizBankId
  );
  if (existing) {
    return maybeExpireAttempt(db, existing, params.userId);
  }

  const questions = await getExamQuestions(db, params.userId, {
    quizBankId,
    includeEssay: params.includeEssay
  });
  const now = new Date();
  const startedAt = now.toISOString();
  const deadlineAt = new Date(now.getTime() + EXAM_DURATION_SECONDS * 1000).toISOString();
  const result = await db.run(
    `INSERT INTO exam_attempts
      (user_id, quiz_bank_id, status, question_ids_json, answers_json, include_essay,
       duration_seconds, started_at, deadline_at)
     VALUES (?, ?, 'active', ?, '{}', ?, ?, ?, ?)`,
    params.userId,
    quizBankId,
    JSON.stringify(questions.map((question) => question.id)),
    params.includeEssay ? 1 : 0,
    EXAM_DURATION_SECONDS,
    startedAt,
    deadlineAt
  );

  return hydrateAttempt(db, {
    id: result.lastID!,
    user_id: params.userId,
    quiz_bank_id: quizBankId,
    status: "active",
    question_ids_json: JSON.stringify(questions.map((question) => question.id)),
    answers_json: "{}",
    summary_json: null,
    include_essay: params.includeEssay ? 1 : 0,
    duration_seconds: EXAM_DURATION_SECONDS,
    started_at: startedAt,
    deadline_at: deadlineAt,
    submitted_at: null,
    submit_reason: null
  });
}

export async function getCurrentExamAttempt(
  db: AppDb,
  params: { userId: number; quizBankId?: number }
) {
  const quizBankId = params.quizBankId ? await resolveQuizBankId(db, params.quizBankId) : undefined;
  const row = await db.get<AttemptRow>(
    `SELECT * FROM exam_attempts
     WHERE user_id = ?
       AND status = 'active'
       AND (? IS NULL OR quiz_bank_id = ?)
     ORDER BY started_at DESC, id DESC
     LIMIT 1`,
    params.userId,
    quizBankId ?? null,
    quizBankId ?? null
  );
  return row ? maybeExpireAttempt(db, row, params.userId) : null;
}

export async function getExamAttempt(
  db: AppDb,
  params: { userId: number; attemptId: number }
) {
  const row = await getOwnedAttemptRow(db, params.userId, params.attemptId);
  return maybeExpireAttempt(db, row, params.userId);
}

export async function answerExamAttemptQuestion(
  db: AppDb,
  params: { userId: number; attemptId: number; questionId: string; answer: string }
) {
  const row = await getOwnedAttemptRow(db, params.userId, params.attemptId);
  const activeRow = await ensureActive(db, row, params.userId);
  const questionIds = parseQuestionIds(activeRow.question_ids_json);
  if (!questionIds.includes(params.questionId)) {
    throw new Error("题目不属于当前考试");
  }

  const answers = parseAnswers(activeRow.answers_json);
  if (answers[params.questionId]?.gradedAt) {
    return hydrateAttempt(db, activeRow);
  }

  const gradedAt = new Date().toISOString();
  await db.exec("BEGIN TRANSACTION");
  try {
    const result = await answerQuestion(db, {
      userId: params.userId,
      questionId: params.questionId,
      quizBankId: activeRow.quiz_bank_id,
      answer: params.answer,
      mode: "new"
    });

    answers[params.questionId] = {
      answer: params.answer,
      answeredAt: gradedAt,
      isCorrect: result.isCorrect,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      gradedAt
    };
    await db.run(
      "UPDATE exam_attempts SET answers_json = ? WHERE id = ?",
      JSON.stringify(answers),
      activeRow.id
    );
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }

  return hydrateAttempt(db, { ...activeRow, answers_json: JSON.stringify(answers) });
}

export async function submitExamAttempt(
  db: AppDb,
  params: { userId: number; attemptId: number; reason?: ExamSubmitReason }
) {
  const row = await getOwnedAttemptRow(db, params.userId, params.attemptId);
  if (row.status !== "active") {
    return hydrateAttempt(db, row);
  }
  return finalizeAttempt(db, row, params.userId, params.reason ?? "manual");
}

export async function getExamAttemptRecords(db: AppDb, params: { userId: number }) {
  await finalizeOverdueAttempts(db, params.userId);
  const rows = await db.all<Array<AttemptRow & { bank_name: string }>>(
    `SELECT a.*, b.name AS bank_name
     FROM exam_attempts a
     JOIN quiz_banks b ON b.id = a.quiz_bank_id
     WHERE a.user_id = ? AND a.status <> 'active'
     ORDER BY COALESCE(a.submitted_at, a.started_at) DESC, a.id DESC`,
    params.userId
  );

  return rows.map((row) => {
    const summary = parseSummary(row.summary_json);
    return {
      id: row.id,
      quizBankId: row.quiz_bank_id,
      quizBankName: row.bank_name,
      status: row.status,
      score: summary.score,
      totalScore: summary.totalScore,
      questionCount: summary.questionCount,
      answeredCount: summary.answeredCount,
      objectiveWrongCount: summary.objectiveWrongCount,
      essayCount: summary.essayCount,
      startedAt: row.started_at,
      deadlineAt: row.deadline_at,
      submittedAt: row.submitted_at,
      submitReason: row.submit_reason
    };
  });
}

async function finalizeOverdueAttempts(db: AppDb, userId: number) {
  const now = new Date().toISOString();
  const rows = await db.all<AttemptRow[]>(
    `SELECT * FROM exam_attempts
     WHERE user_id = ? AND status = 'active' AND deadline_at <= ?`,
    userId,
    now
  );
  for (const row of rows) {
    await finalizeAttempt(db, row, userId, "timeout");
  }
}

async function maybeExpireAttempt(db: AppDb, row: AttemptRow, userId: number) {
  if (row.status === "active" && new Date(row.deadline_at).getTime() <= Date.now()) {
    return finalizeAttempt(db, row, userId, "timeout");
  }
  return hydrateAttempt(db, row);
}

async function ensureActive(db: AppDb, row: AttemptRow, userId: number) {
  if (row.status !== "active") {
    throw new Error("考试已经提交");
  }
  if (new Date(row.deadline_at).getTime() <= Date.now()) {
    await finalizeAttempt(db, row, userId, "timeout");
    throw new Error("考试已超时并自动提交");
  }
  return row;
}

async function finalizeAttempt(
  db: AppDb,
  row: AttemptRow,
  userId: number,
  reason: ExamSubmitReason
) {
  const questions = await getAttemptQuestions(db, row);
  const answers = parseAnswers(row.answers_json);
  const submittedAt = new Date().toISOString();
  const status: ExamAttemptStatus = reason === "timeout" ? "expired" : "submitted";

  await db.exec("BEGIN TRANSACTION");
  try {
    for (const question of questions) {
      const answer = answers[question.id];
      if (!answer || answer.gradedAt) continue;
      const result = await answerQuestion(db, {
        userId,
        questionId: question.id,
        quizBankId: row.quiz_bank_id,
        answer: answer.answer,
        mode: "new"
      });
      answers[question.id] = {
        ...answer,
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
        gradedAt: submittedAt
      };
    }

    const summary = calculateSummary(questions, answers);
    await db.run(
      `UPDATE exam_attempts
       SET status = ?, answers_json = ?, summary_json = ?, submitted_at = ?, submit_reason = ?
       WHERE id = ? AND status = 'active'`,
      status,
      JSON.stringify(answers),
      JSON.stringify(summary),
      submittedAt,
      reason,
      row.id
    );
    await db.exec("COMMIT");

    return hydrateAttempt(db, {
      ...row,
      status,
      answers_json: JSON.stringify(answers),
      summary_json: JSON.stringify(summary),
      submitted_at: submittedAt,
      submit_reason: reason
    });
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function hydrateAttempt(db: AppDb, row: AttemptRow): Promise<ExamAttemptDetail> {
  const questions = await getAttemptQuestions(db, row);
  const answers = parseAnswers(row.answers_json);
  return {
    id: row.id,
    quizBankId: row.quiz_bank_id,
    status: row.status,
    questions: questions.map(toPublicQuestion),
    answers,
    summary: row.summary_json ? parseSummary(row.summary_json) : calculateSummary(questions, answers),
    includeEssay: Boolean(row.include_essay),
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    submitReason: row.submit_reason
  };
}

async function getAttemptQuestions(db: AppDb, row: AttemptRow) {
  const questionIds = parseQuestionIds(row.question_ids_json);
  if (!questionIds.length) return [];
  const placeholders = questionIds.map(() => "?").join(", ");
  const rows = await db.all<QuestionRow[]>(
    `SELECT * FROM questions
     WHERE quiz_bank_id = ? AND id IN (${placeholders})`,
    row.quiz_bank_id,
    ...questionIds
  );
  const byId = new Map(rows.map((question) => [question.id, question]));
  return questionIds.map((id) => byId.get(id)).filter((question): question is QuestionRow => Boolean(question));
}

function calculateSummary(
  questions: QuestionRow[],
  answers: Record<string, ExamAnswerState>
): ExamSummary {
  const byType = (["single", "judge", "multiple", "essay"] as QuestionType[]).map((type) => {
    const typedQuestions = questions.filter((question) => question.type === type);
    let correct = 0;
    let score = 0;
    const point = pointsForType(type);

    for (const question of typedQuestions) {
      const answer = answers[question.id]?.answer;
      const stored = answers[question.id];
      if (type === "essay" || answer == null) continue;
      if (typeof stored?.isCorrect === "boolean") {
        if (stored.isCorrect) {
          correct += 1;
          score += point;
        }
        continue;
      }
      const graded = gradeAnswer({
        type,
        answer,
        correctAnswer: question.correct_answer,
        options: JSON.parse(question.options_json) as Record<string, string>
      });
      if (graded.isCorrect) {
        correct += 1;
        score += point;
      }
    }

    const answered = typedQuestions.filter((question) => answers[question.id]).length;
    const possibleScore = typedQuestions.length * point;
    return {
      type,
      label: labelForType(type),
      total: typedQuestions.length,
      answered,
      correct,
      wrong: type === "essay" ? 0 : typedQuestions.length - correct,
      score,
      possibleScore
    };
  });

  const score = byType.reduce((sum, row) => sum + row.score, 0);
  const totalScore = byType.reduce((sum, row) => sum + row.possibleScore, 0);
  const essay = byType.find((row) => row.type === "essay");

  return {
    score,
    totalScore,
    answeredCount: Object.keys(answers).length,
    questionCount: questions.length,
    objectiveWrongCount: byType
      .filter((row) => row.type !== "essay")
      .reduce((sum, row) => sum + row.wrong, 0),
    essayCount: essay?.total ?? 0,
    essayAnsweredCount: essay?.answered ?? 0,
    byType
  };
}

async function getOwnedAttemptRow(db: AppDb, userId: number, attemptId: number) {
  const row = await db.get<AttemptRow>(
    "SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?",
    attemptId,
    userId
  );
  if (!row) {
    throw new Error("考试记录不存在");
  }
  return row;
}

async function resolveQuizBankId(db: AppDb, quizBankId?: number) {
  if (quizBankId) {
    const bank = await db.get<{ id: number }>("SELECT id FROM quiz_banks WHERE id = ?", quizBankId);
    if (!bank) throw new Error("题库不存在");
    return bank.id;
  }
  return (await getDefaultQuizBank(db)).id;
}

function parseQuestionIds(raw: string) {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function parseAnswers(raw: string | null) {
  if (!raw) return {} as Record<string, ExamAnswerState>;
  try {
    return JSON.parse(raw) as Record<string, ExamAnswerState>;
  } catch {
    return {};
  }
}

function parseSummary(raw: string | null) {
  if (!raw) {
    return calculateSummary([], {});
  }
  try {
    return JSON.parse(raw) as ExamSummary;
  } catch {
    return calculateSummary([], {});
  }
}

function pointsForType(type: QuestionType) {
  if (type === "single") return 2;
  if (type === "judge") return 1;
  if (type === "multiple") return 4;
  return 0;
}

function labelForType(type: QuestionType) {
  if (type === "single") return "单选题";
  if (type === "judge") return "判断题";
  if (type === "multiple") return "多选题";
  return "简答题";
}
