import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { AnimatedList } from "../components/AnimatedList";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { isActionKey, labelForKeyCode, shouldIgnoreActionKeyInInput } from "../keyboard";
import { useLearningSettings } from "../settings";
import {
  answerGuestQuestion,
  getGuestChapterStats,
  getGuestExamQuestions,
  getGuestEssayQuestions,
  getGuestQuestions,
  getGuestReviewQuestions,
  markGuestQuestion
} from "../guestProgress";
import type { PracticeMode, PracticeViewMode, Question } from "../types";
import type { ChapterProgress } from "../types";

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

export function PracticePage({ mode = "new" }: { mode?: PracticeViewMode }) {
  const auth = useAuth();
  const settings = useLearningSettings();
  const isReview = mode === "review";
  const isExam = mode === "exam";
  const isEssayDrill = mode === "essay";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<Record<string, QuestionSessionState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [chapters, setChapters] = useState<ChapterProgress[]>([]);
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
        nextQuestions = isExam
          ? getGuestExamQuestions(settings.includeEssay)
          : isEssayDrill
            ? getGuestEssayQuestions(10)
          : isReview
            ? getGuestReviewQuestions(
                10,
                settings.includeEssay,
                settings.practiceOrderMode,
                settings.practiceOrderMode === "chapter" ? settings.selectedChapter : null
              )
            : getGuestQuestions(
                10,
                settings.includeEssay,
                settings.practiceOrderMode,
                settings.practiceOrderMode === "chapter" ? settings.selectedChapter : null
              );
      } else {
        const response = isExam
          ? await api.examQuestions(settings.selectedQuizBankId ?? undefined, settings.includeEssay)
          : isEssayDrill
            ? await api.essayQuestions(10, settings.selectedQuizBankId ?? undefined)
          : isReview
            ? await api.reviewQuestions(
                10,
                settings.selectedQuizBankId ?? undefined,
                settings.includeEssay,
                settings.practiceOrderMode,
                settings.practiceOrderMode === "chapter" ? settings.selectedChapter : null
              )
            : await api.newQuestions(
                10,
                settings.selectedQuizBankId ?? undefined,
                settings.includeEssay,
                settings.practiceOrderMode,
                settings.practiceOrderMode === "chapter" ? settings.selectedChapter : null
              );
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
  }, [
    auth.isGuest,
    isEssayDrill,
    isExam,
    isReview,
    settings.includeEssay,
    settings.practiceOrderMode,
    settings.selectedChapter,
    settings.selectedQuizBankId
  ]);

  const loadChapters = useCallback(async () => {
    if (isExam || isEssayDrill) return;
    if (auth.isGuest) {
      setChapters(getGuestChapterStats());
      return;
    }
    try {
      const response = await api.chapterStats(settings.selectedQuizBankId ?? undefined);
      setChapters(response.chapters);
    } catch {
      setChapters([]);
    }
  }, [auth.isGuest, isEssayDrill, isExam, isReview, settings.selectedQuizBankId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    void loadChapters();
  }, [loadChapters, questions]);

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
    if (!current || (!answerText && current.type !== "essay") || result || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = auth.isGuest
        ? answerGuestQuestion(current.id, answerText, answerMode(mode))
        : await api.answer(current.id, answerText, answerMode(mode), current.quizBankId);
      setSession((previous) => ({
        ...previous,
        [current.id]: {
          selected: previous[current.id]?.selected ?? selected,
          result: response
        }
      }));
      void loadChapters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [answerText, auth.isGuest, current, loadChapters, mode, result, selected]);

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
      await api.mark(current.id, nextValue, current.quizBankId);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || event.repeat) return;
      const actionKeyPressed = isActionKey(event, settings.nextQuestionKey);
      const targetIsEssayInput = current.type === "essay" && event.target instanceof HTMLTextAreaElement;
      const shouldHandleEssayInputAction = targetIsEssayInput && actionKeyPressed && event.code !== "Space";
      if (actionKeyPressed && (shouldHandleEssayInputAction || !shouldIgnoreActionKeyInInput(event))) {
        event.preventDefault();
        if (result) {
          next();
        } else {
          void submit();
        }
        return;
      }
      const key = event.key.toUpperCase();
      if (current.type !== "essay" && key.length === 1 && key >= "A" && key <= "E" && current.options[key]) {
        toggleChoice(key);
      }
      if (current.type !== "essay" && /^[1-5]$/.test(event.key)) {
        const optionKey = Object.keys(current.options)[Number(event.key) - 1];
        if (optionKey) toggleChoice(optionKey);
      }
      if (event.key === "ArrowLeft" && index > 0) {
        previous();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, index, next, previous, result, settings.nextQuestionKey, submit, toggleChoice]);

  const optionEntries = useMemo(() => (current ? Object.entries(current.options) : []), [current]);
  const isEssay = current?.type === "essay";
  const reviewStreak = result?.progress.consecutiveCorrect ?? current?.reviewProgress?.consecutiveCorrect ?? 0;
  const nextKeyLabel = labelForKeyCode(settings.nextQuestionKey);
  const nextChapter = nextAvailableChapter(chapters, settings.selectedChapter, isReview);
  const activeChapterIndex =
    settings.practiceOrderMode === "chapter" && settings.selectedChapter
      ? Math.max(chapters.findIndex((chapter) => chapter.chapter === settings.selectedChapter) + 1, 0)
      : 0;

  if (loading) {
    return (
      <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">
        {isEssayDrill ? "正在抽取简答题..." : isReview ? "正在整理复习队列..." : "正在抽取新题..."}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={isEssayDrill ? "抽背模式遇到问题" : isReview ? "复习模式遇到问题" : "刷题遇到问题"}
        body={error}
        action={<Button onClick={loadQuestions}>重新加载</Button>}
      />
    );
  }

  if (!current) {
    return (
      <EmptyState
        title={emptyStateTitle({
          isEssayDrill,
          isReview,
          orderMode: settings.practiceOrderMode,
          selectedChapter: settings.selectedChapter
        })}
        body={
          isEssayDrill
            ? "抽背模式只使用简答题。请确认当前题库已经导入 type 为 essay 的题目。"
            : isReview
            ? "当前没有复习中的题目。新题答错后会自动进入这里，连续答对 2 次后离开复习队列。"
            : "当前新题已刷完，请前往复习模式处理仍需巩固的题目。"
        }
        action={
          !isEssayDrill ? (
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={isReview ? "/practice/new" : "/practice/review"}>
                <Button variant={isReview ? "outline" : "ink"}>
                  {isReview ? "继续做新题" : "前往复习模式"}
                </Button>
              </Link>
              {settings.practiceOrderMode === "chapter" && nextChapter ? (
                <Button
                  type="button"
                  onClick={() => {
                    settings.setSelectedChapter(nextChapter.chapter);
                  }}
                >
                  下一章
                </Button>
              ) : null}
            </div>
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
            {isExam ? <Badge tone="blue">考试模式</Badge> : null}
            {isEssayDrill ? <Badge tone="blue">抽背模式</Badge> : null}
            <Badge>
              {index + 1} / {questions.length}
            </Badge>
          </div>
          <Button variant="ghost" className="px-3" type="button" onClick={toggleMarked}>
            <Flag className={marked[current.id] ? "h-4 w-4 fill-hp-blue text-hp-blue" : "h-4 w-4"} aria-hidden />
            重点
          </Button>
        </div>

        <h1 className="mt-3 text-xl font-medium leading-8 md:mt-4 md:text-2xl md:leading-9">
          {current.question}
        </h1>

        {isEssay ? (
          <label className="mt-8 block space-y-2">
            <span className="text-sm font-medium text-charcoal">你的作答</span>
            <textarea
              className="min-h-28 w-full resize-y rounded-lg border border-fog bg-white p-4 text-base leading-7 text-ink outline-none transition focus:border-ink disabled:bg-cloud"
              disabled={Boolean(result)}
              value={selected[0] ?? ""}
              placeholder="可以留空，提交后直接查看参考答案。"
              onChange={(event) =>
                setSession((previous) => ({
                  ...previous,
                  [current.id]: { selected: [event.target.value], result: null }
                }))
              }
            />
          </label>
        ) : (
          <div className="mt-6 grid gap-3">
            {optionEntries.map(([key, value]) => {
              const isSelected = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(result)}
                  onClick={() => toggleChoice(key)}
                  className={[
                    "flex min-h-14 items-start gap-4 rounded-lg border p-4 text-left transition",
                    isSelected ? "border-hp-blue bg-hp-soft" : "border-fog bg-white hover:bg-cloud",
                    result ? "cursor-default" : "cursor-pointer"
                  ].join(" ")}
                >
                  <span className={choiceMarkerClass(current.type)}>
                    {key}
                  </span>
                  <span className="leading-7 text-ink">{value}</span>
                </button>
              );
            })}
          </div>
        )}

        {result ? (
          <div className={["mb-24 mt-6 rounded-lg p-5 md:mb-6", result.isCorrect ? "bg-green-50" : "bg-red-50"].join(" ")}>
            <div className="flex items-center gap-2 font-medium">
              {result.isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
              ) : (
                <XCircle className="h-5 w-5 text-danger" aria-hidden />
              )}
              {isEssay
                ? "参考答案"
                : result.isCorrect
                ? isReview && result.progress.status === "done"
                  ? "连续答对 2 次，已完成"
                  : "回答正确"
                : `回答错误，正确答案：${result.correctAnswer}`}
            </div>
            {isEssay ? (
              <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-ink">
                {result.correctAnswer}
              </p>
            ) : null}
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-charcoal">
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
            <Button type="button" loading={submitting} disabled={!isEssay && !answerText} onClick={submit}>
              提交答案
            </Button>
          )}
        </div>
      </Card>

      <aside className="space-y-4">
        <Card>
          <h2 className="text-xl font-medium">{isEssayDrill ? "抽背进度" : isExam ? "考试进度" : isReview ? "复习进度" : "本轮进度"}</h2>
          {isReview ? (
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm text-charcoal">
                <span>当前连续答对</span>
                <span className="font-medium text-ink">{Math.min(reviewStreak, 2)} / 2</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2" aria-label={`连续答对 ${Math.min(reviewStreak, 2)} 次`}>
                {[1, 2].map((step) => (
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
            {isEssayDrill ? "抽背模式只出现简答题，提交后直接查看参考答案。" : isExam ? "考试模式按单选、判断、多选、简答分段组卷。" : `A-E 或 1-5 选择，按 ${nextKeyLabel} 提交；答题后再按 ${nextKeyLabel} 进入下一题。左箭头可回看。`}
          </p>
        </Card>
        {!isExam && !isEssayDrill ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-medium">{isReview ? "章节复习" : "章节刷题"}</h2>
              <Badge>{settings.practiceOrderMode === "chapter" ? "章节顺序" : "随机"}</Badge>
            </div>
            <AnimatedList
              className="mt-4"
              viewportClassName="max-h-80"
              items={[null, ...chapters]}
              keyForItem={(chapter) => chapter?.chapter ?? "all"}
              activeIndex={activeChapterIndex}
              onItemSelect={(chapter) => {
                if (chapter) {
                  settings.setPracticeOrderMode("chapter");
                  settings.setSelectedChapter(chapter.chapter);
                } else {
                  settings.setPracticeOrderMode("random");
                  settings.setSelectedChapter(null);
                }
              }}
              renderItem={(chapter) =>
                chapter ? (
                  <ChapterButton
                    chapter={chapter}
                    selected={settings.practiceOrderMode === "chapter" && settings.selectedChapter === chapter.chapter}
                    isReview={isReview}
                  />
                ) : (
                  <button
                    type="button"
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                      settings.practiceOrderMode === "random" ? "border-hp-blue bg-hp-soft" : "border-fog hover:bg-cloud"
                    ].join(" ")}
                  >
                    全部章节
                  </button>
                )
              }
            />
            <p className="mt-4 text-sm leading-6 text-charcoal">
              点击全部章节会进入随机模式；点击单个章节会按该章节顺序抽取{isReview ? "复习题" : "未做题"}。
            </p>
          </Card>
        ) : null}
        <Card>
          <h2 className="text-xl font-medium">状态规则</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-charcoal">
            {isEssayDrill ? (
              <>
                <li>题型：只抽简答题。</li>
                <li>提交：允许留空，提交后显示参考答案。</li>
                <li>计数：提交后计入刷题进度。</li>
              </>
            ) : isExam ? (
              <>
                <li>组卷：20 单选、10 判断、5 多选。</li>
                <li>简答：开启且题库存在时追加 2 题。</li>
                <li>提交：沿用普通刷题的判分与进度规则。</li>
              </>
            ) : isReview ? (
              <>
                <li>答对：连续次数加 1。</li>
                <li>答错：连续次数归零。</li>
                <li>连续答对 2 次：进入已完成。</li>
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

function answerMode(mode: PracticeViewMode): PracticeMode {
  return mode === "review" ? "review" : "new";
}

function choiceMarkerClass(type: Question["type"]) {
  const base = "grid shrink-0 place-items-center bg-ink text-sm font-medium text-white";
  if (type === "multiple") return `${base} h-7 min-w-11 rounded`;
  return `${base} h-7 w-7 rounded`;
}

function labelForType(type: Question["type"]) {
  if (type === "essay") return "简答题";
  if (type === "multiple") return "多选题";
  if (type === "judge") return "判断题";
  return "单选题";
}

function emptyStateTitle({
  isEssayDrill,
  isReview,
  orderMode,
  selectedChapter
}: {
  isEssayDrill: boolean;
  isReview: boolean;
  orderMode: "random" | "chapter";
  selectedChapter: string | null;
}) {
  if (isEssayDrill) return "当前题库没有简答题";
  if (isReview) return "复习队列已经清空";
  if (orderMode === "chapter" && selectedChapter) return "当前章节新题已刷完";
  return "目前新题已刷完";
}

function nextAvailableChapter(chapters: ChapterProgress[], selectedChapter: string | null, isReview: boolean) {
  if (!selectedChapter) return null;
  const selectedIndex = chapters.findIndex((chapter) => chapter.chapter === selectedChapter);
  if (selectedIndex === -1) return null;
  return chapters.slice(selectedIndex + 1).find((chapter) => {
    if (isReview) return chapter.reviewing > 0;
    return Math.max(chapter.total - chapter.done - chapter.reviewing, 0) > 0;
  }) ?? null;
}

function ChapterButton({ chapter, selected, isReview }: { chapter: ChapterProgress; selected: boolean; isReview: boolean }) {
  const unavailableCount = isReview ? chapter.reviewing : Math.max(chapter.total - chapter.done - chapter.reviewing, 0);
  const isUnavailable = unavailableCount <= 0;
  return (
    <button
      type="button"
      className={[
        "w-full rounded-lg border px-3 py-3 text-left transition",
        selected ? "border-hp-blue bg-hp-soft" : "border-fog hover:bg-cloud"
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{chapter.chapter}</span>
        <span className="text-charcoal">{chapter.done}/{chapter.total}</span>
      </span>
      <span className="mt-2 block h-2 rounded-full bg-fog">
        <span
          className={[
            "block h-full rounded-full transition-all",
            isUnavailable ? "bg-steel" : "bg-hp-blue"
          ].join(" ")}
          style={{ width: `${chapter.total ? Math.round((chapter.done / chapter.total) * 100) : 0}%` }}
        />
      </span>
    </button>
  );
}
