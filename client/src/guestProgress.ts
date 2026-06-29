import questions from "../../data/questions.json";
import type {
  PracticeMode,
  ExamAttempt,
  ExamAttemptRecord,
  ExamSubmitReason,
  Question,
  QuestionDetail,
  QuestionProgress,
  Stats,
  WrongAnswer,
  WrongAttempt
} from "./types";

type GuestStatus = "unseen" | "reviewing" | "done";

interface GuestProgress {
  status: GuestStatus;
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  isMarked: boolean;
  lastAnsweredAt: string | null;
  lastWrongAt?: string | null;
  wrongHistory?: WrongAttempt[];
}

const STORAGE_KEY = "final-killer-guest-progress";
const GUEST_EXAM_KEY = "final-killer-guest-exam-attempts";
const questionList = questions as Question[];

export function getGuestQuestions(limit = 10) {
  const progress = readProgress();
  const unseen = questionList.filter(
    (question) => !progress[question.id] || progress[question.id].totalAttempts === 0
  );
  return shuffle(unseen)
    .slice(0, limit)
    .map((question) => ({ ...question, isMarked: progress[question.id]?.isMarked ?? false }));
}

export function getGuestReviewQuestions(limit = 10) {
  const progress = readProgress();
  const candidates = shuffle(
    Object.entries(progress).filter(([, item]) => item.status === "reviewing" && item.wrongCount > 0)
  )
    .sort(([, a], [, b]) => {
      const streakDifference = a.consecutiveCorrect - b.consecutiveCorrect;
      if (streakDifference !== 0) return streakDifference;
      return String(a.lastWrongAt ?? a.lastAnsweredAt).localeCompare(
        String(b.lastWrongAt ?? b.lastAnsweredAt)
      );
    })
    .slice(0, limit);

  return candidates.map(([questionId, item]) => {
    const question = questionList.find((candidate) => candidate.id === questionId)!;
    return {
      ...question,
      isMarked: item.isMarked,
      reviewProgress: {
        consecutiveCorrect: item.consecutiveCorrect,
        wrongCount: item.wrongCount
      }
    };
  });
}

export function getGuestExamQuestions(includeEssay = false) {
  return [
    ...takeByType("single", 20),
    ...takeByType("judge", 10),
    ...takeByType("multiple", 5),
    ...(includeEssay ? takeByType("essay", 2) : [])
  ];
}

export function getGuestEssayQuestions(limit = 10) {
  return takeByType("essay", limit);
}

export function startGuestExamAttempt(includeEssay = false) {
  const current = getGuestCurrentExamAttempt();
  if (current?.status === "active") return current;
  const attempts = readGuestExamAttempts();
  const now = new Date();
  const attempt: ExamAttempt = {
    id: Date.now(),
    quizBankId: 0,
    status: "active",
    questions: getGuestExamQuestions(includeEssay).map((question) => ({ ...question, quizBankId: 0 })),
    answers: {},
    summary: emptyExamSummary(),
    includeEssay,
    durationSeconds: 2400,
    startedAt: now.toISOString(),
    deadlineAt: new Date(now.getTime() + 2400 * 1000).toISOString(),
    submittedAt: null,
    submitReason: null
  };
  writeGuestExamAttempts([attempt, ...attempts]);
  return attempt;
}

export function getGuestCurrentExamAttempt() {
  const attempt = readGuestExamAttempts().find((item) => item.status === "active") ?? null;
  if (!attempt) return null;
  if (new Date(attempt.deadlineAt).getTime() <= Date.now()) {
    return submitGuestExamAttempt(attempt.id, "timeout");
  }
  return attempt;
}

