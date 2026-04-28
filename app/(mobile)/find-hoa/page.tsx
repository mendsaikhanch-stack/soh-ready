'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import HoaSearch, { type HoaSearchResult } from '@/app/components/signup/HoaSearch';
import HoaRequestForm from '@/app/components/signup/HoaRequestForm';
import HoaManualSignup from '@/app/components/signup/HoaManualSignup';

type Mode = 'search' | 'request' | 'manual';

// Master directory дээр суурилсан "СӨХ хайх" entry хуудас.
// Хуучин /select хуудас (Хот→Дүүрэг→Хороо→СӨХ) хэвээр ажиллана,
// харин энэ нь нэрээр шууд хайх + олдоогүй үед гар оролтоор үргэлжлүүлэх.
export default function FindHoaPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [khoroo, setKhoroo] = useState('');
  const [mode, setMode] = useState<Mode>('search');
  const [selected, setSelected] = useState<HoaSearchResult | null>(null);

  const onSelect = (r: HoaSearchResult) => {
    setSelected(r);
    if (r.is_active_tenant && r.linked_tenant_id) {
      router.push(`/sokh/${r.linked_tenant_id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.back()} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">СӨХ хайх</h1>
      </div>

      <div className="px-4 py-4">
        {/* 1. Байршил — Хот / Дүүрэг / Хороо нь үргэлж дээд талд харагдана */}
        <section className="bg-white border rounded-2xl p-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">1. Байршил</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Хот</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Жишээ: Улаанбаатар"
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дүүрэг</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Дүүрэг"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Хороо</label>
                <input
                  value={khoroo}
                  onChange={(e) => setKhoroo(e.target.value)}
                  placeholder="Хороо"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
                />
              </div>
            </div>
          </div>
        </section>

        {mode === 'search' && (
          <>
            {/* 2. СӨХ-ийн нэрээр хайх — байршлын талбаруудын доор */}
            <section className="bg-white border rounded-2xl p-4 mb-3">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">2. СӨХ-ийн нэр</h2>
              <p className="text-xs text-gray-500 mb-3">Байршлаа сонгосны дараа СӨХ-ийн нэрийг бичиж хайна уу.</p>
              <HoaSearch
                autoFocus
                district={district || undefined}
                khoroo={khoroo || undefined}
                onSelect={onSelect}
                onNotFound={() => setMode('manual')}
                placeholder="СӨХ-ийн нэр"
              />
            </section>

            {selected && !selected.is_active_tenant && (
              <div className="mt-4 bg-white border rounded-xl p-4">
                <p className="font-medium">{selected.official_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Энэ СӨХ хараахан Хотол дээр идэвхжээгүй байна. Бид түүний удирдлагатай холбогдоно.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setMode('request')}
                    className="px-3 py-2 border rounded-lg text-xs"
                  >
                    Хүлээлгийн хүсэлт
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                  >
                    Гараар үргэлжлүүлэх
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <button onClick={() => setMode('manual')} className="text-sm text-blue-600 hover:underline">
                СӨХ олдохгүй байна уу? Гараар оруулах →
              </button>
            </div>
          </>
        )}

        {mode === 'request' && (
          <div className="bg-white border rounded-2xl p-4">
            <button onClick={() => setMode('search')} className="text-xs text-blue-600 mb-2">← Хайлт руу</button>
            <h2 className="text-base font-semibold mb-3">СӨХ-ээ нэмүүлэх хүсэлт</h2>
            <HoaRequestForm
              defaultName={selected?.official_name || ''}
              defaultDistrict={district}
              defaultKhoroo={khoroo}
              onCancel={() => setMode('search')}
            />
          </div>
        )}

        {mode === 'manual' && (
          <div className="bg-white border rounded-2xl p-4">
            <button onClick={() => setMode('search')} className="text-xs text-blue-600 mb-2">← Хайлт руу</button>
            <h2 className="text-base font-semibold mb-3">Өөрийн СӨХ-ийг гараар оруулах</h2>
            <HoaManualSignup
              defaultName={selected?.official_name || ''}
              defaultCity={city}
              defaultDistrict={district}
              defaultKhoroo={khoroo}
              onCancel={() => setMode('search')}
            />
          </div>
        )}

        <div className="mt-8 pt-4 border-t flex justify-center gap-4 text-xs text-gray-400">
          <a href="/help" className="hover:text-gray-600">Тусламж</a>
          <a href="/privacy" className="hover:text-gray-600">Нууцлал</a>
          <a href="/legal" className="hover:text-gray-600">Бүх нөхцөл</a>
        </div>
      </div>
    </div>
  );
}
