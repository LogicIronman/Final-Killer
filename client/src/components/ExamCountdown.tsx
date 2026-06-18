import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ExamSchedule } from "../types";
import { Badge, Button } from "./ui";

export function ExamCountdown({
  exams,
  canManage = false
}: {
  exams: ExamSchedule[];
  canManage?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(
    () =>
      exams
        .filter((exam) => new Date(exam.examAt).getTime() > now)
        .sort((a, b) => new Date(a.examAt).getTime() - new Date(b.examAt).getTime()),
    [exams, now]
  );
  const selected = upcoming.find((exam) => exam.id === selectedId) ?? upcoming[0];

  if (!selected) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <CalendarClock className="h-7 w-7 text-hp-blue" aria-hidden />
          <h1 className="text-3xl font-medium leading-tight">考试日程待添加</h1>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-charcoal">
          当前没有尚未开始的考试。管理员添加课程和考试时间后，这里会自动显示倒计时。
        </p>
        {canManage ? (
          <Link to="/admin/exams" className="mt-5 inline-block">
            <Button>
              <Settings2 className="h-4 w-4" aria-hidden />
              管理考试日程
            </Button>
          </Link>
        ) : null}
      </div>
    );
  }

  const remaining = getRemaining(new Date(selected.examAt).getTime() - now);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">最近考试</Badge>
            <span className="text-sm text-charcoal">{formatExamDate(selected.examAt)}</span>
          </div>
          <h1 className="mt-4 text-2xl font-medium leading-tight md:text-3xl">
            距离{selected.courseName}考试
          </h1>
        </div>
        {canManage ? (
          <Link to="/admin/exams">
            <Button variant="ghost" className="px-3">
              <Settings2 className="h-4 w-4" aria-hidden />
              管理
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-4" aria-live="off">
        <TimeUnit label="天" value={remaining.days} reduceMotion={Boolean(reduceMotion)} />
        <TimeUnit label="时" value={remaining.hours} reduceMotion={Boolean(reduceMotion)} />
        <TimeUnit label="分" value={remaining.minutes} reduceMotion={Boolean(reduceMotion)} />
        <TimeUnit label="秒" value={remaining.seconds} reduceMotion={Boolean(reduceMotion)} />
      </div>

      {upcoming.length > 1 ? (
        <div className="mt-7 border-t border-fog pt-5">
          <p className="text-sm font-medium">其他考试</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {upcoming.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => setSelectedId(exam.id)}
                className={[
                  "min-h-11 shrink-0 rounded border px-4 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-blue",
                  exam.id === selected.id
                    ? "border-hp-blue bg-hp-soft text-hp-deep"
                    : "border-steel bg-white text-ink hover:bg-cloud"
                ].join(" ")}
              >
                <span className="block font-medium">{exam.courseName}</span>
                <span className="mt-1 block text-xs text-charcoal">{formatExamDate(exam.examAt)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeUnit({
  label,
  value,
  reduceMotion
}: {
  label: string;
  value: number;
  reduceMotion: boolean;
}) {
  const formatted = String(value).padStart(2, "0");
  return (
    <div className="min-w-0 rounded-lg bg-ink px-2 py-4 text-center text-white sm:px-4">
      <div className="relative h-9 overflow-hidden sm:h-12">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={formatted}
            initial={reduceMotion ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: -18, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="absolute inset-0 text-3xl font-medium leading-9 tabular-nums sm:text-5xl sm:leading-[3rem]"
          >
            {formatted}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-2 block text-xs text-steel">{label}</span>
    </div>
  );
}

function getRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

function formatExamDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

