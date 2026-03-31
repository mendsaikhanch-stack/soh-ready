'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface City { id: number; name: string }
interface District { id: number; city_id: number; name: string }
interface Khoroo { id: number; district_id: number; name: string }

export default function LocationsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<number | ''>('');
  const [selectedDistrict, setSelectedDistrict] = useState<number | ''>('');

  // Add forms
  const [showAddCity, setShowAddCity] = useState(false);
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [newCityName, setNewCityName] = useState('');
  const [newDistrictName, setNewDistrictName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Edit states
  const [editingCity, setEditingCity] = useState<number | null>(null);
  const [editingDistrict, setEditingDistrict] = useState<number | null>(null);
  const [editingKhoroo, setEditingKhoroo] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [{ data: c }, { data: d }, { data: k }] = await Promise.all([
      supabase.from('cities').select('*').order('id'),
      supabase.from('districts').select('*').order('name'),
      supabase.from('khoroos').select('*').order('id'),
    ]);
    setCities(c || []);
    setDistricts(d || []);
    setKhoroos(k || []);
    setLoading(false);
  };

  const showMsg = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const filteredDistricts = selectedCity ? districts.filter(d => d.city_id === selectedCity) : districts;
  const filteredKhoroos = selectedDistrict ? khoroos.filter(k => k.district_id === selectedDistrict) : [];
  const khorooCountByDistrict = (districtId: number) => khoroos.filter(k => k.district_id === districtId).length;

  // ===== City CRUD =====
  const addCity = async () => {
    if (!newCityName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('cities').insert({ name: newCityName.trim() });
    if (error) { showMsg('error', 'Хот нэмэхэд алдаа: ' + error.message); }
    else { showMsg('success', 'Хот нэмэгдлээ'); setNewCityName(''); setShowAddCity(false); await loadData(); }
    setSaving(false);
  };

  const updateCity = async (id: number) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('cities').update({ name: editName.trim() }).eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Засагдлаа'); setEditingCity(null); await loadData(); }
  };

  const deleteCity = async (id: number) => {
    const relatedDistricts = districts.filter(d => d.city_id === id);
    if (relatedDistricts.length > 0) { showMsg('error', 'Дүүрэгтэй хот устгах боломжгүй'); return; }
    const { error } = await supabase.from('cities').delete().eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Устгагдлаа'); if (selectedCity === id) setSelectedCity(''); await loadData(); }
  };

  // ===== District CRUD =====
  const addDistrict = async () => {
    if (!newDistrictName.trim() || !selectedCity) return;
    setSaving(true);
    const { error } = await supabase.from('districts').insert({ name: newDistrictName.trim(), city_id: selectedCity });
    if (error) showMsg('error', 'Дүүрэг нэмэхэд алдаа: ' + error.message);
    else { showMsg('success', 'Дүүрэг нэмэгдлээ'); setNewDistrictName(''); setShowAddDistrict(false); await loadData(); }
    setSaving(false);
  };

  const updateDistrict = async (id: number) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('districts').update({ name: editName.trim() }).eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Засагдлаа'); setEditingDistrict(null); await loadData(); }
  };

  const deleteDistrict = async (id: number) => {
    const relatedKhoroos = khoroos.filter(k => k.district_id === id);
    if (relatedKhoroos.length > 0) { showMsg('error', 'Хороотой дүүрэг устгах боломжгүй'); return; }
    const { error } = await supabase.from('districts').delete().eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Устгагдлаа'); if (selectedDistrict === id) setSelectedDistrict(''); await loadData(); }
  };

  // ===== Khoroo CRUD =====
  const addKhoroo = async (districtId: number, name: string) => {
    const { error } = await supabase.from('khoroos').insert({ name, district_id: districtId });
    if (error) showMsg('error', error.message);
    else { await loadData(); }
  };

  const addKhoroosInBulk = async (districtId: number, count: number) => {
    const existing = khoroos.filter(k => k.district_id === districtId).length;
    if (existing >= count) { showMsg('error', `Аль хэдийн ${existing} хороотой`); return; }
    setSaving(true);
    const rows = [];
    for (let i = existing + 1; i <= count; i++) {
      rows.push({ name: `${i}-р хороо`, district_id: districtId });
    }
    const { error } = await supabase.from('khoroos').insert(rows);
    if (error) showMsg('error', error.message);
    else { showMsg('success', `${rows.length} хороо нэмэгдлээ`); await loadData(); }
    setSaving(false);
  };

  const updateKhoroo = async (id: number) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('khoroos').update({ name: editName.trim() }).eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Засагдлаа'); setEditingKhoroo(null); await loadData(); }
  };

  const deleteKhoroo = async (id: number) => {
    const { error } = await supabase.from('khoroos').delete().eq('id', id);
    if (error) showMsg('error', error.message);
    else { showMsg('success', 'Устгагдлаа'); await loadData(); }
  };

  // ===== Bulk import from Excel data =====
  const EXCEL_DATA: Record<string, number> = {
    'Баянгол': 34, 'Баянзүрх': 43, 'Сүхбаатар': 20, 'Сонгинохайрхан': 48,
    'Хан-Уул': 25, 'Чингэлтэй': 19, 'Налайх': 8, 'Багануур': 5, 'Багахангай': 2,
  };

  const syncAllKhoroos = async () => {
    setSaving(true);
    let totalAdded = 0;
    for (const district of districts.filter(d => d.city_id === 1)) {
      const target = EXCEL_DATA[district.name];
      if (!target) continue;
      const existing = khoroos.filter(k => k.district_id === district.id).length;
      if (existing >= target) continue;
      const rows = [];
      for (let i = existing + 1; i <= target; i++) {
        rows.push({ name: `${i}-р хороо`, district_id: district.id });
      }
      const { error } = await supabase.from('khoroos').insert(rows);
      if (!error) totalAdded += rows.length;
    }
    showMsg('success', `Нийт ${totalAdded} хороо нэмэгдлээ`);
    await loadData();
    setSaving(false);
  };

  if (loading) {
    return <div className="p-8"><p className="text-gray-500">Ачаалж байна...</p></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Дүүрэг & Хороо</h1>
          <p className="text-gray-500 text-sm mt-1">Хот, дүүрэг, хорооны бүртгэл удирдах</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-gray-800/50 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-blue-400">{cities.length}</div>
            <div className="text-xs text-gray-500">Хот</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-green-400">{districts.length}</div>
            <div className="text-xs text-gray-500">Дүүрэг</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl px-4 py-2 text-center">
            <div className="text-lg font-bold text-purple-400">{khoroos.length}</div>
            <div className="text-xs text-gray-500">Хороо</div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-3 rounded-xl text-sm ${message.type === 'error' ? 'bg-red-900/30 border border-red-800 text-red-400' : 'bg-green-900/30 border border-green-800 text-green-400'}`}>
          {message.text}
        </div>
      )}

      {/* Sync banner */}
      {districts.some(d => d.city_id === 1 && EXCEL_DATA[d.name] && khorooCountByDistrict(d.id) < EXCEL_DATA[d.name]) && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-blue-400 font-medium">Хорооны мэдээлэл дутуу байна</p>
            <p className="text-blue-400/70 text-sm mt-1">
              Улаанбаатар хотын {districts.filter(d => d.city_id === 1 && EXCEL_DATA[d.name] && khorooCountByDistrict(d.id) < EXCEL_DATA[d.name]).length} дүүрэгт нийт{' '}
              {districts.filter(d => d.city_id === 1 && EXCEL_DATA[d.name]).reduce((sum, d) => sum + Math.max(0, EXCEL_DATA[d.name] - khorooCountByDistrict(d.id)), 0)} хороо дутуу
            </p>
          </div>
          <button
            onClick={syncAllKhoroos}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Нэмж байна...' : 'Бүгдийг нэмэх'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Cities */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Хотууд</h2>
            <button onClick={() => setShowAddCity(!showAddCity)} className="text-blue-400 text-sm hover:text-blue-300">
              {showAddCity ? 'Болих' : '+ Нэмэх'}
            </button>
          </div>

          {showAddCity && (
            <div className="flex gap-2 mb-3">
              <input
                value={newCityName}
                onChange={e => setNewCityName(e.target.value)}
                placeholder="Хотын нэр"
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addCity()}
              />
              <button onClick={addCity} disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                Нэмэх
              </button>
            </div>
          )}

          <div className="space-y-1">
            {cities.map(city => (
              <div
                key={city.id}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition ${
                  selectedCity === city.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-700/50 text-gray-300'
                }`}
              >
                {editingCity === city.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => updateCity(city.id)}
                    onKeyDown={e => e.key === 'Enter' && updateCity(city.id)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span onClick={() => { setSelectedCity(city.id); setSelectedDistrict(''); }} className="flex-1">
                    {city.name}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-500">{districts.filter(d => d.city_id === city.id).length}</span>
                  <button onClick={() => { setEditingCity(city.id); setEditName(city.name); }} className="text-gray-600 hover:text-gray-400 text-xs px-1">&#9998;</button>
                  <button onClick={() => deleteCity(city.id)} className="text-gray-600 hover:text-red-400 text-xs px-1">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Districts */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Дүүргүүд {selectedCity ? `(${cities.find(c => c.id === selectedCity)?.name})` : ''}</h2>
            {selectedCity && (
              <button onClick={() => setShowAddDistrict(!showAddDistrict)} className="text-blue-400 text-sm hover:text-blue-300">
                {showAddDistrict ? 'Болих' : '+ Нэмэх'}
              </button>
            )}
          </div>

          {!selectedCity && <p className="text-gray-600 text-sm">Хот сонгоно уу</p>}

          {showAddDistrict && selectedCity && (
            <div className="flex gap-2 mb-3">
              <input
                value={newDistrictName}
                onChange={e => setNewDistrictName(e.target.value)}
                placeholder="Дүүргийн нэр"
                className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addDistrict()}
              />
              <button onClick={addDistrict} disabled={saving} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                Нэмэх
              </button>
            </div>
          )}

          <div className="space-y-1">
            {filteredDistricts.map(district => {
              const count = khorooCountByDistrict(district.id);
              const target = district.city_id === 1 ? EXCEL_DATA[district.name] : undefined;
              const isMissing = target && count < target;
              return (
                <div
                  key={district.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition ${
                    selectedDistrict === district.id ? 'bg-green-600/20 text-green-400' : 'hover:bg-gray-700/50 text-gray-300'
                  }`}
                >
                  {editingDistrict === district.id ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => updateDistrict(district.id)}
                      onKeyDown={e => e.key === 'Enter' && updateDistrict(district.id)}
                      className="flex-1 bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span onClick={() => setSelectedDistrict(district.id)} className="flex-1">
                      {district.name}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-2">
                    <span className={`text-xs ${isMissing ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {count}{target ? `/${target}` : ''}
                    </span>
                    {isMissing && (
                      <button
                        onClick={() => addKhoroosInBulk(district.id, target)}
                        className="text-yellow-400 hover:text-yellow-300 text-xs px-1"
                        title="Дутуу хороог нэмэх"
                      >+</button>
                    )}
                    <button onClick={() => { setEditingDistrict(district.id); setEditName(district.name); }} className="text-gray-600 hover:text-gray-400 text-xs px-1">&#9998;</button>
                    <button onClick={() => deleteDistrict(district.id)} className="text-gray-600 hover:text-red-400 text-xs px-1">&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khoroos */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Хороод {selectedDistrict ? `(${districts.find(d => d.id === selectedDistrict)?.name})` : ''}</h2>
            {selectedDistrict && (
              <button
                onClick={() => {
                  const name = `${filteredKhoroos.length + 1}-р хороо`;
                  addKhoroo(selectedDistrict as number, name);
                }}
                className="text-blue-400 text-sm hover:text-blue-300"
              >
                + Нэмэх
              </button>
            )}
          </div>

          {!selectedDistrict && <p className="text-gray-600 text-sm">Дүүрэг сонгоно уу</p>}

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredKhoroos.map(khoroo => (
              <div key={khoroo.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-700/50 text-gray-300">
                {editingKhoroo === khoroo.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => updateKhoroo(khoroo.id)}
                    onKeyDown={e => e.key === 'Enter' && updateKhoroo(khoroo.id)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm">{khoroo.name}</span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => { setEditingKhoroo(khoroo.id); setEditName(khoroo.name); }} className="text-gray-600 hover:text-gray-400 text-xs px-1">&#9998;</button>
                  <button onClick={() => deleteKhoroo(khoroo.id)} className="text-gray-600 hover:text-red-400 text-xs px-1">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
