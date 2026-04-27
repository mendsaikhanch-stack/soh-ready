'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface HoaSearchResult {
  id: number;
  official_name: string;
  display_name: string | null;
  district: string | null;
  khoroo: string | null;
  address: string | null;
  is_active_tenant: boolean;
  linked_tenant_id: number | null;
  matched_alias?: string | null;
  score?: number;
}

interface HoaSearchProps {
  district?: string;
  khoroo?: string;
  onSelect: (result: HoaSearchResult) => void;
  onNotFound?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

// Бүртгэл хэсэгт ашиглах СӨХ хайлтын reusable component.
// Нэр + (заавал биш) дүүрэг/хороогоор debounce search хийнэ.
export default function HoaSearch({ district, khoroo, onSelect, onNotFound, placeholder, autoFocus }: HoaSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HoaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const searchKey = useMemo(() => `${query.trim()}::${district || ''}::${khoroo || ''}`, [query, district, khoroo]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim() && !district && !khoroo) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (district) params.set('district', district);
        if (khoroo) params.set('khoroo', khoroo);
        params.set('limit', '15');
        const res = await fetch(`/api/signup/search-hoa?${params}`);
        const data = await res.json();
        setResults(data.results || []);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchKey, query, district, khoroo]);

  return (
    <div>
      <input
        autoFocus={autoFocus}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || 'СӨХ-ийн нэр / хаяг хайх...'}
        className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
      />

      <div className="mt-2 space-y-2">
        {loading && <p className="text-xs text-gray-400 text-center py-2">Хайж байна...</p>}

        {!loading && results.length > 0 && results.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="w-full bg-white border rounded-xl p-3 text-left hover:bg-blue-50 active:bg-blue-100 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {r.official_name}
                </p>
                {r.matched_alias && r.matched_alias !== r.official_name && (
                  <p className="text-xs text-blue-500 truncate">also: {r.matched_alias}</p>
                )}
                <p className="text-xs text-gray-500 truncate">
                  {r.district || ''}{r.khoroo ? ` / ${r.khoroo}` : ''}
                </p>
                {r.address && <p className="text-xs text-gray-400 truncate">{r.address}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {r.is_active_tenant ? (
                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] whitespace-nowrap">
                    Khotol идэвхтэй
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] whitespace-nowrap">
                    Бүртгэлтэй, идэвхжээгүй
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {!loading && searched && results.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-sm font-medium text-yellow-800 mb-1">СӨХ олдсонгүй</p>
            <p className="text-xs text-yellow-700 mb-3">
              Та тэмдэглэлээ үлдээвэл бид нэмэх болно.
            </p>
            {onNotFound && (
              <button
                onClick={onNotFound}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-xs font-semibold hover:bg-yellow-700"
              >
                СӨХ-ээ нэмүүлэх хүсэлт илгээх
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
