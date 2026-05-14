'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  AutomationRule,
  TriggerType,
  ActionType,
  RuleStatus,
} from '@/app/api/admin/workflows/route';

// ============================================================
// Workflow Builder
// ============================================================
// Зорилго: СӨХ админ автомат дүрэм үүсгэх. Бүх дүрэм анх "draft" төлөвтэй
// үүсэх бөгөөд админ заавал "Идэвхжүүлэх" дарж л идэвхтэй болно.

const TRIGGER_OPTIONS: Array<{ value: TriggerType; label: string; description: string }> = [
  {
    value: 'monthly_date',
    label: 'Сар бүрийн тогтсон өдөр',
    description: 'Жишээ: сар бүрийн 1-нд төлбөр үүсгэх',
  },
  {
    value: 'unpaid_after_day',
    label: 'Төлбөр N өдрөөс хойш төлөгдөөгүй бол',
    description: 'Жишээ: 15-наас хойш төлөөгүй айлуудад сануулга',
  },
  {
    value: 'issue_overdue',
    label: 'Гомдол N цагт шийдэгдээгүй бол',
    description: 'Жишээ: 48 цаг хэтэрсэн гомдлыг даргад мэдэгдэх',
  },
  {
    value: 'manual',
    label: 'Гар ажиллагаа',
    description: 'Зөвхөн админ дарж ажиллуулна',
  },
];

const ACTION_OPTIONS: Array<{ value: ActionType; label: string; description: string }> = [
  {
    value: 'create_reminder_draft',
    label: 'Сануулгын draft үүсгэх',
    description: 'Илгээхгүй — админ шалгаж зөвшөөрсний дараа',
  },
  {
    value: 'create_notification_draft',
    label: 'Апп мэдэгдлийн draft үүсгэх',
    description: 'Илгээхгүй — админ шалгаж зөвшөөрсний дараа',
  },
  {
    value: 'create_report_draft',
    label: 'Тайлангийн draft үүсгэх',
    description: 'Нийтлэхгүй — админ шалгаж зөвшөөрсний дараа',
  },
  {
    value: 'alert_admin',
    label: 'Админд анхааруулга илгээх',
    description: 'Зөвхөн админд харагдана',
  },
  {
    value: 'create_invoice_batch_draft',
    label: 'Нэхэмжлэлийн багц draft үүсгэх',
    description: 'Үүсгэх боловч илгээхгүй',
  },
];

interface Draft {
  name: string;
  description: string;
  trigger_type: TriggerType;
  monthlyDate: number;
  unpaidAfterDay: number;
  issueOverdueHours: number;
  action_type: ActionType;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  trigger_type: 'unpaid_after_day',
  monthlyDate: 1,
  unpaidAfterDay: 15,
  issueOverdueHours: 48,
  action_type: 'create_reminder_draft',
};

// ============================================================
// Mongolian sentence preview
// ============================================================

function previewSentence(d: Draft): string {
  const trigger = (() => {
    switch (d.trigger_type) {
      case 'monthly_date':
        return `Сар бүрийн ${d.monthlyDate}-нд`;
      case 'unpaid_after_day':
        return `Сарын ${d.unpaidAfterDay}-наас хойш төлбөр төлөгдөөгүй бол`;
      case 'issue_overdue':
        return `Гомдол ${d.issueOverdueHours} цагт шийдэгдээгүй бол`;
      case 'manual':
        return 'Гараар ажиллуулахад';
    }
  })();

  const action = (() => {
    switch (d.action_type) {
      case 'create_reminder_draft':
        return 'сануулгын draft үүсгэнэ.';
      case 'create_notification_draft':
        return 'апп мэдэгдлийн draft үүсгэнэ.';
      case 'create_report_draft':
        return 'тайлангийн draft үүсгэнэ.';
      case 'alert_admin':
        return 'админд анхааруулга илгээнэ.';
      case 'create_invoice_batch_draft':
        return 'нэхэмжлэлийн багц draft үүсгэнэ.';
    }
  })();

  return `${trigger} ${action}`;
}

