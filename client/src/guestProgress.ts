import questions from "../../data/questions.json";
import type {
  PracticeMode,
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

function grade(question: Question, answer: string) {
  return normalize(answer, question) === normalize(question.correctAnswer ?? "", question);
}

function normalizeAnswer(question: Question) {
  return normalize(question.correctAnswer ?? "", question);
}

function normalize(value: string, question: Question) {
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