export function answerGuestExamAttemptQuestion(attemptId: number, questionId: string, answer: string) {
  const attempts = readGuestExamAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new Error("考试记录不存在");
  if (attempt.status !== "active") throw new Error("考试已经提交");
  if (new Date(attempt.deadlineAt).getTime() <= Date.now()) {
    submitGuestExamAttempt(attempt.id, "timeout");
    throw new Error("考试已超时并自动提交");
  }
  if (attempt.answers[questionId]?.gradedAt) {
    return attempt;
  }
  const result = answerGuestQuestion(questionId, answer, "new");
  const gradedAt = new Date().toISOString();
  attempt.answers = {
    ...attempt.answers,
    [questionId]: {
      answer,
      answeredAt: gradedAt,
      isCorrect: result.isCorrect,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      gradedAt
    }
  };
  writeGuestExamAttempts(attempts);
  return attempt;
}

export function submitGuestExamAttempt(attemptId: number, reason: ExamSubmitReason = "manual") {
  const attempts = readGuestExamAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new Error("考试记录不存在");
  if (attempt.status !== "active") return attempt;
  for (const question of attempt.questions) {
    const answer = attempt.answers[question.id];
    if (!answer || answer.gradedAt) continue;
    const result = answerGuestQuestion(question.id, answer.answer, "new");
    attempt.answers[question.id] = {
      ...answer,
      isCorrect: result.isCorrect,
      correctAnswer: result.correctAnswer,
      explanation: result.explanation,
      gradedAt: new Date().toISOString()
    };
  }
  attempt.summary = calculateGuestExamSummary(attempt.questions, attempt.answers);
  attempt.status = reason === "timeout" ? "expired" : "submitted";
  attempt.submittedAt = new Date().toISOString();
  attempt.submitReason = reason;
  writeGuestExamAttempts(attempts);
  return attempt;
}

export function getGuestExamAttemptRecords(): ExamAttemptRecord[] {
  return readGuestExamAttempts()
    .map((attempt) => (attempt.status === "active" && new Date(attempt.deadlineAt).getTime() <= Date.now()
      ? submitGuestExamAttempt(attempt.id, "timeout")
      : attempt))
    .filter((attempt) => attempt.status !== "active")
    .map((attempt) => ({
      id: attempt.id,
      quizBankId: attempt.quizBankId,
      quizBankName: "游客本地题库",
      status: attempt.status,
      score: attempt.summary.score,
      totalScore: attempt.summary.totalScore,
      questionCount: attempt.summary.questionCount,
      answeredCount: attempt.summary.answeredCount,
      objectiveWrongCount: attempt.summary.objectiveWrongCount,
      essayCount: attempt.summary.essayCount,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      submitReason: attempt.submitReason
    }));
}

export function getGuestExamAttempt(attemptId: number) {
  const attempt = readGuestExamAttempts().find((item) => item.id === attemptId);
  if (!attempt) throw new Error("考试记录不存在");
  return attempt.status === "active" && new Date(attempt.deadlineAt).getTime() <= Date.now()
    ? submitGuestExamAttempt(attempt.id, "timeout")
    : attempt;
}

export function answerGuestQuestion(
  questionId: string,
  answer: string,
  mode: PracticeMode = "new"
) {
  const question = questionList.find((item) => item.id === questionId);
  if (!question) {
    throw new Error("题目不存在");
  }

  const progress = readProgress();
  const previous = progress[questionId];
  const isCorrect = grade(question, answer);
  const now = new Date().toISOString();
  const consecutiveCorrect = isCorrect ? (previous?.consecutiveCorrect ?? 0) + 1 : 0;
  const status =
    mode === "review"
      ? isCorrect && consecutiveCorrect >= 3
        ? "done"
        : "reviewing"
      : isCorrect
        ? "done"
        : "reviewing";
  const wrongHistory = [...(previous?.wrongHistory ?? [])];
  if (!isCorrect) {
    wrongHistory.push({
      at: now,
      answer: normalize(answer, question),
      correctAnswer: normalizeAnswer(question)
    });
  }

  progress[questionId] = {
    status,
    totalAttempts: (previous?.totalAttempts ?? 0) + 1,
    correctCount: (previous?.correctCount ?? 0) + (isCorrect ? 1 : 0),
    wrongCount: (previous?.wrongCount ?? 0) + (isCorrect ? 0 : 1),
    consecutiveCorrect,
    isMarked: previous?.isMarked ?? false,
    lastAnsweredAt: now,
    lastWrongAt: isCorrect ? previous?.lastWrongAt ?? null : now,
    wrongHistory
  };

  writeProgress(progress);
  return {
    isCorrect,
    correctAnswer: normalizeAnswer(question),
    explanation: question.explanation ?? null,
    progress: { status, consecutiveCorrect }
  };
}

