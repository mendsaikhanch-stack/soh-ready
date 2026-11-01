'use client';

import { useEffect, useRef } from 'react';

/**
 * `fn`-ийг зөвхөн хуудас харагдаж байх үед `intervalMs` тутам, мөн хуудас буцаж
 * харагдах мөчид дуудна. Supabase Realtime `postgres_changes`-ийг орлоно:
 * Free/Nano instance-д Realtime-ийн холболтууд + WAL decoding нь санах ой/swap-ийг
 * дарамталж байсан (docs/disk-io-audit-2026-11-01.local.md).
 * Өмнөх дуудлага дуусаагүй бол дараагийнхыг алгасна.
 */
export function useVisiblePolling(fn: () => unknown | Promise<unknown>, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try { await fnRef.current(); } catch { /* сүлжээгүй — дараагийн удаа */ } finally { busy = false; }
    };
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}
