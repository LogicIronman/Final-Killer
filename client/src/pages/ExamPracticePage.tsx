import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { ExamSummaryTable } from "../components/ExamSummaryTable";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { isActionKey, shouldIgnoreActionKeyInInput } from "../keyboard";
import {
  answerGuestExamAttemptQuestion,
  getGuestCurrentExamAttempt,
  startGuestExamAttempt,
  submitGuestExamAttempt
} from "../guestProgress";
import { useLearningSettings } from "../settings";
import type { ExamAttempt, Question } from "../types";

export function ExamPracticePage() {
  const auth = useAuth();
  const settings = useLearningSettings();
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const autoFinalizingRef = useRef(false);

  const current = attempt?.questions[index] ?? null;
  const currentAnswer = current ? drafts[current.id] ?? "" : "";
  const currentResult = current ? attempt?.answers[current.id] ?? null : null;
  const isLastQuestion = attempt ? index === attempt.questions.length - 1 : false;

  const loadOrStart = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextAttempt = auth.isGuest
        ? getGuestCurrentExamAttempt() ?? startGuestExamAttempt(settings.includeEssay)
        : (await api.currentExamAttempt(settings.selectedQuizBankId ?? undefined)).attempt ??
          (await api.startExamAttempt(settings.selectedQuizBankId ?? undefined, settings.includeEssay));
      setAttempt(nextAttempt);
      setDrafts(Object.fromEntries(Object.entries(nextAttempt.answers).map(([id, value]) => [id, value.answer])));
      setIndex((currentIndex) => Math.min(currentIndex, Math.max(nextAttempt.questions.length - 1, 0)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth.isGuest, settings.includeEssay, settings.selectedQuizBankId]);

  useEffect(() => {
    void loadOrStart();
  }, [loadOrStart]);

  useEffect(() => {
    if (!attempt || attempt.status !== "active") return;
    const activeAttempt = attempt;
    function updateRemaining() {
      const nextRemaining = Math.max(new Date(activeAttempt.deadlineAt).getTime() - Date.now(), 0);
      setRemainingMs(nextRemaining);
      if (nextRemaining === 0 && !autoFinalizingRef.current) {
        autoFinalizingRef.current = true;
        void loadOrStart().finally(() => {
          autoFinalizingRef.current = false;
        });
      }
    }
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, loadOrStart]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadOrStart();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadOrStart]);

  const submitAnswer = useCallback(
    async (questionId: string, answer: string) => {
      if (!attempt || attempt.status !== "active") return;
      if (attempt.answers[questionId]?.gradedAt) return;
      setSaving(true);
      setError("");
      try {
        const nextAttempt = auth.isGuest
          ? answerGuestExamAttemptQuestion(attempt.id, questionId, answer)
          : await api.saveExamAnswer(attempt.id, questionId, answer);
        setAttempt(nextAttempt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "答案保存失败");
        void loadOrStart();
      } finally {
        setSaving(false);
      }
    },
    [attempt, auth.isGuest, loadOrStart]
  );

  const nextQuestion = useCallback(() => {
    if (!attempt) return;
    setIndex((value) => Math.min(value + 1, attempt.questions.length - 1));
  }, [attempt]);

  const previousQuestion = useCallback(() => {
    setIndex((value) => Math.max(value - 1, 0));
  }, []);

  async function submitExam() {
    if (!attempt || attempt.status !== "active") return;
    setSubmitting(true);
    setError("");
    try {
      const nextAttempt = auth.isGuest ? submitGuestExamAttempt(attempt.id) : await api.submitExamAttempt(attempt.id);
      setAttempt(nextAttempt);
      setDrafts(Object.fromEntries(Object.entries(nextAttempt.answers).map(([id, value]) => [id, value.answer])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  const selectAnswer = useCallback((question: Question, answer: string) => {
    if (attempt?.answers[question.id]?.gradedAt) return;
    setDrafts((currentDrafts) => ({ ...currentDrafts, [question.id]: answer }));
  }, [attempt]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!attempt || attempt.status !== "active" || !current || event.repeat) return;
      const actionKeyPressed = isActionKey(event, settings.nextQuestionKey);
      const targetIsEssayInput = current.type === "essay" && event.target instanceof HTMLTextAreaElement;
      const shouldHandleEssayInputAction = targetIsEssayInput && actionKeyPressed && event.code !== "Space";
      if (actionKeyPressed && (shouldHandleEssayInputAction || !shouldIgnoreActionKeyInInput(event))) {
        event.preventDefault();
        if (currentResult?.gradedAt) {
          if (!isLastQuestion) nextQuestion();
          return;
        }
        if (current.type === "essay" || currentAnswer) {
          void submitAnswer(current.id, currentAnswer);
        }
        return;
      }
      const key = event.key.toUpperCase();
      if (!currentResult?.gradedAt && current.type !== "essay" && key.length === 1 && key >= "A" && key <= "E" && current.options[key]) {
        selectAnswer(current, nextChoiceValue(current, currentAnswer, key));
      }
      if (!currentResult?.gradedAt && current.type !== "essay" && /^[1-5]$/.test(event.key)) {
        const optionKey = Object.keys(current.options)[Number(event.key) - 1];
        if (optionKey) selectAnswer(current, nextChoiceValue(current, currentAnswer, optionKey));
      }
      if (event.key === "ArrowLeft" && index > 0) {
        previousQuestion();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    attempt,
    current,
    currentAnswer,
    currentResult,
    index,
    isLastQuestion,
    nextQuestion,
    previousQuestion,
    selectAnswer,
    settings.nextQuestionKey,
    submitAnswer
  ]);

  const answeredCount = useMemo(
    () => Object.values(attempt?.answers ?? {}).filter((answer) => answer.gradedAt).length,
    [attempt?.answers]
  );
  const progressPercent = attempt?.questions.length ? Math.round((answeredCount / attempt.questions.length) * 100) : 0;

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在恢复考试...</div>;
  }

  if (error && !attempt) {
    return <EmptyState title="考试模式遇到问题" body={error} action={<Button onClick={loadOrStart}>重新加载</Button>} />;
  }

  if (!attempt || attempt.questions.length === 0) {
    return (
      <EmptyState
        title="当前题库无法组卷"
        body="考试模式需要题库中至少存在单选、判断或多选题。请确认当前题库内容后再开始考试。"
        action={<Link to="/"><Button>返回首页</Button></Link>}
      />
    );
  }

  if (attempt.status !== "active") {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <Badge tone={attempt.status === "expired" ? "danger" : "success"}>
            {attempt.status === "expired" ? "超时交卷" : "已交卷"}
          </Badge>
          <h1 className="mt-4 text-2xl font-medium leading-8">考试成绩</h1>
          <p className="mt-3 text-sm leading-6 text-charcoal">
            本次得分 {attempt.summary.score} / {attempt.summary.totalScore}，简答题不计入分数。
          </p>
          <div className="mt-6">
            <ExamSummaryTable summary={attempt.summary} />
          </div>
          <div className="mt-6">
            <Link to="/">
              <Button>返回首页</Button>
            </Link>
          </div>
        </Card>
        <ExamSideCard attempt={attempt} answeredCount={attempt.summary.answeredCount} remainingMs={0} progressPercent={100} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{current?.chapter ?? "未分章"}</Badge>
            <Badge>{current ? labelForType(current.type) : "题目"}</Badge>
            <Badge tone="blue">考试模式</Badge>
            <Badge>
              {index + 1} / {attempt.questions.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-charcoal">
            <Clock className="h-4 w-4" aria-hidden />
            {formatRemaining(remainingMs)}
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm leading-6 text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <h1 className="mt-3 text-xl font-medium leading-8 md:mt-4 md:text-2xl md:leading-9">
          {current?.question}
        </h1>

        {current?.type === "essay" ? (
          <label className="mt-6 block space-y-2">
            <span className="text-sm font-medium text-charcoal">你的作答</span>
            <textarea
              className="min-h-28 w-full resize-y rounded-lg border border-fog bg-white p-4 text-base leading-7 text-ink outline-none transition focus:border-ink disabled:bg-cloud"
              value={currentAnswer}
              disabled={Boolean(currentResult?.gradedAt)}
              placeholder="简答题不计分，可以留空。"
              onChange={(event) => setDrafts((currentDrafts) => ({ ...currentDrafts, [current.id]: event.target.value }))}
            />
          </label>
        ) : (
          <div className="mt-6 grid gap-3">
            {Object.entries(current?.options ?? {}).map(([key, value]) => {
              const selected = current?.type === "multiple"
                ? currentAnswer.includes(key)
                : currentAnswer === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(currentResult?.gradedAt)}
                  onClick={() => {
                    if (!current) return;
                    selectAnswer(current, nextChoiceValue(current, currentAnswer, key));
                  }}
                  className={[
                    "flex min-h-14 items-start gap-4 rounded-lg border p-4 text-left transition",
                    selected ? "border-hp-blue bg-hp-soft" : "border-fog bg-white hover:bg-cloud",
                    currentResult?.gradedAt ? "cursor-default" : "cursor-pointer"
                  ].join(" ")}
                >
                  <span className={choiceMarkerClass(current?.type ?? "single")}>{key}</span>
                  <span className="leading-7 text-ink">{value}</span>
                </button>
              );
            })}
          </div>
        )}

        {currentResult?.gradedAt ? (
          <div className={["mb-24 mt-6 rounded-lg p-5 md:mb-6", currentResult.isCorrect ? "bg-green-50" : "bg-red-50"].join(" ")}>
            <div className="flex items-center gap-2 font-medium">
              {currentResult.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-danger" aria-hidden />
              )}
              {current?.type === "essay"
                ? "参考答案"
                : currentResult.isCorrect
                ? "回答正确"
                : `回答错误，正确答案：${currentResult.correctAnswer ?? ""}`}
            </div>
            {current?.type === "essay" ? (
              <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-ink">
                {currentResult.correctAnswer}
              </p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-charcoal">
              {currentResult.explanation || "这道题暂无解析。"}
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-6 mt-8 flex flex-wrap justify-between gap-3 border-t border-fog bg-white px-6 py-4">
          <Button variant="ghost" type="button" disabled={index === 0} onClick={previousQuestion}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            上一题
          </Button>
          <div className="flex flex-wrap gap-3">
            {currentResult?.gradedAt && !isLastQuestion ? (
              <Button type="button" onClick={nextQuestion}>
                下一题
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            {currentResult?.gradedAt && isLastQuestion ? (
              <Button type="button" loading={submitting} onClick={() => void submitExam()}>
                交卷算分
              </Button>
            ) : null}
            {!currentResult?.gradedAt ? (
              <Button
                type="button"
                loading={saving}
                disabled={current?.type !== "essay" && !currentAnswer}
                onClick={() => current && void submitAnswer(current.id, currentAnswer)}
              >
                提交答案
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <aside className="space-y-4">
        <ExamSideCard
          attempt={attempt}
          answeredCount={answeredCount}
          remainingMs={remainingMs}
          progressPercent={progressPercent}
          saving={saving}
        />
        <Card>
          <h2 className="text-xl font-medium">考试规则</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-charcoal">
            <li>单选 20 题，每题 2 分。</li>
            <li>判断 10 题，每题 1 分。</li>
            <li>多选 5 题，每题 4 分。</li>
            <li>简答开启且题库存在时追加 2 题，不计分。</li>
            <li>倒计时 40 分钟，到时自动交卷。</li>
          </ul>
        </Card>
      </aside>
    </div>
  );
}

function ExamSideCard({
  attempt,
  answeredCount,
  remainingMs,
  progressPercent,
  saving = false
}: {
  attempt: ExamAttempt;
  answeredCount: number;
  remainingMs: number;
  progressPercent: number;
  saving?: boolean;
}) {
  return (
    <Card>
      <h2 className="text-xl font-medium">考试进度</h2>
      <div className="mt-5 h-3 rounded-full bg-fog">
        <div className="h-full rounded-full bg-hp-blue transition-all" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Metric label="已答" value={`${answeredCount}/${attempt.questions.length}`} />
        <Metric label="剩余" value={attempt.status === "active" ? formatRemaining(remainingMs) : "00:00"} />
        <Metric label="状态" value={attempt.status === "active" ? (saving ? "保存中" : "已保存") : "已交卷"} />
        <Metric label="时长" value={`${Math.round(attempt.durationSeconds / 60)} 分钟`} />
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-cloud p-3">
      <p className="text-charcoal">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}

function choiceMarkerClass(type: Question["type"]) {
  const base = "grid shrink-0 place-items-center bg-ink text-sm font-medium text-white";
  if (type === "multiple") return `${base} h-7 min-w-11 rounded`;
  return `${base} h-7 w-7 rounded`;
}

function nextChoiceValue(question: Question, currentAnswer: string, key: string) {
  if (question.type !== "multiple") return key;
  const next = currentAnswer.includes(key) ? currentAnswer.replace(key, "") : `${currentAnswer}${key}`;
  return Array.from(new Set(next.split(""))).sort().join("");
}

function labelForType(type: Question["type"]) {
  if (type === "essay") return "简答题";
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}

function formatRemaining(value: number) {
  const totalSeconds = Math.max(Math.ceil(value / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
