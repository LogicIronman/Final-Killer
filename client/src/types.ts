export type QuestionType = "single" | "multiple" | "judge" | "essay";
export type PracticeMode = "new" | "review";
export type PracticeViewMode = PracticeMode | "exam" | "essay";
export type PracticeOrderMode = "random" | "chapter";
export type NextQuestionKey = string;

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

export interface ChapterProgress {
  chapter: string;
  total: number;
  done: number;
  reviewing: number;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface QuizBank {
  id: number;
  name: string;
  description: string | null;
  questionCount: number;
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

export type ExamAttemptStatus = "active" | "submitted" | "expired";
export type ExamSubmitReason = "manual" | "timeout";

export interface ExamAnswerState {
  answer: string;
  answeredAt: string;
  isCorrect?: boolean;
  correctAnswer?: string;
  explanation?: string | null;
  gradedAt?: string;
}

export interface ExamSummaryRow {
  type: QuestionType;
  label: string;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  score: number;
  possibleScore: number;
}

export interface ExamSummary {
  score: number;
  totalScore: number;
  answeredCount: number;
  questionCount: number;
  objectiveWrongCount: number;
  essayCount: number;
  essayAnsweredCount: number;
  byType: ExamSummaryRow[];
}

export interface ExamAttempt {
  id: number;
  quizBankId: number;
  status: ExamAttemptStatus;
  questions: Question[];
  answers: Record<string, ExamAnswerState>;
  summary: ExamSummary;
  includeEssay: boolean;
  durationSeconds: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  submitReason: string | null;
}

export interface ExamAttemptRecord {
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
}

export interface QuestionBankPreview {
  previewId: string;
  mode: "create" | "update";
  quizBankId: number | null;
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
  reason: "import" | "rollback" | "create";
}

export interface QuestionBankAdminState {
  bank: { id: number; name: string; questionCount: number };
  banks: QuizBank[];
  latestVersion: QuestionBankVersion | null;
  versions: QuestionBankVersion[];
}
