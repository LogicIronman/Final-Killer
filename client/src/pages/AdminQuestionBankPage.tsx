import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  RotateCcw,
  ShieldCheck,
  Upload
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import type {
  QuestionBankAdminState,
  QuestionBankPreview,
  QuestionBankVersion
} from "../types";
import { Badge, Button, Card, EmptyState, Input } from "../components/ui";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function AdminQuestionBankPage() {
  const auth = useAuth();
  const [state, setState] = useState<QuestionBankAdminState | null>(null);
  const [mode, setMode] = useState<"create" | "update">("update");
  const [targetBankId, setTargetBankId] = useState<number | null>(null);
  const [bankName, setBankName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileReadError, setFileReadError] = useState("");
  const [preview, setPreview] = useState<QuestionBankPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rollbackId, setRollbackId] = useState<number | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextState = await api.questionBankAdmin();
      setState(nextState);
      const firstBank = nextState.banks[0] ?? nextState.bank;
      setTargetBankId((current) => current ?? firstBank.id);
      setBankName((current) => current || firstBank.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "题库信息加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isAdmin) void loadState();
  }, [auth.isAdmin, loadState]);

  async function validateFile() {
    if (!file) {
      setError("请选择 JSON 题库文件");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("题库文件不能超过 5 MB");
      return;
    }

    setWorking(true);
    setError("");
    setSuccess("");
    setPreview(null);
    try {
      if (fileReadError) {
        setError(fileReadError);
        return;
      }
      if (fileText == null) {
        setError("文件仍在读取中，请稍后再试");
        return;
      }
      const questions = JSON.parse(fileText) as unknown;
      const response = await api.previewQuestionBank({
        mode,
        quizBankId: mode === "update" ? targetBankId ?? undefined : undefined,
        bankName,
        sourceFileName: file.name,
        questions
      });
      setPreview(response.preview);
    } catch (err) {
      setError(err instanceof SyntaxError ? "文件不是有效的 JSON" : err instanceof Error ? err.message : "题库校验失败");
    } finally {
      setWorking(false);
    }
  }

  async function applyImport() {
    if (!preview) return;
    setWorking(true);
    setError("");
    try {
      const result = await api.importQuestionBank(preview.previewId);
      setSuccess(
        mode === "create"
          ? `已新建题库“${result.bankName}”，共 ${result.questionCount} 道题。`
          : `已更新 ${result.questionCount} 道题，旧题库已保存为版本 #${result.versionId}。`
      );
      setPreview(null);
      setFile(null);
      setFileText(null);
      setFileReadError("");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "题库导入失败");
    } finally {
      setWorking(false);
    }
  }

  async function rollback(version: QuestionBankVersion) {
    setWorking(true);
    setError("");
    try {
      const result = await api.rollbackQuestionBank(version.id);
      setSuccess(`已回滚到版本 #${result.restoredVersionId}，回滚前状态保存为版本 #${result.undoVersionId}。`);
      setRollbackId(null);
      setPreview(null);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "题库回滚失败");
    } finally {
      setWorking(false);
    }
  }

  if (!auth.isAdmin) {
    return <EmptyState title="需要管理员权限" body="当前账号不能上传、导入或回滚题库。" />;
  }

  if (loading && !state) {
    return <div className="rounded-2xl bg-cloud p-6 text-sm text-charcoal">正在加载题库管理...</div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <Badge tone="blue">管理员</Badge>
        <h1 className="mt-4 text-4xl font-medium leading-none">题库管理</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-charcoal">
          上传 JSON 后先执行完整校验并查看差异。确认导入时系统会自动备份当前题库，历史版本可随时回滚。
        </p>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="flex items-start gap-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-success" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{success}</span>
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-hp-soft text-hp-deep">
              <Upload className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-medium">上传并校验</h2>
              <p className="mt-1 text-sm leading-6 text-charcoal">仅接受不超过 5 MB 的 JSON 数组，校验通过不会立即修改线上题库。</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium">导入方式</span>
              <select
                className="h-11 w-full rounded border border-steel bg-white px-4 text-base text-ink outline-none focus:border-ink"
                value={mode}
                onChange={(event) => {
                  const nextMode = event.target.value as "create" | "update";
                  setMode(nextMode);
                  setPreview(null);
                  if (nextMode === "create") setBankName("");
                  if (nextMode === "update") {
                    const bank = state?.banks.find((item) => item.id === targetBankId) ?? state?.banks[0];
                    setBankName(bank?.name ?? "");
                    setTargetBankId(bank?.id ?? null);
                  }
                }}
              >
                <option value="update">更新已有题库</option>
                <option value="create">导入为新题库</option>
              </select>
            </label>
            {mode === "update" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium">目标题库</span>
                <select
                  className="h-11 w-full rounded border border-steel bg-white px-4 text-base text-ink outline-none focus:border-ink"
                  value={targetBankId ?? ""}
                  onChange={(event) => {
                    const id = Number(event.target.value);
                    setTargetBankId(id);
                    setBankName(state?.banks.find((bank) => bank.id === id)?.name ?? "");
                    setPreview(null);
                  }}
                >
                  {state?.banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}（{bank.questionCount} 题）
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block space-y-2">
              <span className="text-sm font-medium">题库名称</span>
              <Input value={bankName} maxLength={100} onChange={(event) => setBankName(event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">JSON 文件</span>
              <input
                type="file"
                accept="application/json,.json"
                className="block min-h-11 w-full rounded border border-steel bg-white text-sm text-charcoal file:mr-4 file:min-h-11 file:border-0 file:bg-cloud file:px-4 file:font-medium file:text-ink hover:file:bg-hp-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-blue"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  setFileText(null);
                  setFileReadError("");
                  setPreview(null);
                  setSuccess("");
                  setError("");
                  if (!nextFile) return;
                  void nextFile
                    .text()
                    .then(setFileText)
                    .catch(() => {
                      setFileReadError(
                        "无法读取这个文件。请确认文件没有被移动、删除、云盘占用或权限限制；建议复制到本地普通目录后重新选择。"
                      );
                    });
                }}
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" loading={working && !preview} onClick={() => void validateFile()}>
              <ShieldCheck className="h-4 w-4" aria-hidden />
              校验并预览差异
            </Button>
            {file ? <span className="text-sm text-charcoal">{file.name} · {formatBytes(file.size)}</span> : null}
          </div>
        </Card>

        <aside className="rounded-2xl bg-cloud p-6">
          <p className="text-sm font-medium text-charcoal">当前线上题库</p>
          <p className="mt-3 text-2xl font-medium text-ink">{state?.bank.name ?? "-"}</p>
          <p className="mt-2 text-sm text-charcoal">{state?.bank.questionCount ?? 0} 道题</p>
          <div className="mt-6 border-t border-fog pt-5 text-sm leading-6 text-charcoal">
            更新已有题库时会保留已有题目的答题进度和计数；导入为新题库时会新增一个独立科目。
          </div>
        </aside>
      </section>

      {preview ? <DiffPreview preview={preview} working={working} onImport={() => void applyImport()} onCancel={() => setPreview(null)} /> : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-medium">备份版本</h2>
            <p className="mt-2 text-sm text-charcoal">每次导入和回滚前都会生成完整快照，最多显示最近 30 个版本。</p>
          </div>
          <Button variant="ghost" className="px-3" disabled={loading || working} onClick={() => void loadState()}>
            刷新
          </Button>
        </div>

        {state?.versions.length ? (
          <div className="mt-5 overflow-x-auto border-y border-fog">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-cloud text-charcoal">
                <tr>
                  <th className="px-4 py-3 font-medium">版本</th>
                  <th className="px-4 py-3 font-medium">题库</th>
                  <th className="px-4 py-3 font-medium">题数</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fog">
                {state.versions.map((version) => (
                  <tr key={version.id}>
                    <td className="px-4 py-4 font-medium">#{version.id}</td>
                    <td className="px-4 py-4">{version.bankName}</td>
                    <td className="px-4 py-4 tabular-nums">{version.questionCount}</td>
                    <td className="px-4 py-4 text-charcoal">{formatDate(version.createdAt)}</td>
                    <td className="px-4 py-4 text-charcoal">
                      {version.reason === "import"
                        ? "导入前备份"
                        : version.reason === "create"
                          ? "新建题库记录"
                          : "回滚前备份"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {rollbackId === version.id ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="ink" className="px-3" loading={working} onClick={() => void rollback(version)}>确认回滚</Button>
                          <Button variant="ghost" className="px-3" disabled={working} onClick={() => setRollbackId(null)}>取消</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" className="px-3" disabled={working} onClick={() => setRollbackId(version.id)}>
                          <RotateCcw className="h-4 w-4" aria-hidden />
                          回滚到此版本
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="还没有备份版本" body="首次导入新题库时，系统会在这里保存当前题库快照。" />
        )}
        {rollbackId !== null ? (
          <p className="mt-3 text-sm text-danger" role="alert">回滚会恢复该版本的题目、学习进度和每日统计；当前状态会先自动备份。</p>
        ) : null}
      </section>
    </div>
  );
}

function DiffPreview({
  preview,
  working,
  onImport,
  onCancel
}: {
  preview: QuestionBankPreview;
  working: boolean;
  onImport: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-2xl border border-hp-blue bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileJson className="mt-0.5 h-6 w-6 text-hp-blue" aria-hidden />
          <div>
            <h2 className="text-xl font-medium">差异预览</h2>
            <p className="mt-1 text-sm text-charcoal">{preview.sourceFileName} · 校验通过 · 预览 30 分钟内有效</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" disabled={working} onClick={onCancel}>取消</Button>
          <Button loading={working} onClick={onImport}>
            {preview.mode === "create" ? "创建题库" : "备份并更新"}
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-y border-fog py-5">
        <DiffMetric label={preview.mode === "create" ? "新题库题数" : "导入后"} value={preview.nextCount} />
        <DiffMetric label="新增" value={preview.addedCount} tone="success" />
        <DiffMetric label="修改" value={preview.updatedCount} tone="blue" />
        <DiffMetric label="删除" value={preview.removedCount} tone="danger" />
        <DiffMetric label="不变" value={preview.unchangedCount} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <IdList title="新增题目" ids={preview.addedIds} empty="无新增" />
        <IdList title="内容变更" ids={preview.updatedIds} empty="无修改" />
        <IdList title="将被删除" ids={preview.removedIds} empty="无删除" danger />
      </div>
    </section>
  );
}

function DiffMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "blue" | "success" | "danger" }) {
  const colors = { neutral: "text-ink", blue: "text-hp-blue", success: "text-success", danger: "text-danger" };
  return <div><p className="text-sm text-charcoal">{label}</p><p className={`mt-1 text-2xl font-medium tabular-nums ${colors[tone]}`}>{value}</p></div>;
}

function IdList({ title, ids, empty, danger = false }: { title: string; ids: string[]; empty: string; danger?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {ids.length ? (
        <div className="mt-2 max-h-32 overflow-y-auto rounded bg-cloud p-3 font-mono text-xs leading-6">
          {ids.map((id) => <div key={id} className={danger ? "text-danger" : "text-ink"}>{id}</div>)}
        </div>
      ) : <p className="mt-2 text-sm text-charcoal">{empty}</p>}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(value));
}
