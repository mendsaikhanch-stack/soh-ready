'use client';

import { useCallback, useEffect, useState } from 'react';
import { councilFetch } from '@/app/components/council/CouncilTabs';
import PlanView from './PlanView';
import type { Decision, PlanOut, Rating } from '@/app/lib/work-plan/shared';

// /api/work-plan-аас төлөвлөгөөнүүдийг ачаалж, оныг сонгуулан харуулна.
// Оршин суугчийн хуудас болон «🏛 Зөвлөл»-ийн таб хоёулаа ашиглана.

interface Resp { enabled?: boolean; council?: 'board' | 'audit' | null; can_act?: boolean; plans?: PlanOut[]; error?: string }

export default function WorkPlanList({ sokhId, onChanged }: { sokhId: number; onChanged?: () => void }) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data } = await councilFetch(`/api/work-plan?sokhId=${sokhId}`);
    setResp(data as Resp);
  }, [sokhId]);
  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const post = async (body: Record<string, unknown>): Promise<string | null> => {
    const { ok, data } = await councilFetch('/api/work-plan', { method: 'POST', body: JSON.stringify({ sokhId, ...body }) });
    await load();
    onChanged?.();
    return ok ? null : data.error || 'Алдаа гарлаа';
  };
  const onReview = (id: number, decision: Decision, comment: string) => post({ action: 'review', planId: id, decision, comment });
  const onRate = (itemId: number, rating: Rating, comment: string) => post({ action: 'rate', itemId, rating, comment });

  if (!resp) return <p className="text-center text-gray-400 py-8 text-sm">Ачаалж байна...</p>;
  if (resp.enabled === false) return <Empty text="Ажлын төлөвлөгөө энэ СӨХ-д идэвхжээгүй байна." />;
  if (resp.error && !resp.plans) return <Empty text={resp.error} />;
  const plans = resp.plans || [];
  if (plans.length === 0) return <Empty text="Батлагдсан ажлын төлөвлөгөө алга байна." />;

  // Анхдагч: ТУЗ-д санал хүлээж буй, эсвэл хамгийн сүүлийн он
  const current = plans.find((p) => p.id === planId) || plans.find((p) => p.status === 'review' && !p.my_review) || plans[0];

  return (
    <div className="space-y-3">
      {plans.length > 1 && (
        <div className="flex gap-1 overflow-x-auto">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setPlanId(p.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border ${p.id === current.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600'}`}>
              {p.year} он{p.status === 'review' ? ' · хянагдаж буй' : ''}
            </button>
          ))}
        </div>
      )}
      <PlanView plan={current} council={!!resp.council} canAct={!!resp.can_act} onReview={onReview} onRate={onRate} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-400">{text}</div>;
}
