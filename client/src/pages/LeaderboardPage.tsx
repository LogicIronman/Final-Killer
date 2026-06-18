import { useEffect, useState } from "react";
import { BarChart3, LogIn } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, EmptyState } from "../components/ui";
import type { LeaderboardEntry } from "../types";

export function LeaderboardPage() {
  const auth = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(!auth.isGuest);
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (auth.isGuest) return;

    setLoading(true);
    api
      .leaderboard()
      .then((response) => setEntries(response.entries))
      .catch((err) => setError(err instanceof Error ? err.message : "排行榜加载失败"))
      .finally(() => setLoading(false));
  }, [auth.isGuest]);

  if (auth.isGuest) {
    return (
      <EmptyState
        title="登录后查看排行榜"
        body="排行榜统计注册用户累计提交答案的次数。游客进度只保存在本机，不参与全站排名。"
        action={
          <Link to="/login">
            <Button>
              <LogIn className="h-4 w-4" aria-hidden />
              前往登录
            </Button>
          </Link>
        }
      />
    );
  }

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在统计排行榜...</div>;
  }

  if (error) {
    return <EmptyState title="排行榜加载失败" body={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-medium leading-none">卷狗排行榜</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
            按累计提交答案次数排名；次数相同时，累计正确数更高的用户优先。
          </p>
        </div>
        <Badge tone="blue">{entries.length} 位用户</Badge>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="bg-ink text-sm text-white">
              <tr>
                <th className="px-5 py-4 font-medium">排名</th>
                <th className="px-5 py-4 font-medium">用户</th>
                <th className="px-5 py-4 text-right font-medium">刷题量</th>
                <th className="px-5 py-4 text-right font-medium">答对</th>
                <th className="px-5 py-4 text-right font-medium">正确率</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <motion.tr
                  key={`${entry.rank}-${entry.username}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.36),
                    ease: "easeOut"
                  }}
                  className={entry.isCurrentUser ? "bg-hp-soft" : "border-b border-fog last:border-0"}
                >
                  <td className="px-5 py-4 font-medium">#{entry.rank}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 font-medium">
                      {entry.username}
                      {entry.isCurrentUser ? <Badge tone="blue">我</Badge> : null}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-lg font-medium">{entry.practiceCount}</td>
                  <td className="px-5 py-4 text-right">{entry.correctCount}</td>
                  <td className="px-5 py-4 text-right">{entry.accuracy}%</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {entries.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-charcoal">
            <BarChart3 className="h-5 w-5" aria-hidden />
            暂无可展示的用户数据。
          </div>
        ) : null}
      </div>
    </div>
  );
}
