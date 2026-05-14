'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AiKind } from '@/app/api/admin/ai/generate/route';
import type { OutputLayer, ProviderName } from '@/app/lib/ai/core';
import type {
  ReadinessSnapshot,
  ReadinessStatus,
  RecommendedActionType,
} from '@/app/lib/ai/data-readiness';

// AdapterSource — server-аас буцаах. UI badge-д ашиглана.
type AdapterSource = 'real' | 'demo' | 'empty';

// ============================================================
// Action card metadata
// ============================================================

interface CardSpec {
  kind: AiKind;
  emoji: string;
  title: string;
  subtitle: string;
  inputSummary: string;
  enhanceable: boolean;
}

const CARDS: CardSpec[] = [
  {
    kind: 'debt_reminder',
    emoji: '💌',
    title: 'Өртэй айлуудад сануулга бичүүлэх',
    subtitle: 'SMS / Апп / FB / Албан мэдэгдэл — 4 хэлбэрээр draft үүсгэнэ',
    inputSummary: 'invoices + residents-аас өрийн нийт',
    enhanceable: true,
  },
  {
    kind: 'financial_report',
    emoji: '📊',
    title: 'Оршин суугчдад тайлан ойлгомжтой болгох',
    subtitle: 'Сарын санхүүгийн тайланг энгийн монгол хэлээр',
    inputSummary: 'invoices(paid) + reserve_fund',
    enhanceable: true,
  },
  {
    kind: 'monthly_insight',
    emoji: '🔍',
    title: 'Энэ сарын санхүүгийн дүгнэлт гаргах',
    subtitle: 'Цуглуулалтын хувь, эрсдэл, санал болгох үйлдэл',
    inputSummary: 'invoices — paid/pending тоо',
    enhanceable: false,
  },
  {
    kind: 'issue_insight',
    emoji: '🚧',
    title: 'Асуудал их ирсэн байр/орцыг илрүүлэх',
    subtitle: 'Гомдол, давтан асуудал, хугацаа хэтэрсэн',
    inputSummary: 'complaints + maintenance_requests',
    enhanceable: false,
  },
  {
    kind: 'board_report',
    emoji: '📑',
    title: 'Удирдах зөвлөлд 1 нүүр тайлан бэлдэх',
    subtitle: 'Сарын тайлан албан ёсны энгийн монгол хэлээр',
    inputSummary: 'Дээрх 4 + announcements',
    enhanceable: true,
  },
];

// ============================================================
// Result rendering
// ============================================================

interface DebtOut {
  sms: string;
  appNotification: { title: string; body: string };
  facebookPost: string;
  formalNotice: string;
}
interface FinOut {
  explanation: string;
  bulletSummary: string[];
  transparencyNote: string;
}
interface InsightOut {
  collectionRatePct: number;
  unpaidRisk: 'low' | 'medium' | 'high';
  topThreeIssues: string[];
  suggestedActions: string[];
}
interface IssueOut {
  topLocation: { label: string; count: number } | null;
  repeatedCategories: Array<{ category: string; count: number }>;
  overdueCount: number;
  recommendedActions: string[];
}
interface BoardOut {
  title: string;
  sections: Array<{ heading: string; body: string }>;
  footer: string;
}

interface ApiResult {
  output: unknown;
  layer: OutputLayer;
  provider: ProviderName;
  generatedAt: string;
  disclaimer: string;
  warnings?: string[];
  fallbackReason?: string;
  source?: AdapterSource;
  inputUsed?: unknown;
}

