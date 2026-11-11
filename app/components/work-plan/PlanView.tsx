'use client';

import { useState } from 'react';
import BoardReportFiles from '@/app/components/BoardReportFiles';
import {
  CATEGORIES,
  ITEM_STATUS,
  PLAN_STATUS,
  QUARTER_LABEL,
  RATING_LABEL,
  planTotals,
  type Decision,
  type ItemOut,
  type PlanOut,
  type Rating,
} from '@/app/lib/work-plan/shared';

// Ажлын төлөвлөгөөг унших харагдац — оршин суугч, ТУЗ хоёулаа ашиглана.
// ТУЗ-ийн гишүүнд (canAct) санал өгөх, ажил дүгнэх товч нэмэгдэнэ.

export const money = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString()}₮`;
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('mn-MN') : '');

interface Props {
  plan: PlanOut;
  council: boolean;          // ТУЗ / Хяналтын гишүүн (нэртэй санал харна)
  canAct: boolean;           // ТУЗ (board) — санал өгнө, дүгнэнэ
  onReview?: (planId: number, decision: Decision, comment: string) => Promise<string | null>;
  onRate?: (itemId: number, rating: Rating, comment: string) => Promise<string | null>;
}

export default function PlanView({ plan, council, canAct, onReview, onRate }: Props) {
  const t = planTotals(plan.items);
  const st = PLAN_STATUS[plan.status];
  const quarters = [1, 2, 3, 4].filter((q) => plan.items.some((i) => i.quarter === q));

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-start gap-2">
          <h2 className="font-bold text-gray-900 flex-1">{plan.title}</h2>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${st.cls}`}>{st.label}</span>
        </div>
        {plan.approved_at && (
          <p className="text-xs text-gray-400 mt-0.5">
            {fmtDate(plan.approved_at)}-нд {plan.approved_via === 'meeting' ? 'ТУЗ-ийн хурлаар' : 'ТУЗ апп-аар'} баталсан
            {plan.approved_note ? ` · ${plan.approved_note}` : ''}
          </p>
        )}
        {plan.intro && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{plan.intro}</p>}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <Mini label="Ажил" value={`${t.done}/${t.count}`} sub="хийгдсэн" />
          <Mini label="Төсөв" value={money(t.budget)} />
          <Mini label="Бодит зардал" value={money(t.actual)} />
        </div>
        {t.count > 0 && (
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-green-500" style={{ width: `${Math.round((t.done / t.count) * 100)}%` }} />
          </div>
        )}
        {plan.summary && (
          <div className="mt-3 bg-slate-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Жилийн дүгнэлт</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.summary}</p>
          </div>
        )}
      </div>

      {plan.status === 'review' && council && <ReviewBox plan={plan} canAct={canAct} onReview={onReview} />}

      {quarters.map((q) => (
        <div key={q}>
          <p className="text-xs font-bold text-gray-500 uppercase px-1 mb-1.5">{QUARTER_LABEL[q]}</p>
          <div className="space-y-2">
            {plan.items.filter((i) => i.quarter === q).map((i) => (
              <ItemCard key={i.id} item={i} council={council} canRate={canAct && plan.status === 'approved' && !!i.reported_at} onRate={onRate} />
            ))}
          </div>
        </div>
      ))}
      {plan.items.length === 0 && <p className="text-center text-sm text-gray-400 py-6">Ажил бүртгэгдээгүй байна.</p>}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg py-2 px-1">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function ReviewBox({ plan, canAct, onReview }: { plan: PlanOut; canAct: boolean; onReview?: Props['onReview'] }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviews = plan.reviews || [];
  const approvals = reviews.filter((r) => r.decision === 'approve').length;
  const need = Math.floor((plan.board_size || 0) / 2) + 1;

  const send = async (d: Decision) => {
    if (!onReview) return;
    if (d === 'changes' && !comment.trim()) return setError('Юуг засах хэрэгтэйг бичнэ үү');
    if (!window.confirm(d === 'approve' ? 'Төлөвлөгөөг батлах уу?' : 'Засвар хэрэгтэй гэж буцаах уу?')) return;
    setBusy(true); setError('');
    const err = await onReview(plan.id, d, comment);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-amber-800">ТУЗ-ийн санал · {approvals}/{need} батлах санал хэрэгтэй</p>
      <p className="text-xs text-amber-700 mt-0.5">ТУЗ-ийн гишүүдийн олонх баталбал төлөвлөгөө оршин суугчдад нээгдэнэ.</p>
      {reviews.length > 0 && (
        <div className="mt-2 space-y-1">
          {reviews.map((r, i) => (
            <p key={i} className="text-xs text-gray-700">
              <b>{r.member_name || 'Гишүүн'}</b>: {r.decision === 'approve' ? '✅ Баталсан' : '✏️ Засвар хэрэгтэй'}
              {r.comment ? ` — ${r.comment}` : ''}
            </p>
          ))}
        </div>
      )}
      {canAct && !plan.my_review && (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Сэтгэгдэл (засвар хэрэгтэй бол заавал)"
            className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm bg-white" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => send('approve')}
              className="py-2 rounded-xl text-sm font-semibold border border-green-300 text-green-700 bg-green-50 disabled:opacity-50">✅ Батлах</button>
            <button disabled={busy} onClick={() => send('changes')}
              className="py-2 rounded-xl text-sm font-semibold border border-amber-300 text-amber-700 bg-white disabled:opacity-50">✏️ Засвар хэрэгтэй</button>
          </div>
        </div>
      )}
      {plan.my_review && <p className="mt-2 text-sm font-medium text-gray-700">Таны санал: {plan.my_review === 'approve' ? '✅ Баталсан' : '✏️ Засвар хэрэгтэй'}</p>}
      {!canAct && <p className="mt-2 text-xs text-purple-600">Хяналтын зөвлөл — зөвхөн хянаж харна.</p>}
    </div>
  );
}

