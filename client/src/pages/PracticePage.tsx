import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import {
  answerGuestQuestion,
  getGuestQuestions,
  getGuestReviewQuestions,
  markGuestQuestion
} from "../guestProgress";
import type { PracticeMode, Question } from "../types";

type Result = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  progress: { status: string; consecutiveCorrect: number };
};

type QuestionSessionState = {
  selected: string[];
  result: Result | null;
};

export function PracticePage({ mode = "new" }: { mode?: PracticeMode }) {
  const auth = useAuth();
  const isReview = mode === "review";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<Record<string, QuestionSessionState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const submittingRef = useRef(false);

  const current = questions[index];
  const currentState = current ? session[current.id] : undefined;
  const selected = currentState?.selected ?? [];
  const result = currentState?.result ?? null;
  const answerText = selected.join("");

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    setIndex(0);
    setSession({});
    try {
      let nextQuestions: Question[];
      if (auth.isGuest) {
        nextQuestions = isReview ? getGuestReviewQuestions(10) : getGuestQuestions(10);
      } else {
        const response = isReview ? await api.reviewQuestions(10) : await api.newQuestions(10);
        nextQuestions = response.questions;
      }
      setQuestions(nextQuestions);
      setMarked(
        Object.fromEntries(nextQuestions.map((question) => [question.id, Boolean(question.isMarked)]))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "题目加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth.isGuest, isReview]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const toggleChoice = useCallback(
    (key: string) => {
      if (!current || result) return;
      if (current.type === "multiple") {
        setSession((previous) => {
          const previousSelected = previous[current.id]?.selected ?? [];
          const nextSelected = previousSelected.includes(key)
            ? previousSelected.filter((item) => item !== key)
            : [...previousSelected, key].sort();
          return { ...previous, [current.id]: { selected: nextSelected, result: null } };
        });
      } else {
        setSession((previous) => ({
          ...previous,
          [current.id]: { selected: [key], result: null }
        }));
      }
    },
    [current, result]
  );

  const submit = useCallback(async () => {
    if (!current || !answerText || result || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = auth.isGuest
        ? answerGuestQuestion(current.id, answerText, mode)
        : await api.answer(current.id, answerText, mode);
      setSession((previous) => ({
        ...previous,
        [current.id]: {
          selected: previous[current.id]?.selected ?? selected,
          result: response
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [answerText, auth.isGuest, current, mode, result, selected]);

  const next = useCallback(() => {
    if (index < questions.length - 1) {
      setIndex((previous) => previous + 1);
    } else {
      void loadQuestions();
    }
  }, [index, loadQuestions, questions.length]);

  const previous = useCallback(() => {
    setIndex((currentIndex) => Math.max(currentIndex - 1, 0));
  }, []);

  async function toggleMarked() {
    if (!current) return;
    const nextValue = !marked[current.id];
    setMarked((previous) => ({ ...previous, [current.id]: nextValue }));
    if (auth.isGuest) {
      markGuestQuestion(current.id, nextValue);
    } else {
      await api.mark(current.id, nextValue);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || event.repeat) return;
      const key = event.key.toUpperCase();
      if (key.length === 1 && key >= "A" && key <= "E" && current.options[key]) {
        toggleChoice(key);
      }
      if (/^[1-5]$/.test(event.key)) {
        const optionKey = Object.keys(current.options)[Number(event.key) - 1];
        if (optionKey) toggleChoice(optionKey);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (result) {
          next();
        } else {
          void submit();
        }
      }
      if (event.key === "ArrowRight" && result) {
        next();
      }
      if (event.key === "ArrowLeft" && index > 0) {
        previous();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, index, next, previous, result, submit, toggleChoice]);

  const optionEntries = useMemo(() => (current ? Object.entries(current.options) : []), [current]);
  const reviewStreak = result?.progress.consecutiveCorrect ?? current?.reviewProgress?.consecutiveCorrect ?? 0;

  if (loading) {
    return (
      <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">
        {isReview ? "正在整理复习队列..." : "正在抽取新题..."}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={isReview ? "复习模式遇到问题" : "刷题遇到问题"}
        body={error}
        action={<Button onClick={loadQuestions}>重新加载</Button>}
      />
    );
  }

  if (!current) {
    return (
      <EmptyState
        title={isReview ? "复习队列已经清空" : "当前没有可抽取的新题"}
        body={
          isReview
            ? "当前没有复习中的题目。新题答错后会自动进入这里，连续答对 3 次后离开复习队列。"
            : "你已经完成了所有未做题，或者当前题库尚未初始化。"
        }
        action={
          isReview ? (
            <Link to="/practice/new">
              <Button>继续做新题</Button>
            </Link>
          ) : (
            <Button onClick={loadQuestions}>再试一次</Button>
          )
        }
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className={result ? (result.isCorrect ? "answer-correct" : "answer-wrong") : ""}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{current.chapter ?? "未分章"}</Badge>
            <Badge>{labelForType(current.type)}</Badge>
            {isReview ? <Badge tone="danger">复习题</Badge> : null}
            <Badge>
              {index + 1} / {questions.length}
            </Badge>
          </div>
          <Button variant="ghost" className="px-3" type="button" onClick={toggleMarked}>
            <Flag className={marked[current.id] ? "h-4 w-4 fill-hp-blue text-hp-blue" : "h-4 w-4"} aria-hidden />
            重点
          </Button>
        </div>

        <h1 className="mt-6 text-2xl font-medium leading-8 md:text-3xl md:leading-10">
          {current.question}
        </h1>

        <div className="mt-8 grid gap-3">
          {optionEntries.map(([key, value]) => {
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                disabled={Boolean(result)}
                onClick={() => toggleChoice(key)}
                className={[
                  "flex min-h-14 items-start gap-4 rounded-2xl border p-4 text-left transition",
                  isSelected ? "border-hp-blue bg-hp-soft" : "border-fog bg-white hover:bg-cloud",
                  result ? "cursor-default" : "cursor-pointer"
                ].join(" ")}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-ink text-sm font-medium text-white">
                  {key}
                </span>
                <span className="leading-7 text-ink">{value}</span>
              </button>
            );
          })}
        </div>

        {result ? (
          <div className={["mt-6 rounded-2xl p-5", result.isCorrect ? "bg-green-50" : "bg-red-50"].join(" ")}>
            <div className="flex items-center gap-2 font-medium">
              {result.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-danger" aria-hidden />
              )}
              {result.isCorrect
                ? isReview && result.progress.status === "done"
                  ? "连续答对 3 次，已完成"
                  : "回答正确"
                : `回答错误，正确答案：${result.correctAnswer}`}
            </div>
            <p className="mt-3 text-sm leading-6 text-charcoal">
              {result.explanation || "这道题暂无解析。"}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-6 mt-8 flex flex-wrap justify-between gap-3 border-t border-fog bg-white px-6 py-4">
          <Button variant="ghost" type="button" disabled={index === 0} onClick={previous}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            上一题
          </Button>
          {result ? (
            <Button type="button" onClick={next}>
              下一题
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" loading={submitting} disabled={!answerText} onClick={submit}>
              提交答案
            </Button>
          )}
        </div>
      </Card>

      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-medium">{isReview ? "复习进度" : "本轮进度"}</h2>
          {isReview ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm text-charcoal">
                <span>当前连续答对</span>
                <span className="font-medium text-ink">{Math.min(reviewStreak, 3)} / 3</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" aria-label={`连续答对 ${Math.min(reviewStreak, 3)} 次`}>
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={[
                      "h-3 rounded",
                      step <= reviewStreak ? "bg-success" : "bg-fog"
                    ].join(" ")}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-5 h-3 rounded-full bg-fog">
            <div
              className="h-full rounded-full bg-hp-blue"
              style={{ width: `${Math.round(((index + (result ? 1 : 0)) / questions.length) * 100)}%` }}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-charcoal">
            A-E 或 1-5 选择，Enter 提交；答题后再按 Enter 进入下一题。左右箭头可回看或前进。
          </p>
        </Card>
        <Card>
          <h2 className="text-xl font-medium">状态规则</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-charcoal">
            {isReview ? (
              <>
                <li>答对：连续次数加 1。</li>
                <li>答错：连续次数归零。</li>
                <li>连续答对 3 次：进入已完成。</li>
              </>
            ) : (
              <>
                <li>答对：进入已完成。</li>
                <li>答错：进入错题本和复习中。</li>
              </>
            )}
            <li>回看：保留本轮选择、结果和解析。</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function labelForType(type: Question["type"]) {
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}
