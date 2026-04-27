'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface City { id: number; name: string; }
interface District { id: number; city_id: number; name: string; }
interface Khoroo { id: number; district_id: number; name: string; }
interface SokhOrg { id: number; khoroo_id: number; name: string; address: string; phone: string; }

export default function RegisterPage() {
  const router = useRouter();

  // Step: 1=хот, 2=дүүрэг, 3=хороо, 4=сөх, 5=хувийн мэдээлэл
  const [step, setStep] = useState(1);

  // Байршлын state
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);
  const [sokhList, setSokhList] = useState<SokhOrg[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedKhoroo, setSelectedKhoroo] = useState<Khoroo | null>(null);
  const [selectedSokh, setSelectedSokh] = useState<SokhOrg | null>(null);

  // Хувийн мэдээлэл
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [apartment, setApartment] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [door, setDoor] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');

  const stepLabels = ['Хот', 'Дүүрэг', 'Хороо', 'СӨХ', 'Мэдээлэл'];

  // Хот татах (Улаанбаатар → Эрдэнэт → Дархан → бусад)
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
    };
    fetchCities();
  }, []);

  const selectCity = async (city: City) => {
    setSelectedCity(city);
    setListLoading(true);
    const { data } = await supabase.from('districts').select('*').eq('city_id', city.id).order('name');
    setDistricts(data || []);
    setListLoading(false);
    setStep(2);
  };

  const selectDistrict = async (district: District) => {
    setSelectedDistrict(district);
    setListLoading(true);
    const { data } = await supabase.from('khoroos').select('*').eq('district_id', district.id).order('name');
    setKhoroos(data || []);
    setListLoading(false);
    setStep(3);
  };

  const selectKhoroo = async (khoroo: Khoroo) => {
    setSelectedKhoroo(khoroo);
    setListLoading(true);
    const { data } = await supabase.from('sokh_organizations').select('*').eq('khoroo_id', khoroo.id).order('name');
    setSokhList(data || []);
    setListLoading(false);
    setStep(4);
  };

  const selectSokh = (sokh: SokhOrg) => {
    setSelectedSokh(sokh);
    setStep(5);
  };

  const goBack = () => {
    setError('');
    if (step === 2) { setSelectedCity(null); setStep(1); }
    else if (step === 3) { setSelectedDistrict(null); setStep(2); }
    else if (step === 4) { setSelectedKhoroo(null); setStep(3); }
    else if (step === 5) { setSelectedSokh(null); setStep(4); }
    else { router.push('/app'); }
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Нэрээ оруулна уу'); return; }
    if (!/^\d{8}$/.test(phone.trim())) { setError('Утасны дугаар 8 оронтой байна'); return; }
    if (password.trim().length < 6) { setError('Нууц үг хамгийн багадаа 6 тэмдэгт'); return; }
    if (password.trim() !== confirmPassword.trim()) { setError('Нууц үг таарахгүй байна'); return; }

    setLoading(true);

    const fullAddress = [apartment, entrance ? `${entrance}-р орц` : '', floor ? `${floor} давхар` : '', door].filter(Boolean).join(', ');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          password: password.trim(),
          apartment: fullAddress,
          sokh_id: selectedSokh?.id,
        }),
      });

      const result = await res.json();
      if (!res.ok) { setError(result.error); setLoading(false); return; }

      // Автоматаар нэвтрэх (утаснаас үүссэн имэйлээр)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: password.trim(),
      });
      if (signInError) {
        setError('Бүртгэл амжилттай. Нэвтрэхэд алдаа гарлаа.');
        setLoading(false);
        return;
      }

      // Pre-auth manual signup (find-hoa) бичлэгүүд холбогдсон бол сүүлдээ
      // sessionStorage-д тэмдэглэж амжилтын toast харуулна.
      if (typeof window !== 'undefined' && result?.claim?.anythingLinked) {
        try {
          window.sessionStorage.setItem(
            'manual-hoa-claim-result',
            JSON.stringify({
              membershipsLinked: result.claim.membershipsLinked,
              activationRequestsLinked: result.claim.activationRequestsLinked,
              signupRequestsLinked: result.claim.signupRequestsLinked,
              hasDirectory: (result.claim.matchedDirectoryIds || []).length > 0,
              hasProvisional: (result.claim.matchedProvisionalIds || []).length > 0,
            })
          );
        } catch {
          // ignore
        }
      }

      if (selectedSokh?.id) {
        router.replace(`/sokh/${selectedSokh.id}`);
      } else {
        router.replace('/select');
      }
    } catch {
      setError('Серверийн алдаа');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={goBack} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">Бүртгүүлэх</h1>
      </div>

      {/* Progress */}
      <div className="flex px-4 py-3 gap-1">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full mb-1 ${i + 1 <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <span className={`text-xs ${i + 1 <= step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Breadcrumb */}
      {step > 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500">
            {selectedCity?.name}
            {selectedDistrict ? ` → ${selectedDistrict.name}` : ''}
            {selectedKhoroo ? ` → ${selectedKhoroo.name}` : ''}
            {selectedSokh ? ` → ${selectedSokh.name}` : ''}
          </p>
        </div>
      )}

      <div className="px-4 py-2">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-3">{error}</div>
        )}

        {/* Step 1: Хот */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold mb-3 text-center">Хот/Аймаг сонгоно уу</h2>
            <div className="space-y-2 max-w-sm mx-auto">
              {cities.map(c => (
                <button key={c.id} onClick={() => selectCity(c)}
                  className="w-full bg-white p-4 rounded-xl shadow-sm text-center hover:bg-blue-50 active:bg-blue-100 transition">
                  <span className="font-medium">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="text-center mt-4">
              <button onClick={() => router.push('/find-hoa')} className="text-sm text-blue-600 hover:underline">
                Эсвэл нэрээр шууд хайх →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Дүүрэг */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Дүүрэг сонгоно уу</h2>
            {listLoading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
              <div className="space-y-2">
                {districts.map(d => (
                  <button key={d.id} onClick={() => selectDistrict(d)}
                    className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition">
                    <span className="font-medium">{d.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Хороо */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Хороо сонгоно уу</h2>
            {listLoading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
              <div className="grid grid-cols-2 gap-2">
                {khoroos.map(k => (
                  <button key={k.id} onClick={() => selectKhoroo(k)}
                    className="bg-white p-3 rounded-xl shadow-sm text-center hover:bg-blue-50 active:bg-blue-100 transition">
                    <span className="font-medium text-sm">{k.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: СӨХ */}
        {step === 4 && (
          <div>
            <h2 className="text-base font-semibold mb-3">СӨХ сонгоно уу</h2>
            {listLoading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : sokhList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">Энэ хороонд бүртгэлтэй СӨХ байхгүй</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sokhList.map(s => (
                  <button key={s.id} onClick={() => selectSokh(s)}
                    className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Хувийн мэдээлэл */}
        {step === 5 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Хувийн мэдээлэл</h2>
            <p className="text-xs text-gray-400 mb-4">{selectedSokh?.name}-д бүртгүүлэх</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Овог нэр *</label>
                <input placeholder="Батболд Бат-Эрдэнэ" value={name} onChange={e => setName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-sm bg-white" />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Утасны дугаар *</label>
                <input type="tel" placeholder="99001122" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full border rounded-xl px-4 py-3 text-sm bg-white" />
              </div>

              <div className="bg-white border rounded-xl p-3">
                <label className="text-xs text-gray-500 mb-2 block">Хаяг</label>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Байрны дугаар" value={apartment} onChange={e => setApartment(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Орц" value={entrance} onChange={e => setEntrance(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Давхар" value={floor} onChange={e => setFloor(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" />
                  <input placeholder="Тоот" value={door} onChange={e => setDoor(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="border-t pt-3 mt-2">
                <p className="text-xs text-gray-500 mb-2 font-medium">Нууц үг тохируулах</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Нууц үг *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="6+ тэмдэгт" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full border rounded-xl px-4 py-3 text-sm bg-white pr-12" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    {showPassword ? 'Нуух' : 'Харах'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Нууц үг давтах *</label>
                <input type={showPassword ? 'text' : 'password'} placeholder="Дахин оруулна уу" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm bg-white ${confirmPassword && (password.trim() === confirmPassword.trim() ? 'border-green-400' : 'border-red-400')}`} />
                {confirmPassword && password.trim() !== confirmPassword.trim() && (
                  <p className="text-xs text-red-500 mt-1">Нууц үг таарахгүй байна</p>
                )}
                {confirmPassword && password.trim() === confirmPassword.trim() && (
                  <p className="text-xs text-green-500 mt-1">Таарч байна</p>
                )}
              </div>
            </div>

            <button onClick={handleRegister} disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-sm mt-6 disabled:opacity-50 active:bg-blue-700 transition">
              {loading ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Бүртгэлтэй юу?{' '}
              <button onClick={() => router.push('/login')} className="text-blue-600 font-medium">Нэвтрэх</button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
