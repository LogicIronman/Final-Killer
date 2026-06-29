import type { ExamSummary } from "../types";

export function ExamSummaryTable({ summary }: { summary: ExamSummary }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-fog">
      <table className="w-full min-w-[680px] border-collapse text-sm">
        <thead className="bg-cloud text-left text-charcoal">
          <tr>
            <th className="px-4 py-3 font-medium">题型</th>
            <th className="px-4 py-3 font-medium">题数</th>
            <th className="px-4 py-3 font-medium">已答</th>
            <th className="px-4 py-3 font-medium">答对</th>
            <th className="px-4 py-3 font-medium">错误/未答</th>
            <th className="px-4 py-3 font-medium">得分</th>
            <th className="px-4 py-3 font-medium">总分</th>
          </tr>
        </thead>
        <tbody>
          {summary.byType.map((row) => (
            <tr key={row.type} className="border-t border-fog">
              <td className="px-4 py-3 font-medium text-ink">{row.label}</td>
              <td className="px-4 py-3 text-charcoal">{row.total}</td>
              <td className="px-4 py-3 text-charcoal">{row.answered}</td>
              <td className="px-4 py-3 text-charcoal">{row.type === "essay" ? "不计分" : row.correct}</td>
              <td className="px-4 py-3 text-charcoal">{row.type === "essay" ? "不计分" : row.wrong}</td>
              <td className="px-4 py-3 text-charcoal">{row.type === "essay" ? "-" : row.score}</td>
              <td className="px-4 py-3 text-charcoal">{row.type === "essay" ? "-" : row.possibleScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
