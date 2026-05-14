'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  AutomationRunRow,
  ReviewedStatus,
} from '@/app/api/admin/automation-runs/route';

// ============================================================
// /admin/workflows/runs — Review Queue
// ============================================================
// Автомат дүрмээс үүссэн draft-уудыг шалгах, баталгаажуулах, татгалзах.

const STATUS_TABS: Array<{ value: ReviewedStatus | 'all'; label: string }> = [
  { value: 'pending_review', label: 'Шалгах шаардлагатай' },
  { value: 'approved', label: 'Зөвшөөрсөн' },
  { value: 'sent_manually', label: 'Гараар илгээсэн' },
  { value: 'rejected', label: 'Татгалзсан' },
  { value: 'all', label: 'Бүгд' },
];

function statusBadge(s: ReviewedStatus): { text: string; cls: string } {
  switch (s) {
    case 'pending_review':
      return { text: 'Шалгах', cls: 'bg-amber-100 text-amber-700' };
    case 'approved':
      return { text: 'Зөвшөөрсөн', cls: 'bg-green-100 text-green-700' };
    case 'rejected':
      return { text: 'Татгалзсан', cls: 'bg-gray-200 text-gray-600' };
    case 'sent_manually':
      return { text: 'Илгээсэн', cls: 'bg-blue-100 text-blue-700' };
  }
}

function triggerLabel(t: string): string {
  switch (t) {
    case 'monthly_date':
      return 'Сар бүрийн өдөр';
    case 'unpaid_after_day':
      return 'Хугацаа хэтэрсэн төлбөр';
    case 'issue_overdue':
      return 'Гомдол хэтэрсэн';
    case 'manual':
      return 'Гар';
    default:
      return t;
  }
}

function actionLabel(a: string): string {
  switch (a) {
    case 'create_reminder_draft':
      return 'Сануулга';
    case 'create_notification_draft':
      return 'Мэдэгдэл';
    case 'create_report_draft':
      return 'Тайлан';
    case 'alert_admin':
      return 'Админд мэдэгдэх';
    case 'create_invoice_batch_draft':
      return 'Нэхэмжлэл';
    default:
      return a;
  }
}

// ============================================================
// Output preview
// ============================================================
// output_json дотор {kind, output} байх — kind-аас хамаараад зөв render.

function summarizeOutput(out: Record<string, unknown> | null): string {
  if (!out) return '—';
  const o = (out as { output?: Record<string, unknown> }).output;
  if (!o) return JSON.stringify(out).slice(0, 200);

  // Debt reminder
  if (typeof (o as { sms?: string }).sms === 'string') {
    return (o as { sms: string }).sms;
  }
  // Financial report
  if (typeof (o as { explanation?: string }).explanation === 'string') {
    return (o as { explanation: string }).explanation;
  }
  // Insight
  if (typeof (o as { collectionRatePct?: number }).collectionRatePct === 'number') {
    const v = o as { collectionRatePct: number; unpaidRisk: string };
    return `Цуглуулалт ${v.collectionRatePct}% · эрсдэл ${v.unpaidRisk}`;
  }
  // Issue insight
  if ((o as { topLocation?: unknown }).topLocation !== undefined) {
    const v = o as { topLocation: { label: string; count: number } | null; overdueCount: number };
    return v.topLocation
      ? `${v.topLocation.label} (${v.topLocation.count}) · ${v.overdueCount} overdue`
      : `${v.overdueCount} overdue`;
  }
  // Board report
  if (typeof (o as { title?: string }).title === 'string') {
    return (o as { title: string }).title;
  }
  return JSON.stringify(o).slice(0, 200);
}

function fullJsonText(out: Record<string, unknown> | null): string {
  if (!out) return '';
  const o = (out as { output?: Record<string, unknown> }).output ?? out;
  try {
    return JSON.stringify(o, null, 2);
  } catch {
    return String(o);
  }
}

// ============================================================
// Page
// ============================================================

