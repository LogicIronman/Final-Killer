import type {
  ApiEnvelope,
  ExamSchedule,
  LeaderboardEntry,
  PracticeMode,
  Question,
  QuestionBankAdminState,
  QuestionBankPreview,
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
  async newQuestions(limit = 10) {
    return request<{ questions: Question[] }>(`/api/questions/new?limit=${limit}`);
  },
  async reviewQuestions(limit = 10) {
    return request<{ questions: Question[] }>(`/api/questions/review?limit=${limit}`);
  },
  async questionDetail(questionId: string) {
    return request<QuestionDetail>(`/api/questions/${questionId}`);
  },
  async answer(questionId: string, answer: string, mode: PracticeMode = "new") {
    return request<{
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string | null;
      progress: { status: string; consecutiveCorrect: number };
    }>("/api/progress/answer", {
      method: "POST",
      body: JSON.stringify({ questionId, answer, mode })
    });
  },
  async wrongAnswers() {
    return request<{ questions: WrongAnswer[] }>("/api/progress/wrong-answers");
  },
  async markedQuestions() {
    return request<{ questions: Question[] }>("/api/progress/marked");
  },
  async completedQuestions() {
    return request<{ questions: Question[] }>("/api/progress/completed");
  },
  async mark(questionId: string, isMarked: boolean) {
    return request<{ questionId: string; isMarked: boolean }>("/api/progress/mark", {
      method: "POST",
      body: JSON.stringify({ questionId, isMarked })
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
  async resetQuestion(questionId: string) {
    return request<{ questionId: string; reset: boolean }>("/api/progress/reset", {
      method: "POST",
      body: JSON.stringify({ questionId })
    });
  },
  async questionBankAdmin() {
    return request<QuestionBankAdminState>("/api/admin/question-bank");
  },
  async previewQuestionBank(params: {
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
    return request<{ versionId: number; questionCount: number; bankName: string }>(
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
  }
};
