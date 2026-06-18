import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, BookCheck, BookOpen, RotateCcw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestStats } from "../guestProgress";
import type { ExamSchedule, Stats } from "../types";

const ExamCountdown = lazy(() =>
  import("../components/ExamCountdown").then((module) => ({ default: module.ExamCountdown }))
);

export function DashboardPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [exams, setExams] = useState<ExamSchedule[]>([]);

  useEffect(() => {
    if (auth.isGuest) {
      setStats(getGuestStats());
      return;
    }

    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "统计加载失败"));
  }, [auth.isGuest]);

  useEffect(() => {
    api.exams().then((response) => setExams(response.exams)).catch(() => setExams([]));
  }, []);

  if (error) {
    return <EmptyState title="统计加载失败" body={error} />;
  }

  if (!stats) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载仪表盘...</div>;
  }

  const progressPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-cloud p-8">
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-lg bg-fog" aria-label="正在加载考试倒计时" />
            }
          >
            <ExamCountdown exams={exams} canManage={auth.isAdmin} />
          </Suspense>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/practice/new">
              <Button>
                开始新题
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link to="/wrong-answers">
              <Button variant="outline">查看错题本</Button>
            </Link>
            {stats.reviewing > 0 ? (
              <Link to="/practice/review">
                <Button variant="ink">开始复习</Button>
              </Link>
            ) : null}
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
    </div>
  );
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
