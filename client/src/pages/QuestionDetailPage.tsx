import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestQuestionDetail, resetGuestQuestion } from "../guestProgress";
import type { QuestionDetail } from "../types";

export function QuestionDetailPage() {
  const auth = useAuth();
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const quizBankId = searchParams.get("bank") ? Number(searchParams.get("bank")) : undefined;
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    try {
      if (auth.isGuest) {
        setDetail(getGuestQuestionDetail(id));
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "题目加载失败");
      setLoading(false);
      return;
    }

    api
      .questionDetail(id, quizBankId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "题目加载失败"))
      .finally(() => setLoading(false));
  }, [auth.isGuest, id, quizBankId]);

  async function resetProgress() {
    setResetting(true);
    setError("");
    try {
      if (auth.isGuest) {
        resetGuestQuestion(id);
      } else {
        await api.resetQuestion(id, quizBankId);
      }
      setDetail((current) => (current ? { ...current, progress: null } : current));
      setConfirmReset(false);
      setNotice("这道题已重置为未做题。每日历史统计不会回滚。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置进度失败");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载题目详情...</div>;
  }

  if (error && !detail) return <EmptyState title="题目详情加载失败" body={error} />;
  if (!detail) return <EmptyState title="题目不存在" body="无法找到这道题，题库可能已经更新。" />;

  const { question, progress } = detail;
  const correctKeys = normalizeCorrectKeys(question.correctAnswer, question.options);

  return (
    <div className="space-y-6">
      <Link to={progress?.status === "reviewing" ? "/practice/review" : "/"} className="inline-flex items-center gap-2 text-sm font-medium text-hp-blue">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        返回学习页面
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{question.chapter ?? "未分章"}</Badge>
          <Badge>{labelForType(question.type)}</Badge>
          <Badge tone={progress?.status === "done" ? "success" : progress?.status === "reviewing" ? "danger" : "neutral"}>
            {statusLabel(progress?.status)}
          </Badge>
          {progress?.isMarked ? <Badge>重点题</Badge> : null}
        </div>

        <h1 className="mt-6 text-2xl font-medium leading-9 md:text-3xl md:leading-10">
          {question.question}
        </h1>

        {question.type === "essay" ? (
          <div className="mt-7 rounded-lg bg-green-50 p-5">
            <h2 className="font-medium text-success">参考答案</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{question.correctAnswer}</p>
          </div>
        ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {Object.entries(question.options).map(([key, value]) => {
            const isCorrect = correctKeys.includes(key.toUpperCase());
            return (
              <div
                key={key}
                className={[
                  "rounded-lg px-4 py-3 text-sm leading-6",
                  isCorrect ? "bg-green-50 text-ink" : "bg-cloud text-charcoal"
                ].join(" ")}
              >
                <span className="mr-2 font-medium">{key}.</span>
                {value}
                {isCorrect ? <span className="ml-2 font-medium text-success">正确答案</span> : null}
              </div>
            );
          })}
        </div>
        )}

        <div className="mt-6 rounded-lg bg-cloud p-5">
          <h2 className="font-medium">题目解析</h2>
          <p className="mt-2 text-sm leading-6 text-charcoal">{question.explanation ?? "暂无解析。"}</p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-4">
        <ProgressMetric label="累计答题" value={progress?.totalAttempts ?? 0} />
        <ProgressMetric label="累计答对" value={progress?.correctCount ?? 0} />
        <ProgressMetric label="累计答错" value={progress?.wrongCount ?? 0} />
        <ProgressMetric label="连续答对" value={progress?.consecutiveCorrect ?? 0} />
      </section>

      <Card>
        <h2 className="text-xl font-medium">错误历史</h2>
        {progress?.wrongHistory.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="border-b border-fog text-charcoal">
                <tr>
                  <th className="px-3 py-3 font-medium">时间</th>
                  <th className="px-3 py-3 font-medium">你的答案</th>
                  <th className="px-3 py-3 font-medium">正确答案</th>
                </tr>
              </thead>
              <tbody>
                {progress.wrongHistory.map((attempt, index) => (
                  <tr key={`${attempt.at}-${index}`} className="border-b border-fog last:border-0">
                    <td className="px-3 py-3 text-charcoal">{formatDate(attempt.at)}</td>
                    <td className="px-3 py-3 font-medium text-danger">{attempt.answer || "未识别"}</td>
                    <td className="px-3 py-3 font-medium text-success">{attempt.correctAnswer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-charcoal">这道题目前没有错误记录。</p>
        )}
      </Card>

      <section className="rounded-2xl bg-cloud p-6">
        <h2 className="text-xl font-medium">重置单题进度</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal">
          重置会删除这道题的状态、错误历史和重点标记，使它重新进入未做题。每日历史统计不会回滚。
        </p>
        {notice ? <p className="mt-3 text-sm font-medium text-success" role="status">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {!confirmReset ? (
            <Button variant="outline" disabled={!progress} onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              重置进度
            </Button>
          ) : (
            <>
              <Button variant="ink" loading={resetting} onClick={() => void resetProgress()}>
                确认重置
              </Button>
              <Button variant="ghost" disabled={resetting} onClick={() => setConfirmReset(false)}>
                取消
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-cloud p-5">
      <p className="text-sm text-charcoal">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
    </div>
  );
}

function normalizeCorrectKeys(answer: string, options: Record<string, string>) {
  const trimmed = answer.trim();
  const byLabel = Object.entries(options).find(([, label]) => label.trim() === trimmed);
  return (byLabel?.[0] ?? trimmed).toUpperCase().split("");
}

function statusLabel(status?: string) {
  if (status === "done") return "已完成";
  if (status === "reviewing") return "复习中";
  return "未做";
}

function labelForType(type: QuestionDetail["question"]["type"]) {
  if (type === "essay") return "简答题";
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
}
