import type {
  ApiEnvelope,
  ChapterProgress,
  ExamAttempt,
  ExamAttemptRecord,
  ExamSchedule,
  LeaderboardEntry,
  PracticeOrderMode,
  PracticeMode,
  Question,
  QuestionBankAdminState,
  QuestionBankPreview,
  QuizBank,
  QuestionDetail,
  Stats,
  User,
  WrongAnswer
} from "./types";

const TOKEN_KEY = "final-killer-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.ok) {
    throw new Error(body.error?.message ?? "请求失败");
  }

  return body.data;
}

export const api = {
  async register(username: string, password: string) {
    return request<{ user: User; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },
  async login(username: string, password: string) {
    return request<{ user: User; token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  },
  async me() {
    return request<{ user: User }>("/api/auth/me");
  },
  async stats() {
    return request<Stats>("/api/progress/stats");
  },
  async quizBanks() {
    return request<{ banks: QuizBank[] }>("/api/quiz-banks");
  },
  async bankStats(quizBankId: number) {
    return request<Stats>(`/api/progress/stats?quizBankId=${quizBankId}`);
  },
  async chapterStats(quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<{ chapters: ChapterProgress[] }>(`/api/progress/chapter-stats${query}`);
  },
  async newQuestions(
    limit = 10,
    quizBankId?: number,
    includeEssay = false,
    orderMode: PracticeOrderMode = "random",
    chapter?: string | null
  ) {
    const params = new URLSearchParams({ limit: String(limit), includeEssay: String(includeEssay) });
    if (quizBankId) params.set("quizBankId", String(quizBankId));
    params.set("orderMode", orderMode);
    if (chapter) params.set("chapter", chapter);
    return request<{ questions: Question[] }>(`/api/questions/new?${params.toString()}`);
  },
  async reviewQuestions(
    limit = 10,
    quizBankId?: number,
    includeEssay = false,
    orderMode: PracticeOrderMode = "random",
    chapter?: string | null
  ) {
    const params = new URLSearchParams({ limit: String(limit), includeEssay: String(includeEssay) });
    if (quizBankId) params.set("quizBankId", String(quizBankId));
    params.set("orderMode", orderMode);
    if (chapter) params.set("chapter", chapter);
    return request<{ questions: Question[] }>(`/api/questions/review?${params.toString()}`);
  },
  async examQuestions(quizBankId?: number, includeEssay = false) {
    const params = new URLSearchParams({ includeEssay: String(includeEssay) });
    if (quizBankId) params.set("quizBankId", String(quizBankId));
    return request<{ questions: Question[] }>(`/api/questions/exam?${params.toString()}`);
  },
  async essayQuestions(limit = 10, quizBankId?: number) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (quizBankId) params.set("quizBankId", String(quizBankId));
    return request<{ questions: Question[] }>(`/api/questions/essay-drill?${params.toString()}`);
  },
  async startExamAttempt(quizBankId?: number, includeEssay = false) {
    return request<ExamAttempt>("/api/exam-attempts/start", {
      method: "POST",
      body: JSON.stringify({ quizBankId, includeEssay })
    });
  },
  async currentExamAttempt(quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<{ attempt: ExamAttempt | null }>(`/api/exam-attempts/current${query}`);
  },
  async saveExamAnswer(attemptId: number, questionId: string, answer: string) {
    return request<ExamAttempt>(`/api/exam-attempts/${attemptId}/answer`, {
      method: "POST",
      body: JSON.stringify({ questionId, answer })
    });
  },
  async submitExamAttempt(attemptId: number) {
    return request<ExamAttempt>(`/api/exam-attempts/${attemptId}/submit`, {
      method: "POST"
    });
  },
  async examAttemptRecords() {
    return request<{ records: ExamAttemptRecord[] }>("/api/exam-attempts");
  },
  async examAttempt(id: number) {
    return request<{ attempt: ExamAttempt }>(`/api/exam-attempts/${id}`);
  },
  async questionDetail(questionId: string, quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<QuestionDetail>(`/api/questions/${questionId}${query}`);
  },
  async answer(questionId: string, answer: string, mode: PracticeMode = "new", quizBankId?: number) {
    return request<{
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string | null;
      progress: { status: string; consecutiveCorrect: number };
    }>("/api/progress/answer", {
      method: "POST",
      body: JSON.stringify({ questionId, quizBankId, answer, mode })
    });
  },
  async wrongAnswers(quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<{ questions: WrongAnswer[] }>(`/api/progress/wrong-answers${query}`);
  },
  async markedQuestions(quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<{ questions: Question[] }>(`/api/progress/marked${query}`);
  },
  async completedQuestions(quizBankId?: number) {
    const query = quizBankId ? `?quizBankId=${quizBankId}` : "";
    return request<{ questions: Question[] }>(`/api/progress/completed${query}`);
  },
  async mark(questionId: string, isMarked: boolean, quizBankId?: number) {
    return request<{ questionId: string; isMarked: boolean }>("/api/progress/mark", {
      method: "POST",
      body: JSON.stringify({ questionId, quizBankId, isMarked })
    });
  },
  async leaderboard() {
    return request<{ entries: LeaderboardEntry[] }>("/api/leaderboard");
  },
  async exams() {
    return request<{ exams: ExamSchedule[] }>("/api/exams");
  },
  async createExam(courseName: string, examAt: string) {
    return request<{ exam: ExamSchedule }>("/api/exams", {
      method: "POST",
      body: JSON.stringify({ courseName, examAt })
    });
  },
  async updateExam(id: number, courseName: string, examAt: string) {
    return request<{ exam: ExamSchedule }>(`/api/exams/${id}`, {
      method: "PUT",
      body: JSON.stringify({ courseName, examAt })
    });
  },
  async deleteExam(id: number) {
    return request<{ id: number; deleted: boolean }>(`/api/exams/${id}`, {
      method: "DELETE"
    });
  },
  async resetQuestion(questionId: string, quizBankId?: number) {
    return request<{ questionId: string; reset: boolean }>("/api/progress/reset", {
      method: "POST",
      body: JSON.stringify({ questionId, quizBankId })
    });
  },
  async questionBankAdmin() {
    return request<QuestionBankAdminState>("/api/admin/question-bank");
  },
  async previewQuestionBank(params: {
    mode: "create" | "update";
    quizBankId?: number;
    bankName: string;
    sourceFileName: string;
    questions: unknown;
  }) {
    return request<{ preview: QuestionBankPreview }>("/api/admin/question-bank/preview", {
      method: "POST",
      body: JSON.stringify(params)
    });
  },
  async importQuestionBank(previewId: string) {
    return request<{ versionId: number; quizBankId: number; questionCount: number; bankName: string }>(
      "/api/admin/question-bank/import",
      { method: "POST", body: JSON.stringify({ previewId }) }
    );
  },
  async rollbackQuestionBank(versionId: number) {
    return request<{
      restoredVersionId: number;
      undoVersionId: number;
      questionCount: number;
      bankName: string;
    }>(`/api/admin/question-bank/versions/${versionId}/rollback`, { method: "POST" });
  },
  async publicAppSettings() {
    return request<{ topGameLink: string }>("/api/app-settings/public");
  },
  async updateTopGameLink(topGameLink: string) {
    return request<{ topGameLink: string }>("/api/app-settings/top-game-link", {
      method: "PUT",
      body: JSON.stringify({ topGameLink })
    });
  }
};
