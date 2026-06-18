export type QuestionType = "single" | "multiple" | "judge";
export type ProgressStatus = "unseen" | "reviewing" | "done";
export type PracticeMode = "new" | "review";

export interface QuestionInput {
  id: string;
  question: string;
  options: Record<string, string>;
  correctAnswer: string;
  chapter?: string;
  type: QuestionType;
  explanation?: string;
}

export interface QuestionRow {
  id: string;
  quiz_bank_id: number;
  question: string;
  options_json: string;
  correct_answer: string;
  chapter: string | null;
  type: QuestionType;
  explanation: string | null;
  is_marked?: number;
  consecutive_correct?: number;
  wrong_count?: number;
}

export interface PublicQuestion {
  id: string;
  quizBankId: number;
  question: string;
  options: Record<string, string>;
  chapter: string | null;
  type: QuestionType;
  explanation?: string | null;
  isMarked: boolean;
  reviewProgress?: {
    consecutiveCorrect: number;
    wrongCount: number;
  };
}

export interface AuthUser {
  id: number;
  username: string;
  role: "user" | "admin";
}
