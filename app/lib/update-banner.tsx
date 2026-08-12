'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * "Шинэ хувилбар гарлаа" зурвас.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ:
 * Android апп маань вэбсайтыг WebView дотор ачаалдаг бөгөөд хэрэглэгчид
 * аппаа хэдэн өдрөөр хаадаггүй. Next.js нь хуудас солиход JS багцаа дахин
 * татдаггүй тул нэг удаа ачаалсан ХУУЧИН код тэр чигээрээ үлддэг —
 * бид deploy хийсэн ч тэд хуучнаараа ажилласаар байдаг.
 *
 * ЯАЖ АЖИЛЛАДАГ ВЭ:
 * Багцад build үеийн хувилбар шингэсэн (NEXT_PUBLIC_APP_VERSION). Үүнийг
 * /api/version-ээс ирэх амьд хувилбартай харьцуулна. Зөрвөл дээд талд
 * нимгэн зурвас гарна.
 *
 * ЯАГААД АВТОМАТААР RELOAD ХИЙХГҮЙ ВЭ:
 * Хэрэглэгч маягт бөглөж, зураг хавсаргаж байж магадгүй. Дуугүй reload
 * хийвэл тэр ажил үрэгдэнэ. Тиймээс сонголтыг нь хэрэглэгчид үлдээв.
 */

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 минут тутам
const DISMISS_KEY = 'hotol-update-dismissed';

export default function UpdateBanner() {
  const [liveVersion, setLiveVersion] = useState<string | null>(null);

  const check = useCallback(async () => {
    // Локал хөгжүүлэлтэд хувилбар гэж байхгүй — шалгах утгагүй
    if (BUILD_VERSION === 'dev') return;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.version === 'string') setLiveVersion(data.version);
    } catch {
      // Сүлжээгүй байж магадгүй — чимээгүй өнгөрнө
    }
  }, []);

  useEffect(() => {
    check();

    // Апп нуруу руугаа орчихоод буцаж ирэх үе — хамгийн түгээмэл мөч.
    // WebView дотор ч visibilitychange хэвийн ажилладаг тул Capacitor-ийн
    // тусгай plugin шаардлагагүй (вэб хөтөч дээр ч ижил ажиллана).
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      clearInterval(timer);
    };
  }, [check]);

  const outdated = !!liveVersion && liveVersion !== BUILD_VERSION;

  // Хэрэглэгч ЯГ энэ хувилбарын зурвасыг хаасан бол дахин зовоохгүй.
  // Дараагийн deploy гармагц шинэ хувилбар тул зурвас дахин гарна.
  const dismissed =
    outdated && typeof window !== 'undefined' &&
    (() => { try { return sessionStorage.getItem(DISMISS_KEY) === liveVersion; } catch { return false; } })();

  if (!outdated || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white shadow-lg">
      <div className="flex items-center gap-3 px-4 py-2.5 max-w-2xl mx-auto">
        <span className="text-lg">🎉</span>
        <p className="flex-1 text-sm font-medium leading-tight">
          Шинэ хувилбар гарлаа
          <span className="block text-[11px] font-normal text-blue-100">
            Шинэчлэхэд одоогийн бөглөж буй мэдээлэл алдагдаж болзошгүй
          </span>
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-white text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition whitespace-nowrap"
        >
          Шинэчлэх
        </button>
        <button
          onClick={() => {
            try { sessionStorage.setItem(DISMISS_KEY, liveVersion!); } catch { /* ignore */ }
            setLiveVersion(null);
          }}
          aria-label="Хаах"
          className="text-blue-200 text-xl leading-none px-1 active:scale-95"
        >
          ×
        </button>
      </div>
    </div>
  );
}