function ItemCard({ item, council, canRate, onRate }: { item: ItemOut; council: boolean; canRate: boolean; onRate?: Props['onRate'] }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const st = ITEM_STATUS[item.status];
  const rated = item.ratings.done + item.ratings.partial + item.ratings.not_done;

  const rate = async (r: Rating) => {
    if (!onRate) return;
    setBusy(true); setError('');
    const err = await onRate(item.id, r, comment);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-xl border p-3">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <div className="flex items-start gap-2">
          <p className="font-medium text-sm text-gray-900 flex-1">{item.title}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {CATEGORIES[item.category] || item.category}
          {item.owner ? ` · ${item.owner}` : ''}
          {item.budget != null ? ` · төсөв ${money(item.budget)}` : ''}
        </p>
        {item.status !== 'planned' && item.status !== 'cancelled' && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex-1">
              <div className="h-full bg-blue-500" style={{ width: `${item.progress}%` }} />
            </div>
            <span className="text-[10px] text-gray-500">{item.progress}%</span>
          </div>
        )}
        {rated > 0 && (
          <p className="text-[11px] text-gray-500 mt-1">
            ТУЗ-ийн дүгнэлт: ✅ {item.ratings.done} · 🟡 {item.ratings.partial} · ❌ {item.ratings.not_done}
          </p>
        )}
      </button>

      {open && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
          {item.description && <p className="text-xs text-gray-600 whitespace-pre-wrap">{item.description}</p>}
          {item.reported_at ? (
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-[11px] font-semibold text-blue-700">Даргын тайлан · {fmtDate(item.reported_at)}</p>
              {item.report && <p className="text-xs text-gray-700 whitespace-pre-wrap mt-0.5">{item.report}</p>}
              {item.actual_cost != null && <p className="text-xs text-gray-600 mt-0.5">Бодит зардал: <b>{money(item.actual_cost)}</b></p>}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Гүйцэтгэл тайлагнаагүй.</p>
          )}
          {item.files.length > 0 && <BoardReportFiles files={item.files} />}
          {council && (item.rating_list || []).length > 0 && (
            <div className="space-y-0.5">
              {(item.rating_list || []).map((r, i) => (
                <p key={i} className="text-[11px] text-gray-600"><b>{r.member_name || 'Гишүүн'}</b>: {RATING_LABEL[r.rating]}{r.comment ? ` — ${r.comment}` : ''}</p>
              ))}
            </div>
          )}
          {canRate && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-gray-500">
                {item.my_rating ? `Таны дүгнэлт: ${RATING_LABEL[item.my_rating]} (өөрчилж болно)` : 'Энэ ажлыг дүгнэнэ үү:'}
              </p>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Сэтгэгдэл (заавал биш)"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              <div className="grid grid-cols-3 gap-1.5">
                {(['done', 'partial', 'not_done'] as const).map((r) => (
                  <button key={r} disabled={busy} onClick={() => rate(r)}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold border disabled:opacity-50 ${item.my_rating === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-700 border-gray-200'}`}>
                    {RATING_LABEL[r]}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
