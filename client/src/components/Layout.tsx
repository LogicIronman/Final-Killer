import { BookOpen, LogOut, NotebookTabs, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Button } from "./ui";

export function Layout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="bg-ink px-4 py-2 text-sm text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span>期末杀手 · 马克思主义基本原理</span>
          <span>{auth.mode === "guest" ? "游客模式：进度仅保存在本机" : "Phase 4"}</span>
        </div>
      </div>
      <header className="border-b border-fog bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3 font-medium">
            <span className="grid h-9 w-9 place-items-center rounded bg-hp-blue text-white">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg">期末杀手</span>
          </Link>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto lg:order-none lg:w-auto">
            <NavItem to="/">主页</NavItem>
            <NavItem to="/practice/new">新题模式</NavItem>
            <NavItem to="/practice/review">复习模式</NavItem>
            <NavItem to="/practice/exam">考试模式</NavItem>
            <NavItem to="/leaderboard">排行榜</NavItem>
            {auth.isAdmin ? <NavItem to="/admin/question-bank">导入题库</NavItem> : null}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="grid h-11 w-11 place-items-center rounded text-ink transition hover:bg-cloud focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-blue"
              aria-label="设置"
              title="设置"
            >
              <Settings className="h-5 w-5" aria-hidden />
            </Link>
            <span className="hidden items-center gap-2 text-sm text-charcoal sm:flex">
              {auth.mode === "authenticated" ? (
                <>
                  <UserRound className="h-4 w-4" aria-hidden />
                  {auth.user?.username}
                </>
              ) : (
                <>
                  <NotebookTabs className="h-4 w-4" aria-hidden />
                  游客
                </>
              )}
            </span>
            <Button
              variant="ghost"
              className="px-3"
              onClick={() => {
                auth.logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              退出
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "shrink-0 rounded px-4 py-3 text-sm font-medium transition",
          isActive ? "bg-ink text-white" : "text-ink hover:bg-cloud"
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
