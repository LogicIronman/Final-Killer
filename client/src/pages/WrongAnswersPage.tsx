import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { getGuestWrongAnswers } from "../guestProgress";
import { useLearningSettings } from "../settings";
import type { WrongAnswer } from "../types";

export function WrongAnswersPage() {
  const auth = useAuth();
  const settings = useLearningSettings();
  const [questions, setQuestions] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    if (auth.isGuest) {
      setQuestions(getGuestWrongAnswers());
      setLoading(false);
      return;
    }

    api
      .wrongAnswers(settings.selectedQuizBankId ?? undefined)
      .then((response) => setQuestions(response.questions))
      .catch((err) => setError(err instanceof Error ? err.message : "错题本加载失败"))
      .finally(() => setLoading(false));
  }, [auth.isGuest, settings.selectedQuizBankId]);

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载错题本...</div>;
  }

  if (error) {
    return <EmptyState title="错题本加载失败" body={error} />;
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        title="错题本还是空的"
        body="新题模式中答错的题会自动进入错题本。先刷一轮题，再回来集中处理薄弱项。"
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
        <h1 className="text-4xl font-medium leading-none">错题本</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
          这里收集所有曾经答错过的题。进入复习模式连续答对 3 次，可以将题目重新标记为已完成。
        </p>
        <div className="mt-4">
          <Link to="/practice/review">
            <Button>开始复习</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {questions.map((question) => (
          <Card key={`${question.quizBankId ?? 0}-${question.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{question.chapter ?? "未分章"}</Badge>
              <Badge>{labelForType(question.type)}</Badge>
              <Badge tone="danger">错 {question.wrongCount} 次</Badge>
              {question.isMarked ? <Badge>重点题</Badge> : null}
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
              <Link to={`/question/${question.id}?bank=${question.quizBankId ?? ""}`}>
                <Button variant="outline">查看详情与历史</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function labelForType(type: WrongAnswer["type"]) {
  if (type === "essay") return "简答题";
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}
