'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sokh, aiActions, type AiAction } from '@/app/lib/demo/admin-mock';
import * as S from './Screens';

// Desktop (ПС) демо — СӨХ админ ажлын талбар, жинхэнэ /admin-ийн бүх модультай.
// Утасны /demo-admin-аас ялгаатай нь бүтэн desktop layout: зүүн sidebar + өргөн агуулга.

type NavId =
  | 'dashboard' | 'residents' | 'payments' | 'finance'
  | 'announcements' | 'messages' | 'complaints' | 'polls'
  | 'maintenance' | 'elevator' | 'utilities' | 'packages' | 'parking' | 'booking' | 'easybox'
  | 'emergency' | 'cctv'
  | 'staff' | 'marketplace' | 'shops'
  | 'ai' | 'workflows' | 'reviewqueue' | 'reports' | 'demand' | 'directory' | 'import'
  | 'branding' | 'features';

type Item = { id: NavId; label: string; icon: string };
const GROUPS: { group: string; items: Item[] }[] = [
  { group: 'Үндсэн', items: [
    { id: 'dashboard', label: 'Хянах самбар', icon: '📊' },
    { id: 'residents', label: 'Оршин суугчид', icon: '👥' },
    { id: 'payments', label: 'Төлбөр', icon: '💰' },
    { id: 'finance', label: 'Санхүү', icon: '🏦' },
  ]},
  { group: 'Харилцаа', items: [
    { id: 'announcements', label: 'Зарлал', icon: '📢' },
    { id: 'messages', label: 'Мессеж', icon: '💬' },
    { id: 'complaints', label: 'Гомдол / Санал', icon: '📝' },
    { id: 'polls', label: 'Санал хураалт', icon: '🗳' },
  ]},
  { group: 'Үйлчилгээ', items: [
    { id: 'maintenance', label: 'Засвар', icon: '🔧' },
    { id: 'elevator', label: 'Лифт засвар', icon: '🛗' },
    { id: 'utilities', label: 'Ашиглалт', icon: '📊' },
    { id: 'packages', label: 'Илгээмж', icon: '📦' },
    { id: 'parking', label: 'Зогсоол', icon: '🚗' },
    { id: 'booking', label: 'Зай захиалга', icon: '🏢' },
    { id: 'easybox', label: 'EasyBox', icon: '🗄' },
  ]},
  { group: 'Аюулгүй байдал', items: [
    { id: 'emergency', label: 'Яаралтай', icon: '🚨' },
    { id: 'cctv', label: 'Камер (CCTV)', icon: '📹' },
  ]},
  { group: 'Ажилтан & Гадны', items: [
    { id: 'staff', label: 'Ажилчид', icon: '👷' },
    { id: 'marketplace', label: 'Хөрш маркет', icon: '🏪' },
    { id: 'shops', label: 'Дэлгүүр & Автомат', icon: '🥤' },
  ]},
  { group: 'Дата & Ухаан', items: [
    { id: 'ai', label: 'AI туслах', icon: '🧠' },
    { id: 'workflows', label: 'Автомат дүрэм', icon: '⚙️' },
    { id: 'reviewqueue', label: 'Хяналтын дараалал', icon: '📥' },
    { id: 'reports', label: 'Санхүүгийн тайлан', icon: '📈' },
    { id: 'demand', label: 'Эрэлт', icon: '📈' },
    { id: 'directory', label: 'СӨХ Directory', icon: '📚' },
    { id: 'import', label: 'Файл импорт', icon: '📤' },
  ]},
  { group: 'Тохиргоо', items: [
    { id: 'branding', label: 'Брэнд тохиргоо', icon: '🎨' },
    { id: 'features', label: 'Үйлчилгээ тохиргоо', icon: '🎛' },
  ]},
];