export default function AdminAutomationRunsPage() {
  const [tab, setTab] = useState<ReviewedStatus | 'all'>('pending_review');
  const [runs, setRuns] = useState<AutomationRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = async (status: typeof tab) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('reviewed_status', status);
      const res = await fetch(`/api/admin/automation-runs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Татаж чадсангүй');
      setRuns(data.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const updateStatus = async (id: number, status: ReviewedStatus) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/automation-runs?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_status: status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Алдаа');
      await load(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setUpdating(null);
    }
  };

  const copyDraft = async (run: AutomationRunRow) => {
    const text = fullJsonText(run.output_json);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link href="/admin/workflows" className="text-xs text-gray-500 hover:text-gray-900">
          ← Workflow дүрмүүд
        </Link>
        <div className="flex items-center gap-2 mt-2 mb-2">
          <span className="text-2xl">📥</span>
          <h1 className="text-2xl font-bold">Review queue</h1>
        </div>
        <p className="text-sm text-gray-600">
          Автомат дүрэм болон гар оролдлогоор үүссэн draft-ууд. Илгээхээс өмнө{' '}
          <strong>заавал шалгаж зөвшөөрнө</strong>.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-semibold rounded-t-lg transition ${
              tab === t.value
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">Ачаалж байна...</p>}

      {!loading && runs.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          <p className="mb-2">Энэ ангилалд run алга байна.</p>
          <p>
            {'Workflow дүрмүүдээ идэвхжүүлээд "Одоо турших" товчоор анхны run-ээ үүсгээрэй.'}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {runs.map((run) => {
          const b = statusBadge(run.reviewed_status);
          const isExpanded = expandedId === run.id;
          const ruleName = run.rule?.name ?? `Rule #${run.rule_id}`;
          const trig = run.rule ? triggerLabel(run.rule.trigger_type) : '—';
          const act = run.rule ? actionLabel(run.rule.action_type) : '—';

          return (
            <li
              key={run.id}
              className="border border-gray-200 bg-white rounded-xl overflow-hidden"
            >
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{ruleName}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.cls}`}>
                      {b.text}
                    </span>
                    {run.status === 'failed' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        Алдаатай
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {trig} → {act} · {new Date(run.created_at).toLocaleString('mn-MN')}
                    {run.idempotency_key && (
                      <span className="ml-2 font-mono text-[10px] text-gray-400">
                        {run.idempotency_key}
                      </span>
                    )}
                  </p>
                  {run.status === 'failed' ? (
                    <p className="text-xs text-red-700 bg-red-50 rounded p-2 line-clamp-2">
                      {run.error_message || 'Тодорхойгүй алдаа'}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">
                      {summarizeOutput(run.output_json)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : run.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    {isExpanded ? '✕ Хаах' : 'Нээх →'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => copyDraft(run)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      📋 Бүгдийг хуулах
                    </button>
                    {run.reviewed_status !== 'approved' && (
                      <button
                        onClick={() => updateStatus(run.id, 'approved')}
                        disabled={updating === run.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ Зөвшөөрөх
                      </button>
                    )}
                    {run.reviewed_status !== 'sent_manually' && (
                      <button
                        onClick={() => updateStatus(run.id, 'sent_manually')}
                        disabled={updating === run.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        📤 Гараар илгээсэн гэж тэмдэглэх
                      </button>
                    )}
                    {run.reviewed_status !== 'rejected' && (
                      <button
                        onClick={() => updateStatus(run.id, 'rejected')}
                        disabled={updating === run.id}
                        className="px-3 py-1.5 text-xs font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                      >
                        ✕ Татгалзах
                      </button>
                    )}
                    {run.reviewed_status !== 'pending_review' && (
                      <button
                        onClick={() => updateStatus(run.id, 'pending_review')}
                        disabled={updating === run.id}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        ↺ Дахин шалгах
                      </button>
                    )}
                  </div>

                  <pre className="bg-white border border-gray-200 rounded-lg p-3 text-[11px] text-gray-800 overflow-x-auto max-h-96">
                    {fullJsonText(run.output_json)}
                  </pre>

                  {run.input_json && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Input өгөгдөл харах
                      </summary>
                      <pre className="bg-white border border-gray-200 rounded-lg p-3 text-[11px] text-gray-700 overflow-x-auto mt-2">
                        {JSON.stringify(run.input_json, null, 2)}
                      </pre>
                    </details>
                  )}

                  {run.reviewed_at && (
                    <p className="text-xs text-gray-500">
                      Шалгасан:{' '}
                      {new Date(run.reviewed_at).toLocaleString('mn-MN')}
                      {run.reviewed_by ? ` · ${run.reviewed_by}` : ''}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
