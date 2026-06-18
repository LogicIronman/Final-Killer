import { CalendarPlus, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, EmptyState, Input } from "../components/ui";
import type { ExamSchedule } from "../types";

export function AdminExamsPage() {
  const auth = useAuth();
  const [exams, setExams] = useState<ExamSchedule[]>([]);
  const [courseName, setCourseName] = useState("");
  const [examAt, setExamAt] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.isAdmin) {
      setLoading(false);
      return;
    }
    void loadExams();
  }, [auth.isAdmin]);

  async function loadExams() {
    setLoading(true);
    setError("");
    try {
      const response = await api.exams();
      setExams(response.exams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试日程加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function saveExam(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const isoTime = new Date(examAt).toISOString();
      if (editingId === null) {
        await api.createExam(courseName, isoTime);
      } else {
        await api.updateExam(editingId, courseName, isoTime);
      }
      clearForm();
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "考试日程保存失败");
    } finally {
      setSaving(false);
    }
  }

  function editExam(exam: ExamSchedule) {
    setEditingId(exam.id);
    setCourseName(exam.courseName);
    setExamAt(toLocalDateTime(exam.examAt));
    setDeletingId(null);
  }

  async function deleteExam(id: number) {
    setError("");
    try {
      await api.deleteExam(id);
      setDeletingId(null);
      await loadExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function clearForm() {
    setEditingId(null);
    setCourseName("");
    setExamAt("");
  }

  if (!auth.isAdmin) {
    return <EmptyState title="需要管理员权限" body="当前账号不能修改考试日程。" />;
  }

  if (loading) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载考试日程...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Badge tone="blue">管理员</Badge>
        <h1 className="mt-4 text-4xl font-medium leading-none">考试日程</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-charcoal">
          添加多门课程的考试时间。主页会自动选择最近一场作为主倒计时。
        </p>
      </div>

      <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
        <Card>
          <h2 className="text-xl font-medium">{editingId === null ? "添加考试" : "修改考试"}</h2>
          <form className="mt-5 space-y-4" onSubmit={saveExam}>
            <label className="block space-y-2">
              <span className="text-sm font-medium">课程名</span>
              <Input
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                maxLength={80}
                placeholder="例如：马克思主义基本原理"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">考试时间</span>
              <Input
                type="datetime-local"
                value={examAt}
                onChange={(event) => setExamAt(event.target.value)}
                required
              />
            </label>
            {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                <CalendarPlus className="h-4 w-4" aria-hidden />
                {editingId === null ? "添加" : "保存修改"}
              </Button>
              {editingId !== null ? (
                <Button type="button" variant="ghost" disabled={saving} onClick={clearForm}>
                  <X className="h-4 w-4" aria-hidden />
                  取消
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <div>
          <h2 className="text-xl font-medium">全部日程</h2>
          {exams.length ? (
            <div className="mt-4 divide-y divide-fog border-y border-fog">
              {exams.map((exam) => (
                <div key={exam.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div>
                    <p className="font-medium">{exam.courseName}</p>
                    <p className="mt-1 text-sm text-charcoal">{formatDate(exam.examAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" className="px-3" onClick={() => editExam(exam)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      修改
                    </Button>
                    {deletingId === exam.id ? (
                      <>
                        <Button variant="ink" className="px-3" onClick={() => void deleteExam(exam.id)}>
                          确认删除
                        </Button>
                        <Button variant="ghost" className="px-3" onClick={() => setDeletingId(null)}>
                          取消
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" className="px-3 text-danger" onClick={() => setDeletingId(exam.id)}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                        删除
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-cloud p-5 text-sm text-charcoal">暂时没有考试日程。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

