'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Resident { id: number; name: string; apartment: string; area_sqm?: number; }
interface Reading { id: number; resident_id: number; apartment: string; utility_type: string; previous_reading: number; current_reading: number; consumption: number; month: number; year: number; }
interface Org { id: number; name: string; }
interface Tariff { id: number; rate_per_unit: number; unit: string; effective_from: string; }

const utilityTypes = [
  { value: 'water', label: 'Ус', icon: '💧', unit: 'м³' },
  { value: 'heating', label: 'Дулаан', icon: '🔥', unit: 'мкв' },
  { value: 'electricity', label: 'Цахилгаан', icon: '⚡', unit: 'кВт/ц' },
];

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function OsnaaReadings() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heatingTariff, setHeatingTariff] = useState<Tariff | null>(null);

  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedType, setSelectedType] = useState('electricity');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Bulk entry: { residentId: currentReading }
  const [entries, setEntries] = useState<Record<number, string>>({});
  // мкв засах: { residentId: sqm value }
  const [sqmEdits, setSqmEdits] = useState<Record<number, string>>({});
  const [savingSqm, setSavingSqm] = useState(false);

  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase.from('sokh_organizations').select('id, name').order('name');
      setOrgs(data || []);
      if (data && data.length > 0) setSelectedOrg(String(data[0].id));
      setLoading(false);
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    fetchResidentsAndReadings();
  }, [selectedOrg, selectedType, selectedMonth, selectedYear]);

  const fetchResidentsAndReadings = async () => {
    setLoading(true);
    const [{ data: res }, { data: rd }] = await Promise.all([
      supabase.from('residents').select('id, name, apartment, area_sqm').eq('sokh_id', selectedOrg).order('apartment'),
      supabase.from('meter_readings').select('*')
        .eq('sokh_id', selectedOrg)
        .eq('utility_type', selectedType)
        .eq('year', selectedYear)
        .eq('month', selectedMonth),
    ]);
    setResidents(res || []);
    setReadings(rd || []);
    setEntries({});

    // Дулааны тариф авах
    if (selectedType === 'heating' && selectedOrg) {
      const { data: tariffs } = await supabase
        .from('utility_tariffs')
        .select('*')
        .eq('sokh_id', selectedOrg)
        .eq('utility_type', 'heating')
        .order('effective_from', { ascending: false })
        .limit(1);
      setHeatingTariff(tariffs && tariffs.length > 0 ? tariffs[0] : null);
    }

    setLoading(false);
  };

  const getReading = (residentId: number) => readings.find(r => r.resident_id === residentId);

  // Өмнөх сарын заалт авах
  const getPrevReading = async (residentId: number): Promise<number> => {
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth === 0) { prevMonth = 12; prevYear--; }

    const { data } = await supabase
      .from('meter_readings')
      .select('current_reading')
      .eq('resident_id', residentId)
      .eq('utility_type', selectedType)
      .eq('year', prevYear)
      .eq('month', prevMonth)
      .limit(1);

    return data && data.length > 0 ? Number(data[0].current_reading) : 0;
  };

  const saveAll = async () => {
    const toSave = Object.entries(entries).filter(([, val]) => val !== '');
    if (toSave.length === 0) return;

    setSaving(true);
    for (const [resIdStr, currentStr] of toSave) {
      const residentId = Number(resIdStr);
      const currentReading = Number(currentStr);
      const resident = residents.find(r => r.id === residentId);
      if (!resident) continue;

      const prevReading = await getPrevReading(residentId);
      const existing = getReading(residentId);

      if (existing) {
        await adminFrom('meter_readings').update({
          previous_reading: prevReading,
          current_reading: currentReading,
        }).eq('id', existing.id);
      } else {
        await adminFrom('meter_readings').insert([{
          sokh_id: Number(selectedOrg),
          resident_id: residentId,
          apartment: resident.apartment,
          utility_type: selectedType,
          previous_reading: prevReading,
          current_reading: currentReading,
          year: selectedYear,
          month: selectedMonth,
        }]);
      }
    }

    setSaving(false);
    setEntries({});
    await fetchResidentsAndReadings();
  };

  const deleteReading = async (id: number) => {
    await adminFrom('meter_readings').delete().eq('id', id);
    await fetchResidentsAndReadings();
  };

  // мкв хадгалах
  const saveSqmAll = async () => {
    const toSave = Object.entries(sqmEdits).filter(([, val]) => val !== '');
    if (toSave.length === 0) return;
    setSavingSqm(true);
    for (const [resIdStr, sqmStr] of toSave) {
      await adminFrom('residents').update({ area_sqm: Number(sqmStr) || 0 }).eq('id', Number(resIdStr));
    }
    setSavingSqm(false);
    setSqmEdits({});
    await fetchResidentsAndReadings();
  };

  const ut = utilityTypes.find(u => u.value === selectedType)!;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{selectedType === 'heating' ? '🔥 Дулааны тооцоолуур' : '📊 Тоолуур заалт'}</h1>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <div className="flex gap-1">
          {utilityTypes.map(t => (
            <button key={t.value} onClick={() => setSelectedType(t.value)}
              className={`px-3 py-2 rounded-lg text-sm ${selectedType === t.value ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm">
          {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">←</button>
          <span className="font-medium px-2">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 bg-gray-100 rounded text-sm">→</button>
        </div>

        {Object.values(entries).some(v => v !== '') && (
          <button onClick={saveAll} disabled={saving}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 ml-auto disabled:opacity-50">
            {saving ? 'Хадгалж байна...' : `Хадгалах (${Object.values(entries).filter(v => v !== '').length})`}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : residents.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          Энэ СӨХ-д оршин суугч бүртгэлгүй байна
        </div>
      ) : selectedType === 'heating' ? (
        /* ===== ДУЛААНЫ ТООЦООЛУУР ===== */
        <>
          {!heatingTariff ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm">
              Дулааны тариф тогтоогоогүй байна. Эхлээд <strong>Тариф удирдлага</strong> хуудаснаас дулааны тариф нэмнэ үү.
            </div>
          ) : (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    🔥 Дулааны тооцоолуур — {months[selectedMonth - 1]} {selectedYear}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Тариф: <strong>{Number(heatingTariff.rate_per_unit).toLocaleString()}₮/мкв</strong> (хүчинтэй: {heatingTariff.effective_from})
                  </p>
                </div>
                {Object.values(sqmEdits).some(v => v !== '') && (
                  <button onClick={saveSqmAll} disabled={savingSqm}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                    {savingSqm ? 'Хадгалж байна...' : `мкв хадгалах (${Object.values(sqmEdits).filter(v => v !== '').length})`}
                  </button>
                )}
              </div>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Нэр</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Талбай (мкв)</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Тариф (₮/мкв)</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Дүн</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents.map(res => {
                      const editedSqm = sqmEdits[res.id];
                      const sqm = editedSqm !== undefined && editedSqm !== '' ? Number(editedSqm) : (Number(res.area_sqm) || 0);
                      const amount = Math.round(sqm * Number(heatingTariff.rate_per_unit));
                      return (
                        <tr key={res.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{res.apartment}</td>
                          <td className="px-4 py-2">{res.name}</td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              placeholder="мкв"
                              value={editedSqm !== undefined ? editedSqm : (res.area_sqm || '')}
                              onChange={e => setSqmEdits(prev => ({ ...prev, [res.id]: e.target.value }))}
                              className="w-20 border rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-500">
                            {Number(heatingTariff.rate_per_unit).toLocaleString()}₮
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-orange-600">
                            {sqm > 0 ? `${amount.toLocaleString()}₮` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-orange-50 border-t">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 font-semibold text-sm">Нийт</td>
                      <td className="px-4 py-3 text-right font-medium text-sm">
                        {residents.reduce((s, r) => {
                          const ed = sqmEdits[r.id];
                          return s + (ed !== undefined && ed !== '' ? Number(ed) : (Number(r.area_sqm) || 0));
                        }, 0)} мкв
                      </td>
                      <td></td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700 text-sm">
                        {residents.reduce((s, r) => {
                          const ed = sqmEdits[r.id];
                          const sq = ed !== undefined && ed !== '' ? Number(ed) : (Number(r.area_sqm) || 0);
                          return s + Math.round(sq * Number(heatingTariff.rate_per_unit));
                        }, 0).toLocaleString()}₮
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        /* ===== УС / ЦАХИЛГААН ТООЛУУР ===== */
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Нэр</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Өмнөх заалт</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Одоогийн заалт</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">Хэрэглээ ({ut.unit})</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {residents.map(res => {
                const existing = getReading(res.id);
                return (
                  <tr key={res.id} className={`border-b hover:bg-gray-50 ${existing ? 'bg-green-50/50' : ''}`}>
                    <td className="px-4 py-2 font-medium">{res.apartment}</td>
                    <td className="px-4 py-2">{res.name}</td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {existing ? existing.previous_reading : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {existing ? (
                        <span className="font-medium text-green-600">{existing.current_reading}</span>
                      ) : (
                        <input
                          type="number"
                          placeholder="Заалт"
                          value={entries[res.id] || ''}
                          onChange={e => setEntries(prev => ({ ...prev, [res.id]: e.target.value }))}
                          className="w-24 border rounded px-2 py-1 text-sm text-right"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {existing ? <span>{existing.consumption} {ut.unit}</span> : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {existing && (
                        <button onClick={() => deleteReading(existing.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
