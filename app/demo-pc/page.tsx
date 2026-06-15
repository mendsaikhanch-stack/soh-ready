'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  sokh,
  residents,
  recentPayments,
  announcements,
  maintenanceRequests,
  incomeData,
  expenseData,
  parkingVehicles,
  guestVehicles,
  easyBoxStats,
  easyBoxRecent,
  aiActions,
  type AiAction,
} from '@/app/lib/demo/admin-mock';

// Desktop (ПС) демо — СӨХ админ ажлын талбар.
// /demo-admin (утасны хувилбар)-аас ялгаатай нь жинхэнэ desktop layout:
// зүүн sidebar + өргөн агуулга. Танилцуулгад ашиглана.

type NavId =
  | 'dashboard' | 'residents' | 'payments' | 'announcements'
  | 'maintenance' | 'parking' | 'reports' | 'ai' | 'easybox';

const NAV: { id: NavId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Хянах самбар', icon: '📊' },
  { id: 'residents', label: 'Оршин суугчид', icon: '👥' },
  { id: 'payments', label: 'Төлбөр', icon: '💰' },
  { id: 'announcements', label: 'Зарлал', icon: '📢' },
  { id: 'maintenance', label: 'Засвар', icon: '🔧' },
  { id: 'parking', label: 'Зогсоол', icon: '🚗' },
  { id: 'reports', label: 'Санхүүгийн тайлан', icon: '📈' },
  { id: 'ai', label: 'AI туслах', icon: '🧠' },
  { id: 'easybox', label: 'EasyBox', icon: '📦' },
];

const fmt = (n: number) => n.toLocaleString();
const debtCount = residents.filter((r) => r.debt > 0).length;
const totalIncome = incomeData.reduce((s, d) => s + d.amount, 0);
const totalExpense = expenseData.reduce((s, d) => s + d.amount, 0);