export function markGuestQuestion(questionId: string, isMarked: boolean) {
  const progress = readProgress();
  const previous = progress[questionId];
  progress[questionId] = {
    status: previous?.status ?? "unseen",
    totalAttempts: previous?.totalAttempts ?? 0,
    correctCount: previous?.correctCount ?? 0,
    wrongCount: previous?.wrongCount ?? 0,
    consecutiveCorrect: previous?.consecutiveCorrect ?? 0,
    isMarked,
    lastAnsweredAt: previous?.lastAnsweredAt ?? null,
    lastWrongAt: previous?.lastWrongAt ?? null,
    wrongHistory: previous?.wrongHistory ?? []
  };
  writeProgress(progress);
}

export function getGuestStats(): Stats {
  const progress = readProgress();
  const values = Object.values(progress);
  const done = values.filter((item) => item.status === "done").length;
  const reviewing = values.filter((item) => item.status === "reviewing" && item.wrongCount > 0).length;
  const attempts = values.reduce((sum, item) => sum + item.totalAttempts, 0);
  const correct = values.reduce((sum, item) => sum + item.correctCount, 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = values.filter((item) => item.lastAnsweredAt?.startsWith(todayKey)).length;

  return {
    total: questionList.length,
    done,
    reviewing,
    unseen: Math.max(questionList.length - done - reviewing, 0),
    marked: values.filter((item) => item.isMarked).length,
    attempts,
    correct,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 1000) / 10 : 0,
    today,
    quizBank: { id: 0, name: "游客本地题库", question_count: questionList.length }
  };
}

export function getGuestWrongAnswers(): WrongAnswer[] {
  const progress = readProgress();
  return Object.entries(progress)
    .filter(([, item]) => item.wrongCount > 0)
    .map(([questionId, item]) => {
      const question = questionList.find((candidate) => candidate.id === questionId)!;
      return {
        ...question,
        wrongCount: item.wrongCount,
        consecutiveCorrect: item.consecutiveCorrect,
        lastAnsweredAt: item.lastAnsweredAt,
        isMarked: item.isMarked
      };
    })
    .sort((a, b) => String(b.lastAnsweredAt).localeCompare(String(a.lastAnsweredAt)));
}

export function getGuestMarkedQuestions(): Question[] {
  const progress = readProgress();
  return Object.entries(progress)
    .filter(([, item]) => item.isMarked)
    .map(([questionId]) => {
      const question = questionList.find((candidate) => candidate.id === questionId)!;
      return { ...question, isMarked: true };
    });
}

export function getGuestCompletedQuestions(): Question[] {
  const progress = readProgress();
  return Object.entries(progress)
    .filter(([, item]) => item.status === "done")
    .map(([questionId, item]) => {
      const question = questionList.find((candidate) => candidate.id === questionId)!;
      return {
        ...question,
        isMarked: item.isMarked,
        reviewProgress: {
          consecutiveCorrect: item.consecutiveCorrect,
          wrongCount: item.wrongCount
        }
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getGuestQuestionDetail(questionId: string): QuestionDetail {
  const question = questionList.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error("题目不存在");

  const item = readProgress()[questionId];
  const progress: QuestionProgress | null = item
    ? {
        status: item.status,
        totalAttempts: item.totalAttempts,
        correctCount: item.correctCount,
        wrongCount: item.wrongCount,
        consecutiveCorrect: item.consecutiveCorrect,
        lastAnsweredAt: item.lastAnsweredAt,
        isMarked: item.isMarked,
        wrongHistory: item.wrongHistory ?? []
      }
    : null;

  return {
    question: {
      ...question,
      correctAnswer: question.correctAnswer ?? "",
      isMarked: item?.isMarked ?? false
    },
    progress
  };
}

export function resetGuestQuestion(questionId: string) {
  const progress = readProgress();
  const reset = Boolean(progress[questionId]);
  delete progress[questionId];
  writeProgress(progress);
  return { questionId, reset };
}

function readProgress(): Record<string, GuestProgress> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, GuestProgress>;
  } catch {
    return {};
  }
}

function writeProgress(progress: Record<string, GuestProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function readGuestExamAttempts(): ExamAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_EXAM_KEY) ?? "[]") as ExamAttempt[];
  } catch {
    return [];
  }
}