function buildConditionJson(d: Draft): Record<string, unknown> {
  switch (d.trigger_type) {
    case 'monthly_date':
      return { day: d.monthlyDate };
    case 'unpaid_after_day':
      return { day: d.unpaidAfterDay };
    case 'issue_overdue':
      return { hours: d.issueOverdueHours };
    case 'manual':
      return {};
  }
}

// ============================================================
// Rule list helpers
// ============================================================

function triggerLabel(t: TriggerType): string {
  return TRIGGER_OPTIONS.find((o) => o.value === t)?.label ?? t;
}
function actionLabel(a: ActionType): string {
  return ACTION_OPTIONS.find((o) => o.value === a)?.label ?? a;
}
function statusLabel(s: RuleStatus): { text: string; cls: string } {
  switch (s) {
    case 'active':
      return { text: 'Идэвхтэй', cls: 'bg-green-100 text-green-700' };
    case 'paused':
      return { text: 'Түр зогссон', cls: 'bg-amber-100 text-amber-700' };
    case 'draft':
    default:
      return { text: 'Draft', cls: 'bg-gray-100 text-gray-600' };
  }
}

// ============================================================
// Page
// ============================================================

export default function AdminWorkflowsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/workflows');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Татаж чадсангүй');
      setRules(data.rules || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSave = async (activate: boolean) => {
    if (!draft.name.trim()) {
      setError('Дүрмийн нэрийг бөглөнө үү');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description || previewSentence(draft),
          trigger_type: draft.trigger_type,
          condition_json: buildConditionJson(draft),
          action_type: draft.action_type,
          action_json: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалж чадсангүй');

      if (activate && data.rule?.id) {
        await fetch(`/api/admin/workflows?id=${data.rule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });
      }

      setShowForm(false);
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setSaving(false);
    }
  };

  const [runningId, setRunningId] = useState<number | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const handleRunNow = async (rule: AutomationRule) => {
    setRunningId(rule.id);
    setRunMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/workflows/${rule.id}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.reason || 'Алдаа');
      if (data.status === 'success') {
        setRunMessage(`✓ Шинэ draft үүсгэв (run #${data.runId}). Review queue-аас үзнэ үү.`);
      } else if (data.status === 'skipped') {
        setRunMessage(`ⓘ Skipped: ${data.reason}`);
      } else {
        setRunMessage(`⚠ ${data.reason || data.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setRunningId(null);
      setTimeout(() => setRunMessage(null), 5000);
    }
  };

  const handleStatusChange = async (rule: AutomationRule, newStatus: RuleStatus) => {
    try {
      const res = await fetch(`/api/admin/workflows?id=${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Алдаа');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-bold">Автомат дүрэм (Workflow)</h1>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            СӨХ-ийн өдөр тутмын ажлыг автоматжуулах дүрмүүд. Дүрэм бүр зөвхөн{' '}
            <strong>draft</strong> үүсгэдэг — админ заавал шалгаж илгээнэ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/workflows/runs"
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            📥 Review queue
          </Link>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              + Шинэ дүрэм
            </button>
          )}
        </div>
      </header>

      {runMessage && (
        <div className="mb-4 text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3">
          {runMessage}
        </div>
      )}

      {/* Safety banner */}
      <div className="mb-6 border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">⚠️ Бүх дүрэм нь draft үүсгэдэг</p>
        <p className="text-amber-800">
          Дүрэм идэвхтэй ч гэсэн илгээх, нийтлэх, төлбөр үүсгэх ажиллагааг админ шалгаж
          батлахаас өмнө хэзээ ч автоматаар хийгдэхгүй.
        </p>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <section className="mb-6 border border-blue-200 bg-blue-50/30 rounded-2xl p-5">
          <h2 className="font-bold mb-4">Шинэ дүрэм</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Дүрмийн нэр
              </label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Жишээ: 15-аас хойш төлөөгүй айлуудын сануулга"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Тайлбар (заавал биш)
              </label>
              <input
                type="text"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Дүрмийн зорилгыг товч"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Trigger — хэзээ ажиллах вэ?
              </label>
              <div className="space-y-2">
                {TRIGGER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      draft.trigger_type === opt.value
                        ? 'bg-white border-blue-400 ring-2 ring-blue-100'
                        : 'bg-white border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="trigger"
                      checked={draft.trigger_type === opt.value}
                      onChange={() => setDraft({ ...draft, trigger_type: opt.value })}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Condition inputs */}
            {draft.trigger_type === 'monthly_date' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Сарын аль өдөр?
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.monthlyDate}
                  onChange={(e) =>
                    setDraft({ ...draft, monthlyDate: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-32 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            {draft.trigger_type === 'unpaid_after_day' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Сарын аль өдрөөс хойш?
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.unpaidAfterDay}
                  onChange={(e) =>
                    setDraft({ ...draft, unpaidAfterDay: parseInt(e.target.value, 10) || 15 })
                  }
                  className="w-32 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}
            {draft.trigger_type === 'issue_overdue' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Хэдэн цагаас хойш overdue гэж үзэх?
                </label>
                <input
                  type="number"
                  min={1}
                  value={draft.issueOverdueHours}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      issueOverdueHours: parseInt(e.target.value, 10) || 48,
                    })
                  }
                  className="w-32 border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Action */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Үйлдэл — юу хийх вэ?
              </label>
              <select
                value={draft.action_type}
                onChange={(e) =>
                  setDraft({ ...draft, action_type: e.target.value as ActionType })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {ACTION_OPTIONS.find((o) => o.value === draft.action_type)?.description}
              </p>
            </div>

            {/* Preview */}
            <div className="border border-blue-300 bg-white rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">Дүрмийн тайлбар:</p>
              <p className="text-sm text-gray-800">{previewSentence(draft)}</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
              >
                {saving ? 'Хадгалж байна...' : 'Draft хадгалах'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалаад идэвхжүүлэх'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setDraft(EMPTY_DRAFT);
                  setError(null);
                }}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
              >
                Болих
              </button>
            </div>
          </div>
        </section>
      )}

      {/* List */}
      <section>
        <h2 className="font-bold mb-3">Одоо байгаа дүрмүүд</h2>
        {loading && <p className="text-sm text-gray-400">Ачаалж байна...</p>}
        {!loading && rules.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
            <p className="mb-2">Хараахан дүрэм үүсгээгүй байна.</p>
            <p>
              {'"+ Шинэ дүрэм" товчоор анхны автомат дүрмээ үүсгэнэ үү. Жишээ нь "сарын 15-наас хойш төлөөгүй айлуудад сануулгын draft үүсгэх".'}
            </p>
          </div>
        )}
        {!loading && rules.length > 0 && (
          <ul className="space-y-2">
            {rules.map((r) => {
              const s = statusLabel(r.status);
              return (
                <li
                  key={r.id}
                  className="border border-gray-200 bg-white rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm truncate">{r.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}>
                        {s.text}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-gray-600 mb-1 line-clamp-2">{r.description}</p>
                    )}
                    <p className="text-[11px] text-gray-400">
                      {triggerLabel(r.trigger_type)} → {actionLabel(r.action_type)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRunNow(r)}
                      disabled={runningId === r.id}
                      className="text-xs font-semibold text-blue-700 hover:bg-blue-50 px-2 py-1 rounded disabled:opacity-50"
                    >
                      {runningId === r.id ? 'Турш...' : '▶ Одоо турших'}
                    </button>
                    {r.status !== 'active' && (
                      <button
                        onClick={() => handleStatusChange(r, 'active')}
                        className="text-xs text-green-700 hover:bg-green-50 px-2 py-1 rounded"
                      >
                        Идэвхжүүлэх
                      </button>
                    )}
                    {r.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(r, 'paused')}
                        className="text-xs text-amber-700 hover:bg-amber-50 px-2 py-1 rounded"
                      >
                        Түр зогсоох
                      </button>
                    )}
                    {r.status !== 'draft' && (
                      <button
                        onClick={() => handleStatusChange(r, 'draft')}
                        className="text-xs text-gray-500 hover:bg-gray-50 px-2 py-1 rounded"
                      >
                        Draft руу
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