export default function DemoPcPage() {
  const router = useRouter();
  const [nav, setNav] = useState<NavId>('dashboard');
  const [aiId, setAiId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);

  const ai = aiActions.find((a) => a.id === aiId) ?? null;
  const closeAi = () => { setAiId(null); setCopied(false); setApproved(false); };

  useEffect(() => {
    if (!aiId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAi(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aiId]);

  const copyDraft = async (a: AiAction) => {
    try { await navigator.clipboard.writeText(a.draft); } catch { /* демо */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const current = NAV.find((n) => n.id === nav)!;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Демо банер */}
      <div className="bg-yellow-400 text-yellow-900 text-center py-1.5 text-xs font-semibold flex-shrink-0">
        Демо горим — СӨХ Удирдлага (ПС хувилбар) · Жишээ өгөгдөл
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-60 bg-gray-900 text-white flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
                {sokh.manager.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">🏢 {sokh.name}</p>
                <p className="text-[11px] text-gray-400">Удирдлагын панел</p>
              </div>
            </div>
          </div>
          <nav className="p-2 flex-1 overflow-y-auto">
            {NAV.map((item) => {
              const active = nav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setNav(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left mb-0.5 transition ${
                    active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-700">
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"
            >
              <span>🚪</span><span>Гарах (демо)</span>
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Top bar */}
          <div className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{current.icon} {current.label}</h1>
              <p className="text-xs text-gray-400">{sokh.name} · {sokh.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">2026 оны 4-р сар</span>
              <div className="flex items-center gap-2 pl-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                  {sokh.manager.charAt(0)}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium leading-tight">{sokh.manager}</p>
                  <p className="text-[10px] text-gray-400">СӨХ Дарга</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            {nav === 'dashboard' && <Dashboard onOpenAi={() => setNav('ai')} />}
            {nav === 'residents' && <Residents />}
            {nav === 'payments' && <Payments />}
            {nav === 'announcements' && <Announcements />}
            {nav === 'maintenance' && <Maintenance />}
            {nav === 'parking' && <Parking />}
            {nav === 'reports' && <Reports />}
            {nav === 'ai' && <AiCenter onOpen={setAiId} />}
            {nav === 'easybox' && <EasyBox />}
          </div>
        </main>
      </div>

      {/* AI draft modal */}
      {ai && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeAi} role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white rounded-2xl max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-start gap-3">
              <span className="text-2xl shrink-0">{ai.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{ai.title}</p>
                <p className="text-xs text-gray-500">Хэлбэр: <span className="font-semibold text-gray-700">{ai.channel}</span>{ai.charLimit && ` · ≤${ai.charLimit} тэмдэгт`}</p>
              </div>
              <button onClick={closeAi} aria-label="Хаах" className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex-1">
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {ai.badges.map((b, i) => {
                  const cls = b.kind === 'template' ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : b.kind === 'ai' ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  return <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{b.label}</span>;
                })}
              </div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">🗂️ Ашигласан өгөгдөл</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
                {ai.inputs.map((inp, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{inp.label}</span>
                    <span className="font-mono font-semibold text-gray-900">{inp.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">📝 Эх хувилбар</p>
              <pre className="bg-gray-50 border rounded-lg p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap text-gray-900">{ai.draft}</pre>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mt-4">
                ⚠️ Автомат илгээгдэхгүй — та хянаж зөвшөөрсний дараа л явна
              </div>
            </div>
            <div className="border-t p-3 grid grid-cols-3 gap-2">
              <button onClick={() => copyDraft(ai)} className={`text-sm font-semibold py-2.5 rounded-lg transition ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {copied ? '✓ Хуулсан' : '📋 Хуулах'}
              </button>
              <button className="text-sm font-semibold py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition">✏️ Засах</button>
              <button onClick={() => setApproved(true)} disabled={approved}
                className={`text-sm font-semibold py-2.5 rounded-lg transition ${approved ? 'bg-emerald-600 text-white' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'}`}>
                {approved ? '✓ Зөвшөөрсөн' : '✓ Зөвшөөрөх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Screens ───────────

function StatCard({ icon, label, value, cls }: { icon: string; label: string; value: string; cls?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${cls || ''}`}>{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-2">{label}</p>
    </div>
  );
}

function Dashboard({ onOpenAi }: { onOpenAi: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="👥" label="Нийт айл" value={String(sokh.totalResidents)} />
        <StatCard icon="⚠️" label="Өртэй айл" value={String(debtCount)} cls="text-red-500" />
        <StatCard icon="💰" label="Энэ сард цугласан" value={`${(sokh.totalPaid / 1e6).toFixed(1)}M₮`} cls="text-green-600" />
        <StatCard icon="📉" label="Үлдсэн өр" value={`${(sokh.totalDebt / 1e6).toFixed(1)}M₮`} cls="text-red-500" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Collection */}
        <div className="col-span-2 bg-white rounded-xl border p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">Цуглуулалтын явц (4-р сар)</h3>
            <span className="text-2xl font-bold text-blue-600">{sokh.collectionRate}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full" style={{ width: `${sokh.collectionRate}%` }} />
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-green-600 font-semibold">+{fmt(sokh.totalPaid)}₮ цугласан</span>
            <span className="text-red-500 font-semibold">-{fmt(sokh.totalDebt)}₮ өр</span>
          </div>
        </div>

        {/* AI shortcut */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 shadow-sm text-white flex flex-col justify-between">
          <div>
            <p className="text-2xl">🧠</p>
            <h3 className="font-semibold mt-1">AI туслах</h3>
            <p className="text-xs text-white/80 mt-1">Сануулга, тайлан, дүгнэлтийг нэг товчоор бэлдэнэ.</p>
          </div>
          <button onClick={onOpenAi} className="mt-4 bg-white/15 hover:bg-white/25 transition rounded-lg py-2 text-sm font-semibold">
            AI туслах нээх →
          </button>
        </div>
      </div>

      {/* Attention */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">АНХААРАЛ ШААРДЛАГАТАЙ</h3>
        <div className="grid grid-cols-3 gap-4">
          <AttentionCard icon="🔧" title="Хүлээгдэж буй засвар" sub={`${sokh.pendingMaintenance} хүсэлт хариу хүлээж байна`} cls="bg-orange-50 border-orange-200 text-orange-700" />
          <AttentionCard icon="📝" title="Гомдол / Санал" sub={`${sokh.pendingComplaints} шинэ хүсэлт`} cls="bg-purple-50 border-purple-200 text-purple-700" />
          <AttentionCard icon="💸" title="Их өртэй айл" sub="2 айл 200,000₮-аас дээш өртэй" cls="bg-red-50 border-red-200 text-red-700" />
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ icon, title, sub, cls }: { icon: string; title: string; sub: string; cls: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{sub}</p>
      </div>
      <span className="text-xl opacity-50">›</span>
    </div>
  );
}

function Residents() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ Шинэ айл</button>
          <button className="bg-white border px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">📥 Excel оруулах</button>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="text-gray-500">Нийт: <b className="text-gray-900">{residents.length}</b></span>
          <span className="text-gray-500">Өртэй: <b className="text-red-500">{debtCount}</b></span>
          <span className="text-gray-500">Төлсөн: <b className="text-green-600">{residents.length - debtCount}</b></span>
        </div>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left font-medium px-5 py-3">Оршин суугч</th>
              <th className="text-left font-medium px-5 py-3">Тоот</th>
              <th className="text-left font-medium px-5 py-3">Утас</th>
              <th className="text-right font-medium px-5 py-3">Төлбөрийн байдал</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {residents.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">{r.name.charAt(0)}</div>
                    <span className="font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">🏠 {r.apt}</td>
                <td className="px-5 py-3 text-gray-600">📞 {r.phone}</td>
                <td className="px-5 py-3 text-right">
                  {r.debt > 0
                    ? <span className="text-red-500 font-bold">{fmt(r.debt)}₮ өртэй</span>
                    : <span className="text-green-600 font-medium">✅ Төлсөн</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payments() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-sm">
          <p className="text-sm opacity-90">Энэ сард цугласан</p>
          <p className="text-3xl font-bold mt-1">{fmt(sokh.totalPaid)}₮</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between">
            <div><p className="text-xs opacity-80">Цуглуулалт</p><p className="text-lg font-bold">{sokh.collectionRate}%</p></div>
            <div className="text-right"><p className="text-xs opacity-80">Үлдсэн өр</p><p className="text-lg font-bold">{fmt(sokh.totalDebt)}₮</p></div>
          </div>
        </div>
        <div className="col-span-2 bg-white rounded-xl border p-6 shadow-sm flex flex-col justify-center gap-3">
          <h3 className="font-semibold text-gray-700">Үйлдэл</h3>
          <div className="flex gap-3">
            <button className="bg-white border px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">📤 Тайлан татах</button>
            <button className="bg-white border px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">🔔 Өртэй айлд сануулах</button>
            <button className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">+ Гар төлбөр бүртгэх</button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">СҮҮЛИЙН ОРЛОГО</h3>
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left font-medium px-5 py-3">Оршин суугч</th>
                <th className="text-left font-medium px-5 py-3">Тоот</th>
                <th className="text-left font-medium px-5 py-3">Хэлбэр</th>
                <th className="text-left font-medium px-5 py-3">Огноо</th>
                <th className="text-right font-medium px-5 py-3">Дүн</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentPayments.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-gray-600">{p.apt}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{p.method}</span></td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{p.date}</td>
                  <td className="px-5 py-3 text-right text-green-600 font-bold">+{fmt(p.amount)}₮</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Announcements() {
  return (
    <div className="space-y-4">
      <button className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">+ Шинэ зарлал илгээх</button>
      <div className="grid grid-cols-3 gap-4">
        {announcements.map((a) => (
          <div key={a.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-2xl">{a.type}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{a.title}</h3>
                <p className="text-xs text-gray-400">Хүлээн авагч: {a.target} · {a.date}</p>
              </div>
            </div>
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ {a.status}</span>
              <span className="text-xs text-gray-500">👁 {a.views} харсан</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Maintenance() {
  const pending = maintenanceRequests.filter((r) => r.status === 'pending').length;
  const inProgress = maintenanceRequests.filter((r) => r.status === 'in_progress').length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🕐" label="Хүлээгдэж буй" value={String(pending)} cls="text-yellow-600" />
        <StatCard icon="🔧" label="Хийгдэж буй" value={String(inProgress)} cls="text-blue-600" />
        <StatCard icon="✅" label="Дууссан (сар)" value="15" cls="text-green-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">ИДЭВХТЭЙ ХҮСЭЛТҮҮД</h3>
        <div className="space-y-3">
          {maintenanceRequests.map((r) => {
            const statusCls = r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
            const statusLbl = r.status === 'pending' ? 'Хүлээгдэж буй' : 'Хийгдэж байна';
            const prCls = r.priority === 'high' ? 'bg-red-100 text-red-700' : r.priority === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
            const prLbl = r.priority === 'high' ? '🔴 Яаралтай' : r.priority === 'medium' ? '🟠 Дунд' : '⚪ Бага';
            return (
              <div key={r.id} className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-sm">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{r.resident} · {r.date}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${prCls}`}>{prLbl}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusCls}`}>{statusLbl}</span>
                <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Хариу өгөх</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Parking() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🚗" label="Бүртгэлтэй машин" value={String(parkingVehicles.length)} cls="text-indigo-700" />
        <StatCard icon="🎫" label="Зочин хэтэрсэн" value={String(guestVehicles.filter((g) => g.overdue).length)} cls="text-amber-600" />
        <StatCard icon="🚙" label="Эзэлсэн зогсоол" value="12/30" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">🚙 МАШИНУУД</h3>
          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {parkingVehicles.map((v) => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-lg">🚗</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-indigo-700">{v.plate}</p>
                  <p className="text-xs text-gray-500 truncate">{v.owner} ({v.apt}) · {v.model}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{v.spot}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">🎫 ЗОЧНЫ МАШИН</h3>
          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {guestVehicles.map((g) => (
              <div key={g.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{g.plate}</p>
                  <p className="text-xs text-gray-500">→ {g.host} ({g.apt}) · {g.entered}-аас, {g.allowed} мин</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {g.overdue ? 'Хэтэрсэн' : 'Идэвхтэй'}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-white rounded-xl border shadow-sm p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-2">🚧 ХААЛГА</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Холболт</span><span className="text-green-600 font-medium">● Холбогдсон</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Автомат</span><span className="text-blue-600 font-medium">Идэвхтэй</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reports() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="📥" label="Орлого" value={`${(totalIncome / 1e6).toFixed(1)}M₮`} cls="text-green-600" />
        <StatCard icon="📤" label="Зарлага" value={`${(totalExpense / 1e6).toFixed(1)}M₮`} cls="text-red-500" />
        <StatCard icon="💵" label="Үлдэгдэл" value={`${((totalIncome - totalExpense) / 1e6).toFixed(1)}M₮`} cls="text-blue-600" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-green-700 mb-4">📥 ОРЛОГО</h3>
          <div className="space-y-3">
            {incomeData.map((d) => (
              <div key={d.label}>
                <div className="flex justify-between text-sm mb-1"><span>{d.label}</span><span className="font-semibold">{fmt(d.amount)}₮</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${d.percent}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-red-700 mb-4">📤 ЗАРЛАГА</h3>
          <div className="space-y-3">
            {expenseData.map((d) => (
              <div key={d.label}>
                <div className="flex justify-between text-sm mb-1"><span>{d.label}</span><span className="font-semibold">{fmt(d.amount)}₮</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-red-400 h-2 rounded-full" style={{ width: `${d.percent}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiCenter({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-700 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">🧠 AI туслах</h2>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold">ШИНЭ</span>
        </div>
        <p className="text-sm text-white/80 mt-1">Өгөгдлөө шалгаад → AI бичиж өгнө → админ хянана → зөвшөөрөөд ашиглана. Автомат илгээдэггүй.</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">⚡ AI ҮЙЛДЭЛ <span className="font-normal text-gray-400">— дарж жишээг үзнэ үү</span></h3>
          <div className="grid grid-cols-2 gap-3">
            {aiActions.map((a) => (
              <button key={a.id} onClick={() => onOpen(a.id)}
                className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3 hover:border-purple-300 hover:shadow transition text-left">
                <span className="text-2xl shrink-0">{a.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 truncate">{a.sub}</p>
                </div>
                <span className="text-purple-500">→</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">🗂️ ӨГӨГДЛИЙН БЭЛЭН БАЙДАЛ</h3>
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-2">
            {[
              { label: 'Нэхэмжлэл (4-р сар)', count: 124, ready: true },
              { label: 'Төлөөгүй нэхэмжлэл', count: 35, ready: true },
              { label: 'Гомдол (4-р сар)', count: 3, ready: true },
              { label: 'Засварын хүсэлт', count: 8, ready: true },
              { label: 'Reserve fund бичилт', count: 0, ready: false },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${r.ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.ready ? '✓ Бэлэн' : '∅ Хоосон'}
                </span>
                <span className="flex-1">{r.label}</span>
                <span className="text-gray-400 font-mono">{r.count}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mt-4">
            ⚠️ AI зөвхөн санал гаргана. Тоог хүснэгтээс авна, өөрөө зохиохгүй. Илгээх эсэхийг та хариуцна.
          </div>
        </div>
      </div>
    </div>
  );
}

function EasyBox() {
  const occ = Math.round((easyBoxStats.occupied / easyBoxStats.totalBoxes) * 100);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="📦" label="Нийт хайрцаг" value={String(easyBoxStats.totalBoxes)} />
        <StatCard icon="🔒" label="Эзлэгдсэн" value={String(easyBoxStats.occupied)} cls="text-orange-600" />
        <StatCard icon="🔓" label="Чөлөөтэй" value={String(easyBoxStats.free)} cls="text-emerald-600" />
        <StatCard icon="📈" label="Эзэлгээ" value={`${occ}%`} />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">📜 ӨНӨӨДРИЙН ЯВЦ</h3>
          <div className="bg-white rounded-xl border shadow-sm divide-y">
            {easyBoxRecent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-700">{r.apt.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.apt}</p>
                  <p className="text-xs text-gray-500 truncate">{r.sender}</p>
                </div>
                <span className="text-xs text-gray-400">{r.time}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.state === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {r.state === 'waiting' ? 'Хүлээж буй' : 'Авсан'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-3">📊 САРЫН ХУРААНГУЙ</h3>
          <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
            <Row label="Нийт илгээмж" value={String(easyBoxStats.monthTotal)} />
            <Row label="Дундаж авах хугацаа" value={`${easyBoxStats.avgPickupHours} цаг`} />
            <Row label="Үйлчилгээний тогтвортой" value={`${easyBoxStats.uptime}%`} valueCls="text-green-600" />
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 mt-4">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-xs font-semibold text-green-800">Бүх хайрцаг хэвийн ажиллаж байна</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${valueCls || ''}`}>{value}</span>
    </div>
  );
}
