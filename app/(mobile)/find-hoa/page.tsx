'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import HoaSearch, { type HoaSearchResult } from '@/app/components/signup/HoaSearch';
import HoaRequestForm from '@/app/components/signup/HoaRequestForm';
import HoaManualSignup from '@/app/components/signup/HoaManualSignup';

type Mode = 'search' | 'request' | 'manual';

interface City { id: number; name: string }
interface District { id: number; city_id: number; name: string }
interface Khoroo { id: number; district_id: number; name: string }

// Master directory дээр суурилсан "СӨХ хайх" entry хуудас.
// Хуучин /select хуудас (Хот→Дүүрэг→Хороо→СӨХ) хэвээр ажиллана,
// харин энэ нь нэрээр шууд хайх + олдоогүй үед гар оролтоор үргэлжлүүлэх.
export default function FindHoaPage() {
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);

  const [city, setCity] = useState<City | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [khoroo, setKhoroo] = useState<Khoroo | null>(null);

  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingKhoroos, setLoadingKhoroos] = useState(false);

  const [mode, setMode] = useState<Mode>('search');
  const [selected, setSelected] = useState<HoaSearchResult | null>(null);

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase.from('cities').select('*').order('name');
      if (data) {
        const priority = ['Улаанбаатар', 'Эрдэнэт', 'Дархан'];
        data.sort((a, b) => {
          const ai = priority.indexOf(a.name);
          const bi = priority.indexOf(b.name);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.name.localeCompare(b.name, 'mn');
        });
        setCities(data);
      }
      setLoadingCities(false);
    };
    fetchCities();
  }, []);

  const selectCity = async (c: City) => {
    setCity(c);
    setDistrict(null);
    setKhoroo(null);
    setDistricts([]);
    setKhoroos([]);
    setLoadingDistricts(true);
    const { data } = await supabase.from('districts').select('*').eq('city_id', c.id).order('name');
    setDistricts(data || []);
    setLoadingDistricts(false);
  };

  const selectDistrict = async (d: District) => {
    setDistrict(d);
    setKhoroo(null);
    setKhoroos([]);
    setLoadingKhoroos(true);
    const { data } = await supabase.from('khoroos').select('*').eq('district_id', d.id).order('name');
    setKhoroos(data || []);
    setLoadingKhoroos(false);
  };

  const onSelect = (r: HoaSearchResult) => {
    setSelected(r);
    if (r.is_active_tenant && r.linked_tenant_id) {
      router.push(`/sokh/${r.linked_tenant_id}`);
    }
  };

  const resetLocation = () => {
    setCity(null);
    setDistrict(null);
    setKhoroo(null);
    setDistricts([]);
    setKhoroos([]);
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">1. Байршил</h2>
            {(city || district || khoroo) && (
              <button onClick={resetLocation} className="text-xs text-blue-600 hover:underline">
                Шинээр
              </button>
            )}
          </div>

          {/* Breadcrumb */}
          {(city || district || khoroo) && (
            <div className="flex flex-wrap items-center gap-1 mb-3 text-xs">
              {city && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                  {city.name}
                </span>
              )}
              {district && (
                <>
                  <span className="text-gray-300">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                    {district.name}
                  </span>
                </>
              )}
              {khoroo && (
                <>
                  <span className="text-gray-300">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                    {khoroo.name}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Step 1: City */}
          {!city && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Хот сонгох</label>
              {loadingCities ? (
                <p className="text-xs text-gray-400 py-2">Ачаалж байна...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {cities.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCity(c)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 transition"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: District */}
          {city && !district && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Дүүрэг сонгох</label>
              {loadingDistricts ? (
                <p className="text-xs text-gray-400 py-2">Ачаалж байна...</p>
              ) : districts.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Дүүрэг олдсонгүй</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {districts.map(d => (
                    <button
                      key={d.id}
                      onClick={() => selectDistrict(d)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 transition"
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Khoroo (заавал биш — шүүлт) */}
          {city && district && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Хороо <span className="text-gray-400 font-normal">(заавал биш — шүүлт)</span>
              </label>
              {loadingKhoroos ? (
                <p className="text-xs text-gray-400 py-2">Ачаалж байна...</p>
              ) : khoroos.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Хороо олдсонгүй</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setKhoroo(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      !khoroo
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    Бүх хороо
                  </button>
                  {khoroos.map(k => (
                    <button
                      key={k.id}
                      onClick={() => setKhoroo(khoroo?.id === k.id ? null : k)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        khoroo?.id === k.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {k.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {mode === 'search' && (
          <>
            {/* 2. СӨХ-ийн жагсаалт / нэрээр хайх */}
            <section className="bg-white border rounded-2xl p-4 mb-3">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                2. СӨХ {district ? `· ${district.name}${khoroo ? ' · ' + khoroo.name : ''}` : ''}
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                {district
                  ? 'Доорх жагсаалтаас өөрийн СӨХ-ийг сонгох эсвэл нэрээр хайна уу.'
                  : 'Дүүргээ сонгосны дараа СӨХ-ийн жагсаалт автоматаар гарна.'}
              </p>
              <HoaSearch
                autoFocus={!!district}
                district={district?.name}
                khoroo={khoroo?.name}
                onSelect={onSelect}
                onNotFound={() => setMode('manual')}
                placeholder="СӨХ-ийн нэрээр шүүх (заавал биш)"
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
              defaultDistrict={district?.name || ''}
              defaultKhoroo={khoroo?.name || ''}
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
              defaultCity={city?.name || ''}
              defaultDistrict={district?.name || ''}
              defaultKhoroo={khoroo?.name || ''}
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
