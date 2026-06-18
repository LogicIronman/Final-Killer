import { lazy, Suspense, useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, UserRound } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Button, Card, Input } from "../components/ui";

const ParticlesBackground = lazy(() => import("../components/ParticlesBackground"));

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (auth.mode === "authenticated" || auth.mode === "guest") {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await auth.login(username, password);
      } else {
        await auth.register(username, password);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative isolate flex min-h-[46vh] overflow-hidden bg-ink px-8 py-8 text-white lg:min-h-screen lg:px-14">
        <Suspense fallback={null}>
          <ParticlesBackground />
        </Suspense>
        <div className="pointer-events-none absolute inset-0 bg-ink/10" aria-hidden />
        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded bg-hp-blue">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-medium">期末杀手</span>
          </div>
          <div className="max-w-2xl py-14">
            <h1 className="text-4xl font-medium leading-none tracking-normal md:text-5xl lg:text-6xl">
              把复习进度变成清晰的下一题。
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-fog">
              面向马克思主义基本原理期末复习：自动记录错题、追踪完成度，让你直接进入刷题状态。
            </p>
          </div>
          <p className="text-sm text-steel">455 题 · 单选 / 多选 / 判断 · 服务器持久化进度</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded bg-cloud">
              <UserRound className="h-5 w-5 text-hp-blue" aria-hidden />
            </div>
            <h2 className="text-3xl font-medium leading-none">
              {mode === "login" ? "登录账号" : "创建账号"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-charcoal">
              登录后进度会保存在服务器。游客模式适合临时刷题，不会同步到数据库。
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">用户名</span>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} required />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">密码</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
            </label>
            {mode === "register" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium">确认密码</span>
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required />
              </label>
            ) : null}

            {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

            <Button className="w-full" loading={loading} type="submit">
              {mode === "login" ? "登录" : "注册"}
            </Button>
          </form>

          <div className="mt-5 grid gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "创建新账号" : "已有账号，去登录"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                auth.enterGuest();
                navigate("/");
              }}
            >
              游客模式进入
            </Button>
          </div>
        </Card>
      </section>
    </main>
  );
}
