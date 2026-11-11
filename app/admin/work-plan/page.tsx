'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PLAN_STATUS, planTotals, type PlanOut } from '@/app/lib/work-plan/shared';

// Дарга — жилийн ажлын төлөвлөгөөний жагсаалт, шинээр үүсгэх.

const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

export default function AdminWorkPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/work-plan');
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setPlans(data.plans || []); setError(''); }
    else { setPlans([]); setError(data.error || 'Ачаалж чадсангүй'); }
  }, []);
  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const create = async () => {
    setBusy(true); setError('');
    const res = await fetch('/api/admin/work-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_plan', year, title: `${year} оны ажлын төлөвлөгөө` }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Үүсгэж чадсангүй');
    router.push(`/admin/work-plan/${data.id}`);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold">📅 Ажлын төлөвлөгөө</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Жилийн ажлаа улирлаар төлөвлөөд <b>ТУЗ-д батлуулна</b>. Батлагдсаны дараа оршин суугчид апп дээрээ харна.
        Ажил бүрийн гүйцэтгэлийг зураг, баримттай тайлагнахад ТУЗ-ийн гишүүд дүгнэнэ.
      </p>

      <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm text-gray-700">Шинэ төлөвлөгөө:</span>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {[0, 1, 2].map((d) => {
            const y = new Date().getFullYear() - 1 + d;
            return <option key={y} value={y}>{y} он</option>;
          })}
        </select>
        <button disabled={busy} onClick={create} className="bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
          + Үүсгэх
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}

      {!plans ? (
        <p className="text-gray-400">Ачаалж байна...</p>
      ) : plans.length === 0 ? (
        <p className="text-gray-400 text-sm">Төлөвлөгөө алга байна.</p>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const t = planTotals(p.items);
            const st = PLAN_STATUS[p.status];
            return (
              <Link key={p.id} href={`/admin/work-plan/${p.id}`} className="block bg-white border rounded-xl p-4 hover:border-slate-400">
                <div className="flex items-center gap-2">
                  <p className="font-semibold flex-1">{p.title}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t.count} ажил · {t.done} хийгдсэн · төсөв {money(t.budget)} · бодит зардал {money(t.actual)}
                  {p.status === 'review' && ` · ТУЗ: ${(p.reviews || []).filter((r) => r.decision === 'approve').length}/${p.board_size || 0} баталсан`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
