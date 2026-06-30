import { Check, GripVertical, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { Reorder, useDragControls, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ScrollListFrame } from "../components/AnimatedList";
import { keyboardEventCode, labelForKeyCode } from "../keyboard";
import { useLearningSettings } from "../settings";
import type { ExamSchedule, PracticeOrderMode, QuizBank } from "../types";
import { Badge, Button, Card } from "../components/ui";

export function SettingsPage() {
  const settings = useLearningSettings();
  const [banks, setBanks] = useState<QuizBank[]>([]);
  const [exams, setExams] = useState<ExamSchedule[]>([]);

  useEffect(() => {
    api.quizBanks().then((response) => setBanks(response.banks)).catch(() => setBanks([]));
    api.exams().then((response) => setExams(response.exams)).catch(() => setExams([]));
  }, []);

  const selectedBankId = settings.selectedQuizBankId ?? banks[0]?.id ?? null;
  const visibleCountdownExams = orderedExams(exams, settings.countdownOrder).filter(
    (exam) => !settings.countdownHiddenExamIds.includes(exam.id)
  );

  return (
    <div className="space-y-8">
      <header>
        <Badge tone="blue">学习设置</Badge>
        <h1 className="mt-4 text-4xl font-medium leading-none">设置</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
          调整默认题库、简答题是否进入刷题池，以及主页考试倒计时的显示方式。
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3">
            <Settings2 className="mt-1 h-5 w-5 text-hp-blue" aria-hidden />
            <div>
              <h2 className="text-xl font-medium">题库与题型</h2>
              <p className="mt-1 text-sm leading-6 text-charcoal">
                首页和刷题页会使用这里选中的题库。关闭简答题后，抽题时只出现选择题和判断题。
              </p>
            </div>
          </div>

          <label className="mt-6 block space-y-2">
            <span className="text-sm font-medium">默认题库</span>
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

          <label className="mt-6 flex items-start gap-3 rounded-lg bg-cloud p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.includeEssay}
              onChange={(event) => settings.setIncludeEssay(event.target.checked)}
            />
            <span>
              <span className="block font-medium">刷题时包含简答题</span>
              <span className="mt-1 block text-sm leading-6 text-charcoal">
                简答题提交后直接显示参考答案，不自动判分；空答案也可以提交。
              </span>
            </span>
          </label>

          <label className="mt-6 block space-y-2">
            <span className="text-sm font-medium">新题模式抽题方式</span>
            <select
              className="h-11 w-full rounded border border-steel bg-white px-4 text-base text-ink outline-none focus:border-ink"
              value={settings.practiceOrderMode}
              onChange={(event) => settings.setPracticeOrderMode(event.target.value as PracticeOrderMode)}
            >
              <option value="random">随机刷题</option>
              <option value="chapter">按章节顺序</option>
            </select>
          </label>

          <div className="mt-6 space-y-2">
            <span className="text-sm font-medium">提交 / 下一题快捷键</span>
            <KeyCaptureButton
              value={settings.nextQuestionKey}
              onChange={settings.setNextQuestionKey}
            />
            <p className="text-sm leading-6 text-charcoal">
              点击按钮后，按下任意键即可绑定；未提交时用于提交答案，出结果后用于进入下一题。
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-medium">倒计时</h2>
          <p className="mt-2 text-sm leading-6 text-charcoal">
            这里采用本地列表管理。删除只会从你的主页倒计时中隐藏，不会删除管理员维护的全站考试日程。
          </p>

          <label className="mt-6 flex items-start gap-3 rounded-lg bg-cloud p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={settings.countdownEnabled}
              onChange={(event) => settings.setCountdownEnabled(event.target.checked)}
            />
            <span>
              <span className="block font-medium">在主页显示考试倒计时</span>
              <span className="mt-1 block text-sm leading-6 text-charcoal">关闭后主页不显示倒计时模块。</span>
            </span>
          </label>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">倒计时列表</h3>
              <Button type="button" variant="ghost" className="px-3" onClick={settings.resetSettings}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                恢复默认
              </Button>
            </div>
            <ScrollListFrame className="mt-3 animated-countdown-list" viewportClassName="max-h-[400px]">
              <Reorder.Group
                axis="y"
                values={visibleCountdownExams.map((exam) => exam.id)}
                onReorder={settings.setCountdownOrder}
                className="space-y-4"
              >
                {visibleCountdownExams.map((exam) => (
                  <CountdownRow
                    key={exam.id}
                    exam={exam}
                    isPrimary={settings.countdownExamId === exam.id}
                    countdownEnabled={settings.countdownEnabled}
                    onPrimary={() => settings.setCountdownExamId(exam.id)}
                    onDelete={() => settings.hideCountdownExam(exam.id)}
                  />
                ))}
                {visibleCountdownExams.length === 0 ? (
                  <p className="rounded-lg bg-cloud p-5 text-sm text-charcoal">当前没有可显示的倒计时。点击恢复默认可重新显示全部日程。</p>
                ) : null}
              </Reorder.Group>
            </ScrollListFrame>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                settings.setCountdownExamId(null);
                settings.setCountdownEnabled(false);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              关闭主页倒计时
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

function KeyCaptureButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [capturing, setCapturing] = useState(false);

  return (
    <button
      type="button"
      className={[
        "flex h-11 w-full items-center justify-between rounded border px-4 text-left text-base transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-blue",
        capturing ? "border-hp-blue bg-hp-soft text-ink" : "border-steel bg-white hover:bg-cloud"
      ].join(" ")}
      onClick={() => setCapturing(true)}
      onKeyDown={(event) => {
        if (!capturing) return;
        event.preventDefault();
        event.stopPropagation();
        onChange(keyboardEventCode(event));
        setCapturing(false);
      }}
      onBlur={() => setCapturing(false)}
    >
      <span>{capturing ? "按下要绑定的键..." : labelForKeyCode(value)}</span>
      <Badge>{capturing ? "监听中" : "点击更改"}</Badge>
    </button>
  );
}

function CountdownRow({
  exam,
  isPrimary,
  countdownEnabled,
  onPrimary,
  onDelete
}: {
  exam: ExamSchedule;
  isPrimary: boolean;
  countdownEnabled: boolean;
  onPrimary: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const rowRef = useRef<HTMLLIElement | null>(null);
  const inView = useInView(rowRef, { amount: 0.5, once: false });

  return (
    <Reorder.Item
      ref={rowRef}
      value={exam.id}
      dragListener={false}
      dragControls={controls}
      layout
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      whileDrag={{ scale: 1.02, boxShadow: "0 14px 26px rgba(26, 26, 26, 0.16)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex cursor-default items-center justify-between gap-4 rounded-lg border border-fog bg-white px-4 py-3 transition-colors hover:border-steel hover:bg-cloud"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{exam.courseName}</p>
          {isPrimary ? <Badge tone="blue">首页优先</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-charcoal">{formatDate(exam.examAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="px-3"
          disabled={!countdownEnabled}
          onClick={onPrimary}
        >
          <Check className="h-4 w-4" aria-hidden />
          设为倒计时
        </Button>
        <Button type="button" variant="ghost" className="px-3 text-danger" onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden />
          删除
        </Button>
        <button
          type="button"
          className="grid h-11 w-11 cursor-grab place-items-center rounded text-charcoal transition hover:bg-fog active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-blue"
          aria-label={`拖动排序：${exam.courseName}`}
          title="拖动排序"
          onPointerDown={(event) => controls.start(event)}
        >
          <GripVertical className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </Reorder.Item>
  );
}

function orderedExams(exams: ExamSchedule[], order: number[]) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}
