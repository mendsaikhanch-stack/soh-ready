'use client';

import type { ReactNode } from 'react';
import { QUARTER_LABEL, planPerformance, type ItemOut } from '@/app/lib/work-plan/shared';

// Төлөвлөгөөний биелэлт ба төсвийн зөрүү — СӨХ-ийн дарга (админ) болон оршин суугч
// хоёулаа ЯГ ижил тоог харна. Зөрүүг зөвхөн бодит зардал тайлагнасан ажил дээр тооцно.

const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

export function VarianceText({ value, pct }: { value: number; pct?: number | null }) {
  if (value === 0) return <span className="text-gray-600">төсөвтэй тэнцүү</span>;
  const over = value > 0;
  return (
    <span className={over ? 'text-red-600' : 'text-green-700'}>
      {over ? '▲ ' : '▼ '}{money(Math.abs(value))} {over ? 'хэтэрсэн' : 'хэмнэсэн'}
      {pct != null ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}
    </span>
  );
}

export default function PlanPerformance({ items, year, compact = false }: { items: ItemOut[]; year: number; compact?: boolean }) {
  const p = planPerformance(items, year);
  if (p.count === 0) return null;
  const quarters = [1, 2, 3, 4]
    .map((q) => ({ q, s: planPerformance(items.filter((i) => i.quarter === q), year) }))
    .filter((x) => x.s.count > 0);

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
        <Kpi label="Биелэлт" value={`${p.completionPct}%`} sub={`${p.done}/${p.count} ажил хийгдсэн`} />
        <Kpi label="Дундаж явц" value={`${p.progressPct}%`} sub={`${p.inProgress} хийгдэж байна`} />
        <Kpi label="Төсөв / Зардал" value={money(p.actual)} sub={`төсөв ${money(p.budget)}`} />
        <Kpi
          label="Төсвийн зөрүү"
          value={p.reportedBudget > 0 ? <VarianceText value={p.variance} pct={p.variancePct} /> : '—'}
          sub={p.reportedBudget > 0 ? 'зардал тайлагнасан ажлаар' : 'зардал тайлагнаагүй'}
        />
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex" title="Хийгдсэн · Дутуу · Хийгдээгүй">
        <div className="h-full bg-green-500" style={{ width: `${(p.done / p.count) * 100}%` }} />
        <div className="h-full bg-amber-400" style={{ width: `${(p.partial / p.count) * 100}%` }} />
        <div className="h-full bg-red-400" style={{ width: `${(p.notDone / p.count) * 100}%` }} />
      </div>
      <p className="text-[11px] text-gray-500">
        🟩 хийгдсэн {p.done} · 🟨 дутуу {p.partial} · 🟥 хийгдээгүй {p.notDone}
        {p.overdue > 0 && <span className="text-red-600 font-semibold"> · ⏰ хугацаа хэтэрсэн {p.overdue}</span>}
      </p>

      {quarters.length > 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="text-left py-1.5 font-medium">Улирал</th>
                <th className="text-right py-1.5 font-medium">Биелэлт</th>
                <th className="text-right py-1.5 font-medium">Төсөв</th>
                <th className="text-right py-1.5 font-medium">Зардал</th>
                <th className="text-right py-1.5 font-medium">Зөрүү</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map(({ q, s }) => (
                <tr key={q} className="border-b border-gray-50">
                  <td className="py-1.5">{QUARTER_LABEL[q].split(' (')[0]}{s.overdue > 0 && <span className="text-red-600"> ⏰{s.overdue}</span>}</td>
                  <td className="py-1.5 text-right">{s.done}/{s.count} · {s.completionPct}%</td>
                  <td className="py-1.5 text-right">{money(s.budget)}</td>
                  <td className="py-1.5 text-right">{money(s.actual)}</td>
                  <td className="py-1.5 text-right">{s.reportedBudget > 0 ? <VarianceText value={s.variance} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg py-2 px-2.5">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
