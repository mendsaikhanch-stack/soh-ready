'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';

interface City { id: number; name: string; }
interface District { id: number; city_id: number; name: string; }
interface Khoroo { id: number; district_id: number; name: string; }
interface SokhOrg { id: number; khoroo_id: number; name: string; address: string; phone: string; }

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, signOut } = useAuth();

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

  // Хороонд бүртгэлтэй СӨХ байхгүй үед хэрэглэгч өөрөө нэрээ оруулдаг горим
  const [enteringCustomSokh, setEnteringCustomSokh] = useState(false);
  const [customSokhName, setCustomSokhName] = useState('');

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
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');

  const stepLabels = ['Хот', 'Дүүрэг', 'Хороо', 'СӨХ', 'Мэдээлэл'];

  // /select хуудсаас ирсэн prefill (хот/дүүрэг/хороо + хэрэглэгчийн оруулсан СӨХ-ийн нэр)
  // sessionStorage-аас уншаад шууд step 5 руу шилжүүлнэ
  useEffect(() => {
    const raw = (() => { try { return window.sessionStorage.getItem('register-prefill'); } catch { return null; } })();
    if (!raw) return;
    try { window.sessionStorage.removeItem('register-prefill'); } catch { /* ignore */ }
    let prefill: { cityId?: number; districtId?: number; khorooId?: number; sokhName?: string };
    try { prefill = JSON.parse(raw); } catch { return; }
    if (!prefill.cityId || !prefill.districtId || !prefill.khorooId || !prefill.sokhName) return;

    (async () => {
      const [{ data: city }, { data: district }, { data: khoroo }] = await Promise.all([
        supabase.from('cities').select('*').eq('id', prefill.cityId).single(),
        supabase.from('districts').select('*').eq('id', prefill.districtId).single(),
        supabase.from('khoroos').select('*').eq('id', prefill.khorooId).single(),
      ]);
      if (!city || !district || !khoroo) return;
      setSelectedCity(city);
      setSelectedDistrict(district);
      setSelectedKhoroo(khoroo);
      setSelectedSokh(null);
      setCustomSokhName(prefill.sokhName!);
      setStep(5);
    })();
  }, []);

  // ?sokh=ID query — урьдчилан мэдэгдсэн СӨХ контекстээр шууд step 5 руу.
  // Жишээ: User B-д ирсэн invite link `/register?sokh=123` → байр/тоот шууд оруулна.
  useEffect(() => {
    const sokhParam = searchParams.get('sokh');
    if (!sokhParam) return;
    const sokhIdNum = parseInt(sokhParam, 10);
    if (!sokhIdNum) return;

    (async () => {
      const { data: sokh } = await supabase
        .from('sokh_organizations').select('*').eq('id', sokhIdNum).single();
      if (!sokh) return;
      const { data: khoroo } = await supabase
        .from('khoroos').select('*').eq('id', sokh.khoroo_id).single();
      if (!khoroo) return;
      const { data: district } = await supabase
        .from('districts').select('*').eq('id', khoroo.district_id).single();
      if (!district) return;
      const { data: city } = await supabase
        .from('cities').select('*').eq('id', district.city_id).single();
      if (!city) return;

      setSelectedCity(city);
      setSelectedDistrict(district);
      setSelectedKhoroo(khoroo);
      setSelectedSokh(sokh);
      setCustomSokhName('');
      setEnteringCustomSokh(false);
      setStep(5);
    })();
  }, [searchParams]);

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
    setCustomSokhName('');
    setEnteringCustomSokh(false);
    setStep(5);
  };

  const confirmCustomSokh = () => {
    const trimmed = customSokhName.trim();
    if (trimmed.length < 2) { setError('СӨХ-ийн нэрээ оруулна уу'); return; }
    setSelectedSokh(null);
    setError('');
    setStep(5);
  };

  const goBack = () => {
    setError('');
    if (step === 2) { setSelectedCity(null); setStep(1); }
    else if (step === 3) { setSelectedDistrict(null); setStep(2); }
    else if (step === 4) {
      if (enteringCustomSokh) { setEnteringCustomSokh(false); setCustomSokhName(''); }
      else { setSelectedKhoroo(null); setStep(3); }
    }
    else if (step === 5) { setSelectedSokh(null); setCustomSokhName(''); setEnteringCustomSokh(false); setStep(4); }
    else { router.push('/app'); }
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Нэрээ оруулна уу'); return; }
    if (!/^\d{8}$/.test(phone.trim())) { setError('Утасны дугаар 8 оронтой байна'); return; }
    if (password.trim().length < 6) { setError('Нууц үг хамгийн багадаа 6 тэмдэгт'); return; }
    if (password.trim() !== confirmPassword.trim()) { setError('Нууц үг таарахгүй байна'); return; }
    if (!consent) { setError('Үйлчилгээний нөхцөл, нууцлалын бодлоготой танилцаж зөвшөөрнө үү'); return; }

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
          sokh_name: !selectedSokh && customSokhName.trim() ? customSokhName.trim() : undefined,
          khoroo_id: !selectedSokh && customSokhName.trim() ? selectedKhoroo?.id : undefined,
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

      const newSokhId = result.sokh_id ?? selectedSokh?.id;
      if (newSokhId) {
        router.replace(`/sokh/${newSokhId}`);
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

      {/* Аль хэдийн нэвтэрсэн хэрэглэгчид мэдэгдэх */}
      {user && (
        <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="text-xs text-amber-800 leading-relaxed">
            Та одоо <span className="font-semibold">{profile?.name || user.email}</span> нэрээр нэвтэрсэн байна. Шинэ хэрэглэгч бүртгэхийн тулд эхлээд гарна уу.
          </div>
          <button
            onClick={async () => { await signOut(); router.refresh(); }}
            className="shrink-0 bg-amber-600 text-white text-xs px-3 py-2 rounded-lg font-medium active:bg-amber-700"
          >
            Гарах
          </button>
        </div>
      )}

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
            {selectedSokh ? ` → ${selectedSokh.name}` : (step === 5 && customSokhName.trim() ? ` → ${customSokhName.trim()}` : '')}
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
            {listLoading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
              <>
                {sokhList.length > 0 && !enteringCustomSokh && (
                  <div className="space-y-2 mb-3">
                    {sokhList.map(s => (
                      <button key={s.id} onClick={() => selectSokh(s)}
                        className="w-full bg-white p-4 rounded-xl shadow-sm text-left hover:bg-blue-50 active:bg-blue-100 transition">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-gray-500">{s.address}</p>
                      </button>
                    ))}
                  </div>
                )}

                {!enteringCustomSokh ? (
                  <div className={sokhList.length === 0 ? 'text-center py-8' : 'pt-2 border-t'}>
                    {sokhList.length === 0 && (
                      <p className="text-gray-400 mb-3 text-sm">Энэ хороонд бүртгэлтэй СӨХ байхгүй байна</p>
                    )}
                    <button
                      onClick={() => { setEnteringCustomSokh(true); setError(''); }}
                      className="w-full bg-white border-2 border-dashed border-blue-400 text-blue-600 p-4 rounded-xl font-medium text-sm hover:bg-blue-50 active:bg-blue-100 transition"
                    >
                      + СӨХийн нэрээ оруулна уу
                    </button>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
                    <label className="text-xs text-gray-500 block">Таны СӨХ-ийн нэр</label>
                    <input
                      autoFocus
                      value={customSokhName}
                      onChange={e => setCustomSokhName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmCustomSokh(); }}
                      placeholder="Жишээ нь: Нарантуул СӨХ"
                      className="w-full border rounded-xl px-4 py-3 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEnteringCustomSokh(false); setCustomSokhName(''); setError(''); }}
                        className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium"
                      >
                        Болих
                      </button>
                      <button
                        onClick={confirmCustomSokh}
                        disabled={customSokhName.trim().length < 2}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-blue-700 transition"
                      >
                        Үргэлжлүүлэх
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 5: Хувийн мэдээлэл */}
        {step === 5 && (
          <div>
            <h2 className="text-base font-semibold mb-1">Хувийн мэдээлэл</h2>
            <p className="text-xs text-gray-400 mb-4">{(selectedSokh?.name || customSokhName.trim())}-д бүртгүүлэх</p>

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

            <label className="flex items-start gap-2 mt-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Би{' '}
                <a href="/terms/resident" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Оршин суугчийн үйлчилгээний нөхцөл
                </a>
                {' '}болон{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Нууцлалын бодлого
                </a>
                -той танилцаж, зөвшөөрч байна.
              </span>
            </label>

            <button onClick={handleRegister} disabled={loading || !consent}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-sm mt-4 disabled:opacity-50 active:bg-blue-700 transition">
              {loading ? 'Бүртгэж байна...' : 'Бүртгүүлэх'}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Бүртгэлтэй юу?{' '}
              <button onClick={() => router.push('/login')} className="text-blue-600 font-medium">Нэвтрэх</button>
            </p>

            <p className="text-center text-xs text-gray-400 mt-2">
              <a href="/help" className="hover:text-gray-600">Тусламж</a>
              <span className="mx-1.5">·</span>
              <a href="/privacy" className="hover:text-gray-600">Нууцлал</a>
              <span className="mx-1.5">·</span>
              <a href="/terms/resident" className="hover:text-gray-600">Нөхцөл</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
