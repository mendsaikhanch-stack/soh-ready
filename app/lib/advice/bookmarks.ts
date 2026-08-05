'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

// Хадгалсан зөвлөгөө — localStorage дээр, сервер рүү юу ч илгээхгүй.
// useSyncExternalStore ашигласан шалтгаан: effect дотор setState дуудвал
// react-hooks/set-state-in-effect дүрэм build-ыг унагаадаг.

const KEY = 'khotol.advice.bookmarks';

const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function notify() {
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', notify);
  };
}

// Snapshot нь string тул агуулга өөрчлөгдөөгүй бол ижил утга буцна.
function getServerSnapshot() {
  return '[]';
}

function parse(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  const list = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((id: string) => {
    const current = parse(readRaw());
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // private mode — хадгалахгүй ч уншихад саад болохгүй
    }
    notify();
  }, []);

  return { bookmarks: list, toggleBookmark: toggle };
}
