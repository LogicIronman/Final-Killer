export type QuestionType = "single" | "multiple" | "judge";
export type PracticeMode = "new" | "review";

export interface User {
  id: number;
  username: string;
  role: "user" | "admin";
}

export interface ExamSchedule {
  id: number;
  courseName: string;
  examAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  quizBankId?: number;
  question: string;
  options: Record<string, string>;
  correctAnswer?: string;
  chapter: string | null;
  type: QuestionType;
  explanation?: string | null;
  isMarked?: boolean;
  reviewProgress?: {
    consecutiveCorrect: number;
    wrongCount: number;
  };
}

export interface WrongAttempt {
  at: string;
  answer: string;
  correctAnswer: string;
}

export interface QuestionProgress {
  status: "unseen" | "reviewing" | "done";
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  consecutiveCorrect: number;
  lastAnsweredAt: string | null;
  isMarked: boolean;
  wrongHistory: WrongAttempt[];
}

export interface QuestionDetail {
  question: Question & { correctAnswer: string };
  progress: QuestionProgress | null;
}

export interface Stats {
  total: number;
  done: number;
  reviewing: number;
  unseen: number;
  marked: number;
  attempts: number;
  correct: number;
  accuracy: number;
  today: number;
  quizBank?: {
    id: number;
    name: string;
    question_count: number;
  };
}

export interface WrongAnswer extends Question {
  wrongCount: number;
  consecutiveCorrect: number;
  lastAnsweredAt: string | null;
  isMarked: boolean;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
  error: null | {
    code: string;
    message: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  practiceCount: number;
  correctCount: number;
  accuracy: number;
  isCurrentUser: boolean;
}

export interface QuestionBankPreview {
  previewId: string;
  bankName: string;
  sourceFileName: string;
  currentCount: number;
  nextCount: number;
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  unchangedCount: number;
  addedIds: string[];
  updatedIds: string[];
  removedIds: string[];
  expiresAt: string;
}

export interface QuestionBankVersion {
  id: number;
  bankName: string;
  sourceFileName: string;
  questionCount: number;
  createdBy: number;
  createdAt: string;
  reason: "import" | "rollback";
}

export interface QuestionBankAdminState {
  bank: { id: number; name: string; questionCount: number };
  latestVersion: QuestionBankVersion | null;
  versions: QuestionBankVersion[];
}
