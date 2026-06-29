import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestCompletedQuestions } from "../guestProgress";
import { useLearningSettings } from "../settings";
import type { Question } from "../types";

export function CompletedQuestionsPage() {
  const auth = useAuth();
  const settings = useLearningSettings();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    if (auth.isGuest) {
      setQuestions(getGuestCompletedQuestions());
      setLoading(false);
      return;
    }

    api
      .completedQuestions(settings.selectedQuizBankId ?? undefined)
      .then((response) => setQuestions(response.questions))
      .catch((err) => setError(err instanceof Error ? err.message : "已完成题目加载失败"))
      .finally(() => setLoading(false));
  }, [auth.isGuest, settings.selectedQuizBankId]);

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载已完成题目...</div>;
  }

  if (error) return <EmptyState title="已完成题目加载失败" body={error} />;

  if (questions.length === 0) {
    return (
      <EmptyState
        title="还没有已完成题目"
        body="新题一次答对，或复习题连续答对 3 次后，会进入已完成列表。"
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
        <h1 className="text-4xl font-medium leading-none">已完成</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
          当前已经掌握的题目。重置单题进度后，题目会回到未做状态。
        </p>
      </div>

      <div className="grid gap-4">
        {questions.map((question) => (
          <Card key={`${question.quizBankId ?? 0}-${question.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">已完成</Badge>
              <Badge tone="blue">{question.chapter ?? "未分章"}</Badge>
              <Badge>{labelForType(question.type)}</Badge>
              {question.reviewProgress?.wrongCount ? (
                <Badge tone="danger">曾错 {question.reviewProgress.wrongCount} 次</Badge>
              ) : null}
            </div>
            <div className="mt-4 flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-success" aria-hidden />
              <h2 className="text-xl font-medium leading-8">{question.question}</h2>
            </div>
            <div className="mt-5">
              <Link to={`/question/${question.id}?bank=${question.quizBankId ?? ""}`}>
                <Button variant="outline">查看详情</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function labelForType(type: Question["type"]) {
  if (type === "essay") return "简答题";
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}
