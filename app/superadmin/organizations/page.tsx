'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';

interface City { id: number; name: string }
interface District { id: number; city_id: number; name: string }
interface Khoroo { id: number; district_id: number; name: string }
interface Sokh {
  id: number;
  name: string;
  address: string;
  phone: string;
  khoroo_id: number;
  created_at: string;
  khoroos?: { name: string; districts?: { name: string; cities?: { name: string } } };
}

export default function OrganizationsPage() {
  const [sokhs, setSokhs] = useState<Sokh[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form state
  const [cityId, setCityId] = useState<number | ''>('');
  const [districtId, setDistrictId] = useState<number | ''>('');
  const [khorooId, setKhorooId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const addedCount = useRef(0);

  // Load data
  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: r }, { data: c }, { data: d }, { data: k }] = await Promise.all([
        supabase.from('sokh_organizations').select('*, khoroos(name, districts(name, cities(name)))').order('created_at', { ascending: false }),
        supabase.from('residents').select('sokh_id, debt'),
        supabase.from('cities').select('*').order('id'),
        supabase.from('districts').select('*').order('name'),
        supabase.from('khoroos').select('*').order('id'),
      ]);
      setSokhs(s || []);
      setResidents(r || []);
      setCities(c || []);
      setDistricts(d || []);
      setKhoroos(k || []);
      setLoading(false);
    };
    load();
  }, []);

  const filteredDistricts = districts.filter(d => d.city_id === cityId);
  const filteredKhoroos = khoroos.filter(k => k.district_id === districtId);

  const resetForm = () => {
    // Дүүрэг, хороо сонголтыг хадгална - зөвхөн нэр, хаяг, утас цэвэрлэнэ
    setName('');
    setAddress('');
    setPhone('');
    setEditId(null);
    setError('');
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const resetFormFull = () => {
    setCityId('');
    setDistrictId('');
    setKhorooId('');
    resetForm();
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!khorooId || !name.trim()) {
      setError('Хороо сонгож, нэр оруулна уу');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const record = {
      khoroo_id: khorooId,
      name: name.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
    };

    if (editId) {
      // Засварлах
      const { error: err } = await supabase
        .from('sokh_organizations')
        .update(record)
        .eq('id', editId);

      if (err) {
        setError('Алдаа: ' + err.message);
        setSaving(false);
        return;
      }
      setSuccess(`"${name}" амжилттай засварлалаа`);
    } else {
      // Шинээр нэмэх
      const { error: err } = await supabase
        .from('sokh_organizations')
        .insert(record);

      if (err) {
        setError('Алдаа: ' + err.message);
        setSaving(false);
        return;
      }
      addedCount.current += 1;
      setSuccess(`"${name}" нэмэгдлээ ✓ (Нийт ${addedCount.current} нэмсэн)`);
    }

    // Жагсаалт дахин ачаалах
    const { data: s } = await supabase
      .from('sokh_organizations')
      .select('*, khoroos(name, districts(name, cities(name)))')
      .order('created_at', { ascending: false });
    setSokhs(s || []);
    setSaving(false);
    resetForm();
  };

  const handleEdit = (s: Sokh) => {
    const khoroo = khoroos.find(k => k.id === s.khoroo_id);
    const district = khoroo ? districts.find(d => d.id === khoroo.district_id) : null;
    const city = district ? cities.find(c => c.id === district.city_id) : null;

    if (city) setCityId(city.id);
    if (district) setDistrictId(district.id);
    if (khoroo) setKhorooId(khoroo.id);
    setName(s.name);
    setAddress(s.address || '');
    setPhone(s.phone || '');
    setEditId(s.id);
    setShowForm(true);
    setError('');
    setSuccess('');
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const handleDelete = async (s: Sokh) => {
    if (!confirm(`"${s.name}" устгах уу?`)) return;
    await supabase.from('sokh_organizations').delete().eq('id', s.id);
    setSokhs(prev => prev.filter(x => x.id !== s.id));
  };

  const getOrgStats = (id: number) => {
    const org = residents.filter(r => r.sokh_id === id);
    return { count: org.length, debt: org.reduce((s, r) => s + Number(r.debt || 0), 0) };
  };

  const getLocation = (s: Sokh) => {
    const k = s.khoroos;
    if (!k) return '';
    const parts = [];
    if (k.districts?.cities?.name) parts.push(k.districts.cities.name);
    if (k.districts?.name) parts.push(k.districts.name);
    if (k.name) parts.push(k.name);
    return parts.join(' · ');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">🏢 СӨХ-үүд</h1>
          <p className="text-gray-400 text-sm">{sokhs.length} бүртгэлтэй</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetFormFull(); }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            showForm
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {showForm ? 'Хаах ✕' : '+ СӨХ нэмэх'}
        </button>
      </div>

      {/* Оруулах форм */}
      {showForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            {editId ? '✏️ СӨХ засварлах' : '📝 СӨХ бүртгэх'}
          </h2>

          {/* Байршил сонголт */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Хот</label>
              <select
                value={cityId}
                onChange={e => { setCityId(Number(e.target.value) || ''); setDistrictId(''); setKhorooId(''); }}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Сонгох</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Дүүрэг</label>
              <select
                value={districtId}
                onChange={e => { setDistrictId(Number(e.target.value) || ''); setKhorooId(''); }}
                disabled={!cityId}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-40"
              >
                <option value="">Сонгох</option>
                {filteredDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Хороо</label>
              <select
                value={khorooId}
                onChange={e => setKhorooId(Number(e.target.value) || '')}
                disabled={!districtId}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-40"
              >
                <option value="">Сонгох</option>
                {filteredKhoroos.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
          </div>

          {/* СӨХ мэдээлэл */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">СӨХ нэр *</label>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Жишээ: Алтан гадас СӨХ"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Хаяг</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="15-р байр, 1-р хороо"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Утас</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="77001122"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none placeholder:text-gray-600"
              />
            </div>
          </div>

          {/* Товчлуурууд */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
            >
              {saving ? 'Хадгалж байна...' : editId ? 'Хадгалах' : 'Нэмэх (Enter)'}
            </button>
            {editId && (
              <button
                onClick={resetForm}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition"
              >
                Цуцлах
              </button>
            )}
            <p className="text-xs text-gray-500 ml-2">
              Хороо сонголт хадгалагдана - зөвхөн нэр, хаяг, утас шинэчлэгдэнэ
            </p>
          </div>

          {/* Мессеж */}
          {success && (
            <div className="mt-3 bg-green-900/30 border border-green-800 text-green-400 px-4 py-2 rounded-xl text-sm">
              {success}
            </div>
          )}
          {error && (
            <div className="mt-3 bg-red-900/30 border border-red-800 text-red-400 px-4 py-2 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Загвар жишээ */}
          <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-2">📋 Оруулах загвар:</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p><span className="text-gray-500">Нэр:</span> Нарантуул СӨХ</p>
              <p><span className="text-gray-500">Хаяг:</span> 15-р байр, 1-р хороо</p>
              <p><span className="text-gray-500">Утас:</span> 77001122</p>
            </div>
          </div>
        </div>
      )}

      {/* Жагсаалт */}
      {loading ? <p className="text-gray-500">Ачаалж байна...</p> : (
        <div className="space-y-3">
          {sokhs.map(s => {
            const stats = getOrgStats(s.id);
            const location = getLocation(s);
            return (
              <div key={s.id} className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition group">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{s.name}</h3>
                    {location && <p className="text-blue-400 text-xs mt-0.5">{location}</p>}
                    {s.address && <p className="text-gray-400 text-sm mt-1">{s.address}</p>}
                    <p className="text-gray-500 text-xs mt-1">📞 {s.phone || 'Утасгүй'}</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-gray-300"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="text-xs bg-red-900/50 hover:bg-red-800/50 px-3 py-1.5 rounded-lg text-red-400"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-800">
                  <div>
                    <p className="text-lg font-bold">{stats.count}</p>
                    <p className="text-xs text-gray-500">Айл</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{residents.filter(r => r.sokh_id === s.id && Number(r.debt) > 0).length}</p>
                    <p className="text-xs text-gray-500">Өртэй</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stats.debt > 0 ? `${(stats.debt/1000).toFixed(0)}к₮` : '0₮'}</p>
                    <p className="text-xs text-gray-500">Нийт өр</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-400">{stats.count > 0 ? 'Идэвхтэй' : '—'}</p>
                    <p className="text-xs text-gray-500">Төлөв</p>
                  </div>
                </div>
              </div>
            );
          })}

          {sokhs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-3">🏢</p>
              <p>СӨХ бүртгэлгүй байна</p>
              <p className="text-sm mt-1">Дээрх "+ СӨХ нэмэх" товч дарж эхлэнэ үү</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
