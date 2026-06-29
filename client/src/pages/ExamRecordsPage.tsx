import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ExamSummaryTable } from "../components/ExamSummaryTable";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestExamAttempt, getGuestExamAttemptRecords } from "../guestProgress";
import type { ExamAttempt, ExamAttemptRecord } from "../types";

export function ExamRecordsPage() {
  const { id } = useParams();
  return id ? <ExamRecordDetail id={Number(id)} /> : <ExamRecordList />;
}

function ExamRecordList() {
  const auth = useAuth();
  const [records, setRecords] = useState<ExamAttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (auth.isGuest) {
        setRecords(getGuestExamAttemptRecords());
        setLoading(false);
        return;
      }
      api
        .examAttemptRecords()
        .then((response) => setRecords(response.records))
        .catch((err) => setError(err instanceof Error ? err.message : "考试记录加载失败"))
        .finally(() => setLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试记录加载失败");
      setLoading(false);
    }
  }, [auth.isGuest]);

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载考试记录...</div>;
  }

  if (error) {
    return <EmptyState title="考试记录加载失败" body={error} />;
  }

  if (!records.length) {
    return (
      <EmptyState
        title="暂无考试记录"
        body="完成一次考试模式后，这里会保存成绩、题量、交卷时间和提交原因。"
        action={<Link to="/practice/exam"><Button>开始考试</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="blue">考试记录</Badge>
        <h1 className="mt-4 text-3xl font-medium leading-tight">历史考试成绩</h1>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-cloud text-left text-charcoal">
              <tr>
                <th className="px-5 py-4 font-medium">题库</th>
                <th className="px-5 py-4 font-medium">状态</th>
                <th className="px-5 py-4 font-medium">得分</th>
                <th className="px-5 py-4 font-medium">已答/总题</th>
                <th className="px-5 py-4 font-medium">错题数</th>
                <th className="px-5 py-4 font-medium">提交时间</th>
                <th className="px-5 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-fog">
                  <td className="px-5 py-4 font-medium text-ink">{record.quizBankName}</td>
                  <td className="px-5 py-4">
                    <Badge tone={record.status === "expired" ? "danger" : "success"}>
                      {record.status === "expired" ? "超时交卷" : "已交卷"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-charcoal">{record.score} / {record.totalScore}</td>
                  <td className="px-5 py-4 text-charcoal">{record.answeredCount} / {record.questionCount}</td>
                  <td className="px-5 py-4 text-charcoal">{record.objectiveWrongCount}</td>
                  <td className="px-5 py-4 text-charcoal">{formatDate(record.submittedAt ?? record.deadlineAt)}</td>
                  <td className="px-5 py-4">
                    <Link to={`/exam-records/${record.id}`} className="font-medium text-hp-blue">
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ExamRecordDetail({ id }: { id: number }) {
  const auth = useAuth();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (auth.isGuest) {
        setAttempt(getGuestExamAttempt(id));
        setLoading(false);
        return;
      }
      api
        .examAttempt(id)
        .then((response) => setAttempt(response.attempt))
        .catch((err) => setError(err instanceof Error ? err.message : "考试记录加载失败"))
        .finally(() => setLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试记录加载失败");
      setLoading(false);
    }
  }, [auth.isGuest, id]);

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载考试详情...</div>;
  }

  if (error || !attempt) {
    return <EmptyState title="考试详情加载失败" body={error || "考试记录不存在"} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <Badge tone={attempt.status === "expired" ? "danger" : "success"}>
          {attempt.status === "expired" ? "超时交卷" : "已交卷"}
        </Badge>
        <h1 className="mt-4 text-2xl font-medium leading-8">考试详情</h1>
        <p className="mt-3 text-sm leading-6 text-charcoal">
          得分 {attempt.summary.score} / {attempt.summary.totalScore}，简答题 {attempt.summary.essayCount} 道，不计入分数。
        </p>
        <div className="mt-6">
          <ExamSummaryTable summary={attempt.summary} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/exam-records">
            <Button variant="outline">返回记录</Button>
          </Link>
          <Link to="/">
            <Button>返回首页</Button>
          </Link>
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-medium">记录信息</h2>
        <dl className="mt-4 space-y-3 text-sm leading-6 text-charcoal">
          <Row label="开始时间" value={formatDate(attempt.startedAt)} />
          <Row label="截止时间" value={formatDate(attempt.deadlineAt)} />
          <Row label="提交时间" value={attempt.submittedAt ? formatDate(attempt.submittedAt) : "-"} />
          <Row label="提交原因" value={attempt.submitReason === "timeout" ? "超时自动交卷" : "手动交卷"} />
          <Row label="已答题数" value={`${attempt.summary.answeredCount}/${attempt.summary.questionCount}`} />
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-fog pb-3 last:border-b-0 last:pb-0">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