function renderOutput(kind: AiKind, output: unknown): React.ReactNode {
  switch (kind) {
    case 'debt_reminder': {
      const o = output as DebtOut;
      return (
        <div className="space-y-4">
          <OutputBlock label="SMS (≤160 тэмдэгт)" text={o.sms} />
          <OutputBlock
            label="Апп мэдэгдэл"
            text={`${o.appNotification.title}\n\n${o.appNotification.body}`}
          />
          <OutputBlock label="Facebook group post" text={o.facebookPost} />
          <OutputBlock label="Албан ёсны мэдэгдэл" text={o.formalNotice} />
        </div>
      );
    }
    case 'financial_report': {
      const o = output as FinOut;
      return (
        <div className="space-y-4">
          <OutputBlock label="Тайлбар" text={o.explanation} />
          <OutputBlock label="3 мөрт дүгнэлт" text={o.bulletSummary.map((b, i) => `${i + 1}. ${b}`).join('\n')} />
          <OutputBlock label="Ил тод байдлын тэмдэглэл" text={o.transparencyNote} />
        </div>
      );
    }
    case 'monthly_insight': {
      const o = output as InsightOut;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Цуглуулалтын хувь" value={`${o.collectionRatePct}%`} />
            <Metric
              label="Өрийн эрсдэл"
              value={o.unpaidRisk === 'low' ? 'Бага' : o.unpaidRisk === 'medium' ? 'Дунд' : 'Өндөр'}
              tone={o.unpaidRisk === 'low' ? 'green' : o.unpaidRisk === 'medium' ? 'amber' : 'red'}
            />
          </div>
          <OutputBlock label="Гол 3 асуудал" text={o.topThreeIssues.map((t, i) => `${i + 1}. ${t}`).join('\n')} />
          <OutputBlock label="Санал болгох үйлдэл" text={o.suggestedActions.map((t, i) => `${i + 1}. ${t}`).join('\n')} />
        </div>
      );
    }
    case 'issue_insight': {
      const o = output as IssueOut;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Хамгийн их гомдолтой"
              value={o.topLocation ? `${o.topLocation.label} (${o.topLocation.count})` : '—'}
            />
            <Metric label="Хугацаа хэтэрсэн" value={`${o.overdueCount}`} tone={o.overdueCount > 0 ? 'red' : 'green'} />
          </div>
          {o.repeatedCategories.length > 0 && (
            <OutputBlock
              label="Давтан ангилал"
              text={o.repeatedCategories.map((c) => `• ${c.category} — ${c.count} удаа`).join('\n')}
            />
          )}
          <OutputBlock
            label="Санал болгох үйлдэл"
            text={o.recommendedActions.map((t, i) => `${i + 1}. ${t}`).join('\n')}
          />
        </div>
      );
    }
    case 'board_report': {
      const o = output as BoardOut;
      return (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-900">{o.title}</h3>
          {o.sections.map((s) => (
            <OutputBlock key={s.heading} label={s.heading} text={s.body} />
          ))}
          <p className="text-xs text-gray-500 italic">{o.footer}</p>
        </div>
      );
    }
  }
}

// ============================================================
// Provenance badge
// ============================================================

// ============================================================
// Demo Walkthrough — танилцуулгад зориулсан 3 минутын дараалал
// ============================================================
// SOH дарга, удирдах зөвлөлд танилцуулахдаа AI урсгалыг 4 алхамаар
// харуулна. Энэ нь бүхэлдээ UI — өгөгдөл / AI API дуудахгүй.

interface WalkthroughStep {
  num: string;
  emoji: string;
  title: string;
  short: string;
  detail: string;
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    num: '1',
    emoji: '🗂️',
    title: 'Өгөгдлөө шалгана',
    short: 'Readiness panel',
    detail:
      'Readiness panel-оос нэхэмжлэл, оршин суугч, гомдол, зарлал зэрэг хүснэгт бэлэн эсэхийг харна. Хоосон бол "Дараагийн алхам" товчоор шууд оруулна.',
  },
  {
    num: '2',
    emoji: '🧠',
    title: 'AI draft үүсгэнэ',
    short: 'Action card',
    detail:
      'Action card-ын аль нэгийг дарна — жишээ нь "Өртэй айлуудад сануулга бичүүлэх" эсвэл "Удирдах зөвлөлд 1 нүүр тайлан". Хүсвэл "AI-аар сайжруулах" сонголтоор Layer 3-ыг идэвхжүүлэх боломжтой.',
  },
  {
    num: '3',
    emoji: '✏️',
    title: 'Админ хянана',
    short: 'Edit / copy',
    detail:
      'Үүссэн draft нь бүх талбарт засварлагдах байдлаар гарна. SMS, FB пост, албан мэдэгдэл бүрийг шууд засаж эсвэл "📋 Хуулах" товчоор хуулна.',
  },
  {
    num: '4',
    emoji: '✓',
    title: 'Зөвшөөрөөд ашиглана',
    short: 'Review queue',
    detail:
      'Бодит илгээхээс өмнө "Draft хадгалах"-аар Review queue-руу явуулна. Удирдлага шалгаж "Зөвшөөрсөн" / "Гараар илгээсэн" гэсэн төлвөөр тэмдэглэдэг — автомат илгээх БАЙХГҮЙ.',
  },
];

