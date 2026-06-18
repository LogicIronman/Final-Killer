import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestMarkedQuestions, markGuestQuestion } from "../guestProgress";
import type { Question } from "../types";

export function MarkedQuestionsPage() {
  const auth = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    if (auth.isGuest) {
      setQuestions(getGuestMarkedQuestions());
      setLoading(false);
      return;
    }

    api
      .markedQuestions()
      .then((response) => setQuestions(response.questions))
      .catch((err) => setError(err instanceof Error ? err.message : "重点题加载失败"))
      .finally(() => setLoading(false));
  }, [auth.isGuest]);

  async function removeMarked(questionId: string) {
    setUpdatingId(questionId);
    setError("");
    try {
      if (auth.isGuest) {
        markGuestQuestion(questionId, false);
      } else {
        await api.mark(questionId, false);
      }
      setQuestions((current) => current.filter((question) => question.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消重点失败");
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载重点题...</div>;
  }

  if (questions.length === 0 && !error) {
    return (
      <EmptyState
        title="还没有重点题"
        body="刷题时点击重点标记，需要集中回看的题目会出现在这里。"
        action={
          <Link to="/practice/new">
            <Button>开始新题</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-medium leading-none">重点题</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
          主动标记需要反复查看的题目。重点状态不影响题目的未做、复习中或已完成状态。
        </p>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
      </div>

      <div className="grid gap-4">
        {questions.map((question) => (
          <Card key={question.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{question.chapter ?? "未分章"}</Badge>
                <Badge>{labelForType(question.type)}</Badge>
                <Badge>重点题</Badge>
              </div>
              <Button
                variant="ghost"
                className="px-3"
                loading={updatingId === question.id}
                onClick={() => void removeMarked(question.id)}
              >
                <Flag className="h-4 w-4 fill-hp-blue text-hp-blue" aria-hidden />
                取消重点
              </Button>
            </div>
            <h2 className="mt-4 text-xl font-medium leading-8">{question.question}</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(question.options).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-cloud px-4 py-3 text-sm leading-6">
                  <span className="mr-2 font-medium">{key}.</span>
                  {value}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-charcoal">
              {question.explanation ?? "暂无解析。"}
            </p>
            <div className="mt-5">
              <Link to={`/question/${question.id}`}>
                <Button variant="outline">查看题目详情</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function labelForType(type: Question["type"]) {
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}
