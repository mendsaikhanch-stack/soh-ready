'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface City { id: number; name: string; }
interface District { id: number; city_id: number; name: string; }
interface Khoroo { id: number; district_id: number; name: string; }
interface SokhOrg { id: number; khoroo_id: number; name: string; address: string; phone: string; }

export default function Home() {
  const [step, setStep] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);
  const [sokhList, setSokhList] = useState<SokhOrg[]>([]);

  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedKhoroo, setSelectedKhoroo] = useState<Khoroo | null>(null);
  const [selectedSokh, setSelectedSokh] = useState<SokhOrg | null>(null);

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [error, setError] = useState('');

  // Хот татах
  useEffect(() => {
    const fetchCities = async () => {
      const { data, error } = await supabase.from('cities').select('*').order('name');
      if (error) {
        setError(error.message);
        console.error('Cities error:', error);
      } else {
        setCities(data || []);
      }
    };
    fetchCities();
  }, []);

  // Дүүрэг татах
  const selectCity = async (city: City) => {
    setSelectedCity(city);
    setSelectedDistrict(null);
    setSelectedKhoroo(null);
    setSelectedSokh(null);
    setLoading(true);

    const { data } = await supabase
      .from('districts')
      .select('*')
      .eq('city_id', city.id)
      .order('name');

    setDistricts(data || []);
    setLoading(false);
    setStep(2);
  };

  // Хороо татах
  const selectDistrict = async (district: District) => {
    setSelectedDistrict(district);
    setSelectedKhoroo(null);
    setSelectedSokh(null);
    setLoading(true);

    const { data } = await supabase
      .from('khoroos')
      .select('*')
      .eq('district_id', district.id)
      .order('name');

    setKhoroos(data || []);
    setLoading(false);
    setStep(3);
  };

  // СӨХ татах
  const selectKhoroo = async (khoroo: Khoroo) => {
    setSelectedKhoroo(khoroo);
    setSelectedSokh(null);
    setLoading(true);

    const { data } = await supabase
      .from('sokh_organizations')
      .select('*')
      .eq('khoroo_id', khoroo.id)
      .order('name');

    setSokhList(data || []);
    setLoading(false);
    setStep(4);
  };

  // СӨХ сонгох → дэлгэрэнгүй хуудас руу
  const selectSokh = (sokh: SokhOrg) => {
    router.push(`/sokh/${sokh.id}`);
  };

  // Буцах
  const goBack = () => {
    if (step === 2) {
      setSelectedCity(null);
      setStep(1);
    } else if (step === 3) {
      setSelectedDistrict(null);
      setStep(2);
    } else if (step === 4) {
      setSelectedKhoroo(null);
      setStep(3);
    } else if (step === 5) {
      setSelectedSokh(null);
      setStep(4);
    }
  };

  const stepLabels = ['Хот', 'Дүүрэг', 'Хороо', 'СӨХ', 'Бэлэн'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <h1 className="text-lg font-bold text-center">🏠 Хотол</h1>
      </div>

      {/* Progress */}
      <div className="flex px-4 py-3 gap-1">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex-1 text-center">
            <div
              className={`h-1.5 rounded-full mb-1 ${
                i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
            <span className={`text-xs ${i + 1 <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Breadcrumb */}
      {step > 1 && (
        <div className="px-4 pb-2">
          <button onClick={goBack} className="text-blue-600 text-sm flex items-center gap-1">
            ← Буцах
          </button>
          <p className="text-xs text-gray-500 mt-1">
            {selectedCity?.name}
            {selectedDistrict ? ` → ${selectedDistrict.name}` : ''}
            {selectedKhoroo ? ` → ${selectedKhoroo.name}` : ''}
            {selectedSokh ? ` → ${selectedSokh.name}` : ''}
          </p>
        </div>
      )}

      <div className="px-4 py-2">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-sm">
            Алдаа: {error}
          </div>
        )}

        {/* Step 1: Хот сонгох */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Хот сонгоно уу</h2>
            <div className="space-y-2">
              {cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => selectCity(city)}
                  className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition"
                >
                  <span className="font-medium">{city.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Дүүрэг сонгох */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Дүүрэг сонгоно уу</h2>
            {loading ? (
              <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
            ) : (
              <div className="space-y-2">
                {districts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => selectDistrict(d)}
                    className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition"
                  >
                    <span className="font-medium">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Хороо сонгох */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Хороо сонгоно уу</h2>
            {loading ? (
              <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {khoroos.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => selectKhoroo(k)}
                    className="bg-white p-3 rounded-xl shadow-sm text-center hover:bg-blue-50 active:bg-blue-100 transition"
                  >
                    <span className="font-medium text-sm">{k.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: СӨХ сонгох */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">СӨХ сонгоно уу</h2>
            {loading ? (
              <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
            ) : sokhList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">Энэ хороонд бүртгэлтэй СӨХ байхгүй байна</p>
                <p className="text-gray-300 text-sm">Удахгүй нэмэгдэнэ</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sokhList.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSokh(s)}
                    className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition"
                  >
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.address}</p>
                    {s.phone && <p className="text-sm text-gray-400">📞 {s.phone}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: СӨХ сонгогдсон */}
        {step === 5 && selectedSokh && (
          <div>
            <div className="bg-white p-5 rounded-xl shadow-sm mb-4">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">✅</div>
                <h2 className="text-lg font-semibold">СӨХ сонгогдлоо</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Хот</span>
                  <span className="font-medium">{selectedCity?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Дүүрэг</span>
                  <span className="font-medium">{selectedDistrict?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Хороо</span>
                  <span className="font-medium">{selectedKhoroo?.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">СӨХ</span>
                  <span className="font-medium">{selectedSokh.name}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Хаяг</span>
                  <span className="font-medium">{selectedSokh.address}</span>
                </div>
              </div>
            </div>
            <button
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 active:bg-blue-800 transition"
            >
              Үргэлжлүүлэх →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
