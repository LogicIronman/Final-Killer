import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { CompletedQuestionsPage } from "./pages/CompletedQuestionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MarkedQuestionsPage } from "./pages/MarkedQuestionsPage";
import { PracticePage } from "./pages/PracticePage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { WrongAnswersPage } from "./pages/WrongAnswersPage";

const AdminExamsPage = lazy(() =>
  import("./pages/AdminExamsPage").then((module) => ({ default: module.AdminExamsPage }))
);
const AdminQuestionBankPage = lazy(() =>
  import("./pages/AdminQuestionBankPage").then((module) => ({ default: module.AdminQuestionBankPage }))
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((module) => ({ default: module.LeaderboardPage }))
);

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireSession>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/practice/new" element={<PracticePage />} />
                  <Route path="/practice/review" element={<PracticePage mode="review" />} />
                  <Route path="/completed" element={<CompletedQuestionsPage />} />
                  <Route path="/question/:id" element={<QuestionDetailPage />} />
                  <Route path="/wrong-answers" element={<WrongAnswersPage />} />
                  <Route path="/marked" element={<MarkedQuestionsPage />} />
                  <Route path="/leaderboard" element={<LazyPage><LeaderboardPage /></LazyPage>} />
                  <Route path="/admin/exams" element={<LazyPage><AdminExamsPage /></LazyPage>} />
                  <Route path="/admin/question-bank" element={<LazyPage><AdminQuestionBankPage /></LazyPage>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </RequireSession>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载页面...</div>
      }
    >
      {children}
    </Suspense>
  );
}

function RequireSession({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.mode === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-white text-ink">
        <div className="rounded-2xl bg-cloud px-6 py-4 text-sm">正在恢复登录状态...</div>
      </div>
    );
  }

  if (auth.mode === "anonymous") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