function writeGuestExamAttempts(attempts: ExamAttempt[]) {
  localStorage.setItem(GUEST_EXAM_KEY, JSON.stringify(attempts));
}

function grade(question: Question, answer: string) {
  if (question.type === "essay") return true;
  return normalize(answer, question) === normalize(question.correctAnswer ?? "", question);
}

function normalizeAnswer(question: Question) {
  return normalize(question.correctAnswer ?? "", question);
}

function normalize(value: string, question: Question) {
  if (question.type === "essay") return value.trim();
  if (question.type === "judge") {
    const trimmed = value.trim();
    const found = Object.entries(question.options).find(([, label]) => label === trimmed);
    return (found?.[0] ?? trimmed).toUpperCase();
  }
  if (question.type === "multiple") {
    return Array.from(new Set(value.toUpperCase().replace(/\s/g, "").split("")))
      .sort()
      .join("");
  }
  return value.trim().toUpperCase();
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function takeByType(type: Question["type"], limit: number) {
  const progress = readProgress();
  return shuffle(questionList.filter((question) => question.type === type))
    .slice(0, limit)
    .map((question) => ({ ...question, isMarked: progress[question.id]?.isMarked ?? false }));
}

function calculateGuestExamSummary(questions: Question[], answers: ExamAttempt["answers"]): ExamAttempt["summary"] {
  const byType = (["single", "judge", "multiple", "essay"] as Question["type"][]).map((type) => {
    const typed = questions.filter((question) => question.type === type);
    const point = pointsForType(type);
    let correct = 0;
    for (const question of typed) {
      const answer = answers[question.id]?.answer;
      const stored = answers[question.id];
      if (type === "essay" || answer == null) continue;
      if (typeof stored?.isCorrect === "boolean") {
        if (stored.isCorrect) correct += 1;
        continue;
      }
      if (grade(question, answer)) correct += 1;
    }
    return {
      type,
      label: labelForType(type),
      total: typed.length,
      answered: typed.filter((question) => answers[question.id]).length,
      correct,
      wrong: type === "essay" ? 0 : typed.length - correct,
      score: correct * point,
      possibleScore: typed.length * point
    };
  });
  const essay = byType.find((row) => row.type === "essay");
  return {
    score: byType.reduce((sum, row) => sum + row.score, 0),
    totalScore: byType.reduce((sum, row) => sum + row.possibleScore, 0),
    answeredCount: Object.keys(answers).length,
    questionCount: questions.length,
    objectiveWrongCount: byType.filter((row) => row.type !== "essay").reduce((sum, row) => sum + row.wrong, 0),
    essayCount: essay?.total ?? 0,
    essayAnsweredCount: essay?.answered ?? 0,
    byType
  };
}

function emptyExamSummary(): ExamAttempt["summary"] {
  return calculateGuestExamSummary([], {});
}

function pointsForType(type: Question["type"]) {
  if (type === "single") return 2;
  if (type === "judge") return 1;
  if (type === "multiple") return 4;
  return 0;
}

function labelForType(type: Question["type"]) {
  if (type === "single") return "单选题";
  if (type === "judge") return "判断题";
  if (type === "multiple") return "多选题";
  return "简答题";
}
