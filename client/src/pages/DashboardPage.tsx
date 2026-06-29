import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, BookCheck, BookOpen, ClipboardList, FileQuestion, Flag, History, RotateCcw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestStats } from "../guestProgress";
import { useLearningSettings } from "../settings";
import type { ExamSchedule, QuizBank, Stats } from "../types";

const ExamCountdown = lazy(() =>
  import("../components/ExamCountdown").then((module) => ({ default: module.ExamCountdown }))
);

export function DashboardPage() {
  const auth = useAuth();
  const settings = useLearningSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [exams, setExams] = useState<ExamSchedule[]>([]);
  const [banks, setBanks] = useState<QuizBank[]>([]);

  const selectedBankId = settings.selectedQuizBankId ?? banks[0]?.id ?? null;

  useEffect(() => {
    if (auth.isGuest) {
      setStats(getGuestStats());
      return;
    }

    if (!selectedBankId) return;
    api
      .bankStats(selectedBankId)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "统计加载失败"));
  }, [auth.isGuest, selectedBankId]);

  useEffect(() => {
    api.exams().then((response) => setExams(response.exams)).catch(() => setExams([]));
    api.quizBanks().then((response) => setBanks(response.banks)).catch(() => setBanks([]));
  }, []);

  if (error) {
    return <EmptyState title="统计加载失败" body={error} />;
  }

  if (!stats) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载仪表盘...</div>;
  }

  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const visibleExams = orderExams(
    exams.filter((exam) => !settings.countdownHiddenExamIds.includes(exam.id)),
    settings.countdownOrder
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-cloud p-8">
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-lg bg-fog" aria-label="正在加载考试倒计时" />
            }
          >
            {settings.countdownEnabled ? (
              <ExamCountdown
                exams={visibleExams}
                canManage={auth.isAdmin}
                preferredExamId={settings.countdownExamId}
              />
            ) : (
              <div>
                <Badge>倒计时已关闭</Badge>
                <h1 className="mt-4 text-3xl font-medium leading-tight">专注刷题模式</h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-charcoal">
                  你已在设置中关闭主页倒计时。需要恢复时可前往设置页。
                </p>
              </div>
            )}
          </Suspense>
          {!auth.isGuest && banks.length ? (
            <label className="mt-8 block max-w-md space-y-2">
              <span className="text-sm font-medium">当前题库</span>
              <select
                className="h-11 w-full rounded border border-steel bg-white px-4 text-base text-ink outline-none focus:border-ink"
                value={selectedBankId ?? ""}
                onChange={(event) => settings.setSelectedQuizBankId(Number(event.target.value))}
              >
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}（{bank.questionCount} 题）
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/practice/new">
              <Button>
                开始新题
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link to="/practice/review">
              <Button variant="ink">开始复习</Button>
            </Link>
            <Link to="/practice/exam">
              <Button variant="outline">考试模式</Button>
            </Link>
            <Link to="/practice/essay">
              <Button variant="outline">抽背模式</Button>
            </Link>
          </div>
        </div>
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-charcoal">完成进度</p>
              <p className="mt-2 text-5xl font-medium leading-none">{progressPercent}%</p>
            </div>
            <Target className="h-8 w-8 text-hp-blue" aria-hidden />
          </div>
          <div className="mt-8 h-3 rounded-full bg-fog">
            <div
              className="h-full rounded-full bg-hp-blue transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <Metric label="总题数" value={stats.total} />
            <Metric label="今日刷题" value={stats.today} />
            <Metric label="正确率" value={`${stats.accuracy}%`} />
            <Metric label="重点题" value={stats.marked} to="/marked" />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<BookOpen />} label="未做题" value={stats.unseen} to="/practice/new" />
        <StatCard icon={<RotateCcw />} label="复习中" value={stats.reviewing} to="/practice/review" />
        <StatCard icon={<BookCheck />} label="已完成" value={stats.done} to="/completed" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink icon={<ClipboardList />} label="错题本" body="集中处理曾经答错的题目" to="/wrong-answers" />
        <QuickLink icon={<Flag />} label="重点题" body="查看主动标记的复习题" to="/marked" />
        <QuickLink icon={<BookCheck />} label="已完成" body="回看已经掌握的题目" to="/completed" />
        <QuickLink icon={<FileQuestion />} label="抽背模式" body="只刷简答题，提交后看参考答案" to="/practice/essay" />
        <QuickLink icon={<History />} label="考试记录" body="查看考试成绩、交卷原因和题型明细" to="/exam-records" />
        {auth.isAdmin ? (
          <QuickLink icon={<BookOpen />} label="题库管理" body="导入、更新或新建题库" to="/admin/question-bank" />
        ) : null}
        {auth.isAdmin ? (
          <QuickLink icon={<Target />} label="考试管理" body="维护全站考试日程" to="/admin/exams" />
        ) : null}
      </section>
    </div>
  );
}

function orderExams(exams: ExamSchedule[], order: number[]) {
  if (!order.length) return exams;
  return [...exams].sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return new Date(a.examAt).getTime() - new Date(b.examAt).getTime();
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

function Metric({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const content = (
    <div className="h-full rounded-lg bg-cloud p-4 transition hover:bg-fog">
      <p className="text-charcoal">{label}</p>
      <p className="mt-1 text-xl font-medium">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function StatCard({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="block">
      <Card className="flex h-full items-center justify-between transition hover:bg-cloud">
      <div>
        <p className="text-sm text-charcoal">{label}</p>
        <p className="mt-2 text-3xl font-medium">{value}</p>
      </div>
      <span className="grid h-11 w-11 place-items-center rounded bg-cloud text-hp-blue">
        {icon}
      </span>
      </Card>
    </Link>
  );
}

function QuickLink({ icon, label, body, to }: { icon: ReactNode; label: string; body: string; to: string }) {
  return (
    <Link to={to} className="block">
      <Card className="h-full transition hover:bg-cloud">
        <span className="grid h-10 w-10 place-items-center rounded bg-cloud text-hp-blue">{icon}</span>
        <h2 className="mt-4 font-medium">{label}</h2>
        <p className="mt-2 text-sm leading-6 text-charcoal">{body}</p>
      </Card>
    </Link>
  );
}
