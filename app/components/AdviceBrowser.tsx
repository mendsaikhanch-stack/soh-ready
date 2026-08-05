'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CARDS,
  CATEGORIES,
  DISCLAIMER,
  getCategory,
  getDailyCard,
  type AdviceCard,
} from '@/app/lib/advice/data';
import { fetchViewCounts, recordView, type ViewCounts } from '@/app/lib/advice/views';
import { useBookmarks } from '@/app/lib/advice/bookmarks';

type Tab = 'all' | 'saved' | 'popular' | 'new';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Бүгд' },
  { id: 'popular', label: '🔥 Их уншсан' },
  { id: 'new', label: '🆕 Шинэ' },
  { id: 'saved', label: '⭐ Хадгалсан' },
];

export default function AdviceBrowser({ backHref }: { backHref?: string }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [openLaw, setOpenLaw] = useState<string | null>(null);
  const [views, setViews] = useState<ViewCounts>({});
  // Тоолуурын хүснэгт байгаа эсэх. Байхгүй бол "их уншсан" эрэмбэ утгагүй тул
  // хэрэглэгчид үүнийг ил хэлнэ — түр нэмэгдсэн локал тоог бодит мэт харуулахгүй.
  const [viewsFromDb, setViewsFromDb] = useState(false);
  const [toast, setToast] = useState('');
  const { bookmarks, toggleBookmark } = useBookmarks();

  const daily = useMemo(() => getDailyCard(), []);

  useEffect(() => {
    fetchViewCounts().then(counts => {
      if (!counts) return;
      setViewsFromDb(true);
      setViews(counts);
    });

    // Хуваалцсан холбоосоор орж ирвэл тухайн картыг нээх: ?card=<id>
    const shared = new URLSearchParams(window.location.search).get('card');
    if (!shared || !CARDS.some(c => c.id === shared)) return;

    recordView(shared);
    // Hydration дууссаны дараа нээнэ — effect дотор шууд setState хийхгүй.
    const timer = setTimeout(() => {
      setOpenDetail(shared);
      document.getElementById(`advice-${shared}`)?.scrollIntoView({ block: 'center' });
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }, []);

  const toggleDetail = useCallback(
    (id: string) => {
      const opening = openDetail !== id;
      setOpenDetail(opening ? id : null);
      if (opening) {
        recordView(id);
        setViews(v => ({ ...v, [id]: (v[id] || 0) + 1 }));
      }
    },
    [openDetail],
  );

  const share = useCallback(
    async (card: AdviceCard) => {
      const url = `${window.location.origin}${window.location.pathname}?card=${card.id}`;
      const text = `📌 ${card.title}\n❓ ${card.question}\n✅ ${card.answer}\n\n${DISCLAIMER}\n${url}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: `${card.title} — СӨХ-ийн зөвлөгөө`, text });
          return;
        }
        await navigator.clipboard.writeText(text);
        showToast('Хуулагдлаа — хаана ч наах боломжтой');
      } catch {
        // Хэрэглэгч хуваалцахаас татгалзсан — юу ч хийхгүй
      }
    },
    [showToast],
  );

  const hasViewData = viewsFromDb && Object.keys(views).length > 0;

  // Өнөөдрийн зөвлөгөө нь дээр тусдаа харагдах үед доорх жагсаалтаас хасна —
  // ижил карт хоёр удаа гарахгүй.
  const dailyShown = tab === 'all' && !activeCat && !query.trim();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = CARDS;

    if (tab === 'saved') list = list.filter(c => bookmarks.includes(c.id));
    if (activeCat) list = list.filter(c => c.category === activeCat);
    if (q) {
      list = list.filter(c => {
        const cat = getCategory(c.category)?.label || '';
        return `${c.title} ${c.question} ${c.answer} ${c.detail} ${cat}`.toLowerCase().includes(q);
      });
    }

    if (tab === 'popular') {
      list = [...list].sort((a, b) => (views[b.id] || 0) - (views[a.id] || 0));
    } else if (tab === 'new') {
      list = [...list].sort((a, b) => b.added.localeCompare(a.added));
    }
    if (dailyShown) list = list.filter(c => c.id !== daily.id);
    return list;
  }, [query, tab, activeCat, bookmarks, views, dailyShown, daily.id]);

  const renderCard = (card: AdviceCard, highlight = false) => {
    const cat = getCategory(card.category);
    const detailOpen = openDetail === card.id;
    const lawOpen = openLaw === card.id;
    const saved = bookmarks.includes(card.id);

    return (
      <div
        key={card.id}
        id={`advice-${card.id}`}
        className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
          highlight ? 'border-emerald-300' : 'border-gray-100'
        }`}
      >
        <div className="p-4">
          {/* Ангилал + хадгалах / хуваалцах */}
          <div className="flex items-start gap-2 mb-2">
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {cat?.icon} {cat?.label}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {tab === 'popular' && hasViewData && (views[card.id] || 0) > 0 && (
                <span className="text-[11px] text-gray-400 mr-1">{views[card.id]} уншсан</span>
              )}
              <button
                onClick={() => toggleBookmark(card.id)}
                aria-label={saved ? 'Хадгалснаас хасах' : 'Хадгалах'}
                className="text-lg leading-none px-1 active:scale-90 transition"
              >
                {saved ? '⭐' : '☆'}
              </button>
              <button
                onClick={() => share(card)}
                aria-label="Хуваалцах"
                className="text-base leading-none px-1 active:scale-90 transition"
              >
                🔗
              </button>
            </div>
          </div>

          {/* 📌 Гарчиг */}
          <h3 className="font-bold text-[15px] text-gray-900">📌 {card.title}</h3>

          {/* ❓ Асуулт */}
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">❓ {card.question}</p>

          {/* ✅ Богино хариулт */}
          <div className="mt-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <p className="text-sm text-emerald-900 leading-relaxed">✅ {card.answer}</p>
          </div>

          {/* Товчнууд */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => toggleDetail(card.id)}
              className="flex-1 text-xs font-medium py-2 rounded-lg border border-gray-200 text-gray-700 active:bg-gray-50 transition"
            >
              📖 Дэлгэрэнгүй {detailOpen ? '▲' : '▼'}
            </button>
            <button
              onClick={() => setOpenLaw(lawOpen ? null : card.id)}
              className="flex-1 text-xs font-medium py-2 rounded-lg border border-gray-200 text-gray-700 active:bg-gray-50 transition"
            >
              ⚖️ Холбогдох хууль {lawOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* 📖 Дэлгэрэнгүй */}
        {detailOpen && (
          <div className="px-4 pb-4 -mt-1">
            <div className="border-t border-gray-100 pt-3 space-y-2.5">
              {card.detail.split('\n\n').map((p, i) => (
                <p key={i} className="text-[13px] text-gray-600 leading-relaxed">
                  {p}
                </p>
              ))}
              {/* Тайлбар нь карт бүрийн төгсгөлд автоматаар нэмэгдэнэ */}
              <p className="text-[11px] text-gray-400 leading-relaxed pt-2 border-t border-dashed border-gray-200">
                ℹ️ {DISCLAIMER}
              </p>
            </div>
          </div>
        )}

        {/* ⚖️ Холбогдох хууль */}
        {lawOpen && (
          <div className="px-4 pb-4 -mt-1">
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {card.sources.map((src, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-[12px] font-medium text-gray-800 leading-snug">{src.law}</p>
                  {src.article && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{src.article}</p>
                  )}
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-[11px] text-blue-600 mt-1 underline"
                    >
                      Хуулийн эх бичвэрийг нээх →
                    </a>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1">
                      legalinfo.mn сайтаас нэрээр нь хайж эх бичвэрийг уншина уу
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                Эх сурвалж нь мэдээллийг хаанаас үзэхийг заасан заавч бөгөөд хуулийн эхийг энд
                хуулбарлаагүй болно.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Толгой */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-4">
        {backHref && (
          <Link href={backHref} className="text-white/80 text-sm mb-1 inline-block">
            ← Буцах
          </Link>
        )}
        <h1 className="text-lg font-bold">📚 СӨХ-ийн зөвлөгөө</h1>
        <p className="text-xs text-white/70 mt-0.5">
          Хуулийг уншихгүйгээр ойлгомжтой, богино мэдээлэл
        </p>
      </div>

      {/* Байнгын тайлбар */}
      <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
        <p className="text-[11px] text-amber-800 leading-relaxed">ℹ️ {DISCLAIMER}</p>
      </div>

      {/* Хайлт */}
      <div className="px-4 mt-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Асуултаа бичнэ үү — жишээ: зогсоол, дуу чимээ, тайлан"
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* Таб */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
              tab === t.id
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {t.label}
            {t.id === 'saved' && bookmarks.length > 0 && ` (${bookmarks.length})`}
          </button>
        ))}
      </div>

      {/* Ангилал */}
      <div className="flex gap-2 px-4 mt-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCat(null)}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${
            activeCat === null
              ? 'bg-gray-800 border-gray-800 text-white'
              : 'bg-white border-gray-200 text-gray-600'
          }`}
        >
          Бүх ангилал
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${
              activeCat === c.id
                ? 'bg-gray-800 border-gray-800 text-white'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Өнөөдрийн зөвлөгөө */}
      {dailyShown && (
        <div className="px-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">☀️ ӨНӨӨДРИЙН ЗӨВЛӨГӨӨ</h2>
          {renderCard(daily, true)}
        </div>
      )}

      {/* Жагсаалт */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">
            {tab === 'saved'
              ? '⭐ ХАДГАЛСАН'
              : tab === 'popular'
                ? '🔥 ХАМГИЙН ИХ УНШСАН'
                : tab === 'new'
                  ? '🆕 ШИНЭЭР НЭМЭГДСЭН'
                  : 'БҮХ АСУУЛТ'}
          </h2>
          <span className="text-xs text-gray-400">{filtered.length}</span>
        </div>

        {tab === 'popular' && !hasViewData && (
          <p className="text-xs text-gray-400 mb-2">
            Уншилтын тоо хараахан бүртгэгдээгүй байна — ердийн дарааллаар харуулж байна.
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-3xl mb-2">{tab === 'saved' ? '⭐' : '🔍'}</p>
            <p className="text-sm text-gray-500">
              {tab === 'saved'
                ? 'Хадгалсан зөвлөгөө байхгүй байна. Картын ☆ товчийг дарж хадгална.'
                : 'Илэрц олдсонгүй. Өөр үгээр хайж үзнэ үү.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">{filtered.map(c => renderCard(c))}</div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