const ALL_ITEMS: Item[] = GROUPS.flatMap((g) => g.items);

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

  const current = ALL_ITEMS.find((n) => n.id === nav)!;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <div className="bg-yellow-400 text-yellow-900 text-center py-1.5 text-xs font-semibold flex-shrink-0">
        Демо горим — СӨХ Удирдлага (ПС хувилбар) · Жишээ өгөгдөл · {ALL_ITEMS.length} модуль
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className="w-60 bg-gray-900 text-white flex-shrink-0 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">{sokh.manager.charAt(0)}</div>
              <div className="min-w-0"><p className="text-sm font-bold truncate">🏢 {sokh.name}</p><p className="text-[11px] text-gray-400">Удирдлагын панел</p></div>
            </div>
          </div>
          <nav className="p-2 flex-1 overflow-y-auto">
            {GROUPS.map((g) => (
              <div key={g.group} className="mb-2">
                <p className="px-3 mt-2 mb-1 text-[10px] uppercase tracking-wider text-gray-500">{g.group}</p>
                {g.items.map((item) => {
                  const active = nav === item.id;
                  return (
                    <button key={item.id} onClick={() => setNav(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left mb-0.5 transition ${active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
                      <span className="text-base">{item.icon}</span><span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-700">
            <button onClick={() => router.push('/')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"><span>🚪</span><span>Гарах (демо)</span></button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div><h1 className="text-xl font-bold text-gray-900">{current.icon} {current.label}</h1><p className="text-xs text-gray-400">{sokh.name} · {sokh.address}</p></div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">2026 оны 4-р сар</span>
              <div className="flex items-center gap-2 pl-2"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">{sokh.manager.charAt(0)}</div><div className="text-right"><p className="text-sm font-medium leading-tight">{sokh.manager}</p><p className="text-[10px] text-gray-400">СӨХ Дарга</p></div></div>
            </div>
          </div>

          <div className="p-8">
            {nav === 'dashboard' && <S.Dashboard onOpenAi={() => setNav('ai')} />}
            {nav === 'residents' && <S.Residents />}
            {nav === 'payments' && <S.Payments />}
            {nav === 'finance' && <S.Finance />}
            {nav === 'announcements' && <S.Announcements />}
            {nav === 'messages' && <S.Messages />}
            {nav === 'complaints' && <S.Complaints />}
            {nav === 'polls' && <S.Polls />}
            {nav === 'maintenance' && <S.Maintenance />}
            {nav === 'elevator' && <S.Elevator />}
            {nav === 'utilities' && <S.Utilities />}
            {nav === 'packages' && <S.Packages />}
            {nav === 'parking' && <S.Parking />}
            {nav === 'booking' && <S.Booking />}
            {nav === 'easybox' && <S.EasyBox />}
            {nav === 'emergency' && <S.Emergency />}
            {nav === 'cctv' && <S.Cctv />}
            {nav === 'staff' && <S.Staff />}
            {nav === 'marketplace' && <S.Marketplace />}
            {nav === 'shops' && <S.Shops />}
            {nav === 'ai' && <S.AiCenter onOpen={setAiId} />}
            {nav === 'workflows' && <S.Workflows />}
            {nav === 'reviewqueue' && <S.ReviewQueue />}
            {nav === 'reports' && <S.Reports />}
            {nav === 'demand' && <S.Demand />}
            {nav === 'directory' && <S.Directory />}
            {nav === 'import' && <S.ImportScreen />}
            {nav === 'branding' && <S.Branding />}
            {nav === 'features' && <S.Features />}
          </div>
        </main>
      </div>

      {/* AI draft modal */}
      {ai && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeAi} role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white rounded-2xl max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-start gap-3">
              <span className="text-2xl shrink-0">{ai.emoji}</span>
              <div className="flex-1 min-w-0"><p className="font-bold">{ai.title}</p><p className="text-xs text-gray-500">Хэлбэр: <span className="font-semibold text-gray-700">{ai.channel}</span>{ai.charLimit && ` · ≤${ai.charLimit} тэмдэгт`}</p></div>
              <button onClick={closeAi} aria-label="Хаах" className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex-1">
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {ai.badges.map((b, i) => {
                  const cls = b.kind === 'template' ? 'bg-blue-100 text-blue-700 border-blue-200' : b.kind === 'ai' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  return <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{b.label}</span>;
                })}
              </div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">🗂️ Ашигласан өгөгдөл</p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
                {ai.inputs.map((inp, i) => (<div key={i} className="flex items-center justify-between text-xs"><span className="text-gray-600">{inp.label}</span><span className="font-mono font-semibold text-gray-900">{inp.value}</span></div>))}
              </div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1.5">📝 Эх хувилбар</p>
              <pre className="bg-gray-50 border rounded-lg p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap text-gray-900">{ai.draft}</pre>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 mt-4">⚠️ Автомат илгээгдэхгүй — та хянаж зөвшөөрсний дараа л явна</div>
            </div>
            <div className="border-t p-3 grid grid-cols-3 gap-2">
              <button onClick={() => copyDraft(ai)} className={`text-sm font-semibold py-2.5 rounded-lg transition ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{copied ? '✓ Хуулсан' : '📋 Хуулах'}</button>
              <button className="text-sm font-semibold py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition">✏️ Засах</button>
              <button onClick={() => setApproved(true)} disabled={approved} className={`text-sm font-semibold py-2.5 rounded-lg transition ${approved ? 'bg-emerald-600 text-white' : 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'}`}>{approved ? '✓ Зөвшөөрсөн' : '✓ Зөвшөөрөх'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