function DemoWalkthrough({ lastSource }: { lastSource?: AdapterSource }) {
  const showDemoNote = lastSource === 'demo';
  return (
    <details className="mb-6 group border border-indigo-200 bg-indigo-50/40 rounded-2xl overflow-hidden">
      <summary className="cursor-pointer px-5 py-3 flex items-center justify-between gap-3 list-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">🎤</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-indigo-900">
              Танилцуулгад ашиглах 3 минутын дараалал
            </p>
            <p className="text-xs text-indigo-700/80 truncate">
              СӨХ-ийн дарга/удирдах зөвлөлд харуулах 4 алхамт демо
            </p>
          </div>
        </div>
        <span className="text-xs text-indigo-700 group-open:rotate-180 transition-transform shrink-0">
          ▾
        </span>
      </summary>

      {/* Step strip — нээлттэй нэгэнт компакт */}
      <div className="px-5 pb-3">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WALKTHROUGH_STEPS.map((s, i) => (
            <li
              key={s.num}
              className="bg-white rounded-xl p-3 border border-indigo-100 relative"
            >
              <div className="flex items-center gap-2">
                <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                  {s.num}
                </span>
                <span className="text-base">{s.emoji}</span>
              </div>
              <p className="mt-2 text-xs font-semibold text-gray-900 leading-tight">
                {s.title}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">{s.short}</p>
              {i < WALKTHROUGH_STEPS.length - 1 && (
                <span className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 text-indigo-300 text-lg">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Дэлгэрэнгүй */}
      <div className="px-5 pb-4 space-y-3 text-sm text-gray-700">
        {WALKTHROUGH_STEPS.map((s) => (
          <div key={s.num} className="flex gap-3">
            <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
              {s.num}
            </span>
            <div>
              <p className="font-semibold text-gray-900">
                {s.emoji} {s.title}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{s.detail}</p>
            </div>
          </div>
        ))}

        <div className="border-t border-indigo-100 pt-3 text-xs text-gray-600 space-y-1">
          <p>
            <strong>🧪 Demo mode ашиглах:</strong>{' '}
            <code className="bg-white border border-indigo-100 px-1.5 py-0.5 rounded">
              KHOTOL_DEMO_MODE=1
            </code>{' '}
            env-д тавьбал action card-ууд бодит DB-ийн оронд Нарлаг хотхон СӨХ-ийн жишээ
            өгөгдлийг ашиглана. Readiness panel-ы тоо бодит DB-аас гардаг тул {'"хоосон"'}
            гарч магадгүй — энэ нь хэвийн.
          </p>
          <p>
            <strong>🔒 Аюулгүй байдал:</strong> AI хэзээ ч SMS, push мэдэгдэл, FB пост
            автоматаар илгээдэггүй. Бүх хариу зөвхөн draft. Тоо input-аас гарна — AI
            зохиогоор үүсгэхгүй.
          </p>
        </div>

        {showDemoNote && (
          <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-900">
            <strong>🧪 Сүүлд үүссэн draft нь demo өгөгдлөөс гарсан байна.</strong>{' '}
            (<code>KHOTOL_DEMO_MODE=1</code> идэвхтэй эсвэл client raw input өгсөн.)
            Production-д суулгахын өмнө энэ env-ийг авч хаяарай.
          </div>
        )}
      </div>
    </details>
  );
}

function actionStyle(type: RecommendedActionType): string {
  switch (type) {
    case 'import':
      return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    case 'create':
      return 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100';
    case 'migrate':
      return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
    case 'review':
      return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
    case 'none':
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

function actionEmoji(type: RecommendedActionType): string {
  switch (type) {
    case 'import':
      return '📥';
    case 'create':
      return '＋';
    case 'migrate':
      return '🛠';
    case 'review':
      return '👀';
    case 'none':
      return 'ⓘ';
  }
}

function readinessChip(status: ReadinessStatus): { label: string; cls: string; emoji: string } {
  switch (status) {
    case 'ready':
      return { label: 'Бэлэн', cls: 'bg-green-100 text-green-700 border-green-200', emoji: '✓' };
    case 'empty':
      return { label: 'Хоосон', cls: 'bg-amber-100 text-amber-700 border-amber-200', emoji: '∅' };
    case 'missing_table':
      return { label: 'Хүснэгт байхгүй', cls: 'bg-red-100 text-red-700 border-red-200', emoji: '⚠' };
  }
}

function ReadinessPanel({
  snapshot,
  loading,
  error,
  onRefresh,
}: {
  snapshot: ReadinessSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const readyCount = snapshot?.items.filter((i) => i.status === 'ready').length ?? 0;
  const emptyCount = snapshot?.items.filter((i) => i.status === 'empty').length ?? 0;
  const missingCount = snapshot?.items.filter((i) => i.status === 'missing_table').length ?? 0;
  const totalCount = snapshot?.items.length ?? 0;

  return (
    <section className="mb-6 border border-gray-200 bg-white rounded-2xl overflow-hidden">
      <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🗂️</span>
            <h2 className="font-bold text-base">AI өгөгдлийн бэлэн байдал</h2>
            {snapshot && (
              <span className="text-[10px] font-mono text-gray-400">{snapshot.month}</span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Энэхүү СӨХ-ийн AI action-уудад шаардлагатай хүснэгтүүдийн өнөөгийн төлөв.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot && (
            <div className="text-xs text-gray-500">
              <span className="text-green-700 font-bold">{readyCount}</span> бэлэн ·{' '}
              <span className="text-amber-700 font-bold">{emptyCount}</span> хоосон
              {missingCount > 0 && (
                <>
                  {' '}
                  · <span className="text-red-700 font-bold">{missingCount}</span> хүснэгт алга
                </>
              )}
              {' '}/ {totalCount}
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="px-5 py-3 text-xs text-red-700 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {loading && !snapshot && (
        <div className="px-5 py-6 text-sm text-gray-400">Ачаалж байна...</div>
      )}

      {snapshot && (
        <ul className="divide-y divide-gray-100">
          {snapshot.items.map((item) => {
            const chip = readinessChip(item.status);
            const action = item.recommendedAction;
            const showActionBlock =
              action.type !== 'none' || (item.status !== 'ready' && action.href);
            return (
              <li key={item.key} className="px-5 py-3 flex items-start gap-3">
                <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${chip.cls}`}>
                  <span>{chip.emoji}</span>
                  <span>{chip.label}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{item.count} мөр</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.hint}</p>
                  {showActionBlock && (
                    <div className="mt-2">
                      {action.href ? (
                        <Link
                          href={action.href}
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border transition ${actionStyle(action.type)}`}
                        >
                          {actionEmoji(action.type)} {action.label} →
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 italic">
                          ⓘ {action.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {snapshot && missingCount > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-red-700 bg-red-50">
          <strong>⚠ Зарим хүснэгт олдсонгүй.</strong> Холбогдох migration ажиллаагүй
          байх магадлалтай. <code>supabase-finance-migration.sql</code>,{' '}
          <code>supabase-missing-tables.sql</code>, <code>supabase-v2.sql</code>-ийг шалгана уу.
        </div>
      )}
    </section>
  );
}

function SourceBadge({ source }: { source: AdapterSource }) {
  const meta = (() => {
    switch (source) {
      case 'real':
        return { label: 'Бодит өгөгдөл', emoji: '🗄️', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'demo':
        return { label: 'Demo өгөгдөл', emoji: '🧪', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      case 'empty':
        return { label: 'Хүснэгт хоосон', emoji: '∅', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
  })();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.cls}`}>
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function LayerBadge({ layer, provider }: { layer: OutputLayer; provider: ProviderName }) {
  const meta = (() => {
    switch (layer) {
      case 'ai_enhanced':
        return { label: 'AI ашиглан сайжруулсан', emoji: '🧠', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'template':
        return { label: 'Template ашигласан draft', emoji: '📝', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'rule':
        return { label: 'Дүрэмд суурилсан', emoji: '⚙️', cls: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  })();
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.cls}`}>
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
      <span className="opacity-50">·</span>
      <span className="font-mono opacity-70">{provider}</span>
    </span>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Metric({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: string;
  tone?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneCls = {
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    green: 'bg-green-50 text-green-900 border-green-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    red: 'bg-red-50 text-red-900 border-red-200',
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <p className="text-xs uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function OutputBlock({ label, text }: { label: string; text: string }) {
  const [val, setVal] = useState(text);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          {copied ? '✓ Хуулсан' : '📋 Хуулах'}
        </button>
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={Math.min(12, Math.max(3, val.split('\n').length + 1))}
        className="w-full px-3 py-2 text-sm font-mono text-gray-800 bg-transparent resize-y focus:outline-none"
      />
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function AdminAiPage() {
  const [activeKind, setActiveKind] = useState<AiKind | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [enhanceWithAi, setEnhanceWithAi] = useState(false);

  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  const loadReadiness = async () => {
    setReadinessLoading(true);
    setReadinessError(null);
    try {
      const res = await fetch('/api/admin/ai/readiness');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Татаж чадсангүй');
      setReadiness(data);
    } catch (e) {
      setReadinessError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setReadinessLoading(false);
    }
  };

  useEffect(() => {
    loadReadiness();
  }, []);

  const activeCard = CARDS.find((c) => c.kind === activeKind) || null;

  const handleGenerate = async (card: CardSpec) => {
    setActiveKind(card.kind);
    setResult(null);
    setError(null);
    setLoading(true);
    setSaveStatus('idle');
    try {
      // Adapter нь sokhId-аар бодит DB-ээс татна. Гар input өгөхгүй —
      // тэгснээр KHOTOL_DEMO_MODE=1 байх үед л demo буцна.
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: card.kind,
          enhance: enhanceWithAi && card.enhanceable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Алдаа');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeCard || !result) return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `AI draft — ${activeCard.title}`,
          description: `Хадгалсан AI санал. Илгээхээс өмнө шалгана уу.`,
          trigger_type: 'manual',
          condition_json: { source: 'admin_ai_page', kind: activeCard.kind, layer: result.layer },
          action_type: aiKindToAction(activeCard.kind),
          action_json: {
            kind: activeCard.kind,
            output: result.output,
            generatedAt: result.generatedAt,
            provider: result.provider,
            layer: result.layer,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалж чадсангүй');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
      setSaveStatus('error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🧠</span>
            <h1 className="text-2xl font-bold">Khotol AI Command Center</h1>
            <span className="ml-2 text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
              BETA
            </span>
          </div>
          <p className="text-sm text-gray-600">
            СӨХ-ийн өдөр тутмын ажлыг автоматжуулах AI туслах. Бүх хариу нь зөвхөн{' '}
            <strong>санал</strong> бөгөөд илгээхээс өмнө админ заавал шалгана.
          </p>
        </div>
        <Link
          href="/admin/ai/settings"
          className="text-sm text-gray-500 hover:text-gray-900 transition px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          ⚙️ AI тохиргоо
        </Link>
      </header>

      {/* Танилцуулгад ашиглах 3 минутын дараалал */}
      <DemoWalkthrough lastSource={result?.source} />

      {/* Layer explainer */}
      <div className="mb-6 grid sm:grid-cols-3 gap-3">
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Layer 1 · Rule</p>
          <p className="text-xs text-blue-900 mt-1">DB query, cron, deterministic. AI шаардахгүй.</p>
        </div>
        <div className="border border-cyan-200 bg-cyan-50 rounded-xl p-3">
          <p className="text-xs font-bold text-cyan-700 uppercase tracking-wide">Layer 2 · Template</p>
          <p className="text-xs text-cyan-900 mt-1">Placeholder template, tone. AI шаардахгүй.</p>
        </div>
        <div className="border border-purple-200 bg-purple-50 rounded-xl p-3">
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">Layer 3 · AI</p>
          <p className="text-xs text-purple-900 mt-1">Сонголтоор. Идэвхгүй бол Layer 2 руу унана.</p>
        </div>
      </div>

      {/* Readiness panel — action card-уудын ӨМНӨ */}
      <ReadinessPanel
        snapshot={readiness}
        loading={readinessLoading}
        error={readinessError}
        onRefresh={loadReadiness}
      />

      {/* Safety + enhance toggle */}
      <div className="mb-6 border border-amber-200 bg-amber-50 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <span className="text-amber-600">⚠️</span>
          <div className="text-sm text-amber-900 leading-relaxed flex-1">
            <p className="font-semibold mb-1">Илгээхээс өмнө шалгана уу</p>
            <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
              <li>AI/template аль нь ч санал гаргадаг. Илгээх эсэхийг та хариуцна.</li>
              <li>Санхүүгийн дугаарууд зөвхөн системийн баталгаажсан өгөгдлөөс гарна.</li>
              <li>AI төлбөрийн бичлэг, мэдээллийг өөрөө өөрчилдөггүй.</li>
            </ul>
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enhanceWithAi}
            onChange={(e) => setEnhanceWithAi(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-purple-600"
          />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              AI-аар сайжруулах (Layer 3)
            </p>
            <p className="text-xs text-amber-800">
              Идэвхтэй бол текстийг LLM-р дамжуулж дахин найруулна. AI тохиргоо
              идэвхгүй, квот дууссан, эсвэл алдаа гарвал автоматаар template-руу унана.
            </p>
          </div>
        </label>
      </div>

      {/* Cards */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {CARDS.map((card) => {
          const isActive = activeKind === card.kind;
          const willEnhance = enhanceWithAi && card.enhanceable;
          return (
            <button
              key={card.kind}
              onClick={() => handleGenerate(card)}
              className={`text-left rounded-2xl p-5 border transition ${
                isActive
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{card.emoji}</span>
                <h3 className="font-bold text-sm leading-tight">{card.title}</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{card.subtitle}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 truncate">Source: {card.inputSummary}</span>
                <span className="text-xs flex items-center gap-1 shrink-0 ml-2">
                  {willEnhance ? (
                    <span className="text-purple-600 font-semibold">🧠 + AI</span>
                  ) : (
                    <span className="text-blue-600 font-semibold">📝 Template</span>
                  )}
                  <span className="text-gray-300">→</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Output area */}
      {(loading || result || error) && activeCard && (
        <section className="border border-gray-200 rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-base">{activeCard.title}</h2>
              <p className="text-xs text-gray-500">Draft — илгээхээс өмнө заавал шалга</p>
            </div>
            {result && (
              <div className="flex items-center gap-3 flex-wrap">
                <LayerBadge layer={result.layer} provider={result.provider} />
                {result.source && <SourceBadge source={result.source} />}
                <button
                  onClick={handleSaveDraft}
                  disabled={saveStatus === 'saving'}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saveStatus === 'saving'
                    ? 'Хадгалж байна...'
                    : saveStatus === 'saved'
                      ? '✓ Хадгалсан'
                      : 'Draft хадгалах'}
                </button>
              </div>
            )}
          </div>

          {loading && <p className="text-sm text-gray-400">Үүсгэж байна...</p>}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
          {result && renderOutput(activeCard.kind, result.output)}

          {result?.fallbackReason && (
            <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              ℹ Layer 3 fallback: <strong>{result.fallbackReason}</strong>. Template-аас гарсан хариу буцсан.
            </div>
          )}
          {result?.warnings && result.warnings.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {result.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400 italic">{result?.disclaimer}</p>
        </section>
      )}
    </div>
  );
}

function aiKindToAction(kind: AiKind):
  | 'create_reminder_draft'
  | 'create_notification_draft'
  | 'create_report_draft'
  | 'alert_admin' {
  switch (kind) {
    case 'debt_reminder':
      return 'create_reminder_draft';
    case 'financial_report':
      return 'create_report_draft';
    case 'monthly_insight':
      return 'create_report_draft';
    case 'issue_insight':
      return 'alert_admin';
    case 'board_report':
      return 'create_report_draft';
  }
}
