'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
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

interface ParsedSokh {
  name: string;
  district: string;
  khoroo: string;
  address: string;
  phone: string;
  khoroo_id?: number;
  matched: boolean;
}

type EntryMode = 'manual' | 'file';

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
  const [entryMode, setEntryMode] = useState<EntryMode>('manual');
  const [editId, setEditId] = useState<number | null>(null);

  // Manual form state
  const [cityId, setCityId] = useState<number | ''>('');
  const [districtId, setDistrictId] = useState<number | ''>('');
  const [khorooId, setKhorooId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // File import state
  const [parsedRows, setParsedRows] = useState<ParsedSokh[]>([]);
  const [fileName, setFileName] = useState('');
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [importResult, setImportResult] = useState({ success: 0, failed: 0, skipped: 0 });
  const [fileCityId, setFileCityId] = useState<number | ''>('');

  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

  // ===== Manual entry functions =====

  const resetForm = () => {
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
    resetFileImport();
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
    setEntryMode('manual');
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

  // ===== File import functions =====

  const resetFileImport = () => {
    setParsedRows([]);
    setFileName('');
    setImportStep('upload');
    setImportResult({ success: 0, failed: 0, skipped: 0 });
    setFileCityId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const matchKhoroo = (districtName: string, khorooName: string, selectedCityId: number | ''): number | undefined => {
    // Дүүрэг олох
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/дүүрэг/g, '');
    const dist = districts.find(d => {
      if (selectedCityId && d.city_id !== selectedCityId) return false;
      return normalize(d.name) === normalize(districtName);
    });
    if (!dist) return undefined;

    // Хороо олох
    const khorooNum = khorooName.match(/(\d+)/)?.[1];
    if (!khorooNum) return undefined;

    const kh = khoroos.find(k =>
      k.district_id === dist.id && k.name.includes(khorooNum)
    );
    return kh?.id;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);

    try {
      let data: any[][] = [];

      if (file.name.match(/\.csv$|\.txt$/i)) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        data = lines.map(line => {
          const result: string[] = [];
          let current = '', inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if ((ch === ',' || ch === '\t' || ch === ';') && !inQ) { result.push(current.trim()); current = ''; }
            else current += ch;
          }
          result.push(current.trim());
          return result;
        });
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      }

      if (data.length < 2) {
        setError('Файл хоосон эсвэл хэт цөөн мөр байна');
        return;
      }

      // Header олох
      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i];
        if (!row) continue;
        const joined = row.map((c: any) => String(c).toLowerCase()).join('|');
        if (joined.includes('нэр') || joined.includes('name') || joined.includes('сөх')) {
          headerIdx = i;
          break;
        }
      }

      const headers = data[headerIdx].map((h: any) => String(h).toLowerCase().trim());

      // Баганууд таних
      let colName = -1, colDistrict = -1, colKhoroo = -1, colAddress = -1, colPhone = -1;
      headers.forEach((h, i) => {
        if ((h.includes('нэр') || h.includes('name') || h.includes('сөх')) && colName === -1) colName = i;
        else if (h.includes('дүүрэг') || h.includes('district')) colDistrict = i;
        else if (h.includes('хороо') || h.includes('khoroo')) colKhoroo = i;
        else if (h.includes('хаяг') || h.includes('address') || h.includes('байр')) colAddress = i;
        else if (h.includes('утас') || h.includes('phone') || h.includes('дугаар')) colPhone = i;
      });

      if (colName === -1) {
        setError('Файлаас "Нэр" багана олдсонгүй. Баганы гарчиг шалгана уу.');
        return;
      }

      const rows: ParsedSokh[] = [];
      for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const rowName = String(row[colName] ?? '').trim();
        if (!rowName || rowName.length < 2) continue;

        const districtName = colDistrict >= 0 ? String(row[colDistrict] ?? '').trim() : '';
        const khorooName = colKhoroo >= 0 ? String(row[colKhoroo] ?? '').trim() : '';
        const kId = districtName && khorooName ? matchKhoroo(districtName, khorooName, fileCityId) : undefined;

        rows.push({
          name: rowName,
          district: districtName,
          khoroo: khorooName,
          address: colAddress >= 0 ? String(row[colAddress] ?? '').trim() : '',
          phone: colPhone >= 0 ? String(row[colPhone] ?? '').trim() : '',
          khoroo_id: kId,
          matched: !!kId,
        });
      }

      if (rows.length === 0) {
        setError('Файлаас өгөгдөл олдсонгүй');
        return;
      }

      setParsedRows(rows);
      setImportStep('preview');
    } catch (err) {
      setError('Файл уншихад алдаа гарлаа');
      console.error(err);
    }
  };

  // Хот сонгоход дахин match хийх
  const rematchRows = (newCityId: number | '') => {
    setFileCityId(newCityId);
    setParsedRows(prev => prev.map(row => {
      const kId = row.district && row.khoroo ? matchKhoroo(row.district, row.khoroo, newCityId) : undefined;
      return { ...row, khoroo_id: kId, matched: !!kId };
    }));
  };

  const doFileImport = async () => {
    setImportStep('importing');
    let success = 0, failed = 0, skipped = 0;

    for (const row of parsedRows) {
      if (!row.khoroo_id) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('sokh_organizations')
        .insert({
          khoroo_id: row.khoroo_id,
          name: row.name,
          address: row.address || null,
          phone: row.phone || null,
        });

      if (error) { failed++; console.error('Import error:', error, row); }
      else success++;
    }

    setImportResult({ success, failed, skipped });
    setImportStep('done');

    // Жагсаалт дахин ачаалах
    const { data: s } = await supabase
      .from('sokh_organizations')
      .select('*, khoroos(name, districts(name, cities(name)))')
      .order('created_at', { ascending: false });
    setSokhs(s || []);
  };

  // ===== Helpers =====

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

  const matchedCount = parsedRows.filter(r => r.matched).length;
  const unmatchedCount = parsedRows.filter(r => !r.matched).length;

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

      {/* Оруулах хэсэг */}
      {showForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-5 mb-6">
          {/* Tab сонголт */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setEntryMode('manual'); setError(''); setSuccess(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                entryMode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              ✏️ Нэг нэгээр
            </button>
            <button
              onClick={() => { setEntryMode('file'); setEditId(null); setError(''); setSuccess(''); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                entryMode === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              📁 Файлаар оруулах
            </button>
          </div>

          {/* ===== Нэг нэгээр оруулах ===== */}
          {entryMode === 'manual' && (
            <>
              <h2 className="text-lg font-semibold mb-4">
                {editId ? '✏️ СӨХ засварлах' : '📝 СӨХ бүртгэх'}
              </h2>

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
            </>
          )}

          {/* ===== Файлаар оруулах ===== */}
          {entryMode === 'file' && (
            <>
              {importStep === 'upload' && (
                <>
                  <h2 className="text-lg font-semibold mb-4">📁 Excel/CSV файлаар оруулах</h2>

                  {/* Хот сонголт */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Хот (файлд байхгүй бол энд сонгоно)</label>
                    <select
                      value={fileCityId}
                      onChange={e => setFileCityId(Number(e.target.value) || '')}
                      className="w-64 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Бүх хот</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Файл сонгох */}
                  <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition mb-4">
                    <p className="text-3xl mb-3">📁</p>
                    <p className="text-sm text-gray-300 mb-1">Excel (.xlsx) эсвэл CSV файл сонгоно уу</p>
                    <p className="text-xs text-gray-500 mb-4">Дүүрэг, хороо автоматаар таниж холбоно</p>
                    <label className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-500 transition">
                      Файл сонгох
                      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFile} />
                    </label>
                  </div>

                  {/* Загвар */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium mb-2">📋 Файлын загвар (багана дараалал чөлөөтэй):</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs text-gray-400">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="pr-6 py-1 text-left font-medium">Нэр *</th>
                            <th className="pr-6 py-1 text-left font-medium">Дүүрэг</th>
                            <th className="pr-6 py-1 text-left font-medium">Хороо</th>
                            <th className="pr-6 py-1 text-left font-medium">Хаяг</th>
                            <th className="pr-6 py-1 text-left font-medium">Утас</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="pr-6 py-1">Нарантуул СӨХ</td>
                            <td className="pr-6 py-1">Баянгол</td>
                            <td className="pr-6 py-1">1-р хороо</td>
                            <td className="pr-6 py-1">15-р байр</td>
                            <td className="pr-6 py-1">77001122</td>
                          </tr>
                          <tr>
                            <td className="pr-6 py-1">Од СӨХ</td>
                            <td className="pr-6 py-1">Баянгол</td>
                            <td className="pr-6 py-1">2-р хороо</td>
                            <td className="pr-6 py-1">25-р байр</td>
                            <td className="pr-6 py-1">77003344</td>
                          </tr>
                          <tr>
                            <td className="pr-6 py-1">Алтан гадас СӨХ</td>
                            <td className="pr-6 py-1">Сүхбаатар</td>
                            <td className="pr-6 py-1">3-р хороо</td>
                            <td className="pr-6 py-1">40-р байр</td>
                            <td className="pr-6 py-1">99001122</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">📄 {fileName}</h2>
                      <p className="text-sm text-gray-400">{parsedRows.length} СӨХ олдлоо</p>
                    </div>
                    <button onClick={resetFileImport} className="text-sm text-gray-400 hover:text-gray-200">
                      Өөр файл
                    </button>
                  </div>

                  {/* Статистик */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold">{parsedRows.length}</p>
                      <p className="text-xs text-gray-500">Нийт</p>
                    </div>
                    <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-green-400">{matchedCount}</p>
                      <p className="text-xs text-gray-500">Хороо таарсан</p>
                    </div>
                    <div className={`${unmatchedCount > 0 ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-gray-900/50 border-gray-700'} border rounded-xl p-3 text-center`}>
                      <p className={`text-xl font-bold ${unmatchedCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>{unmatchedCount}</p>
                      <p className="text-xs text-gray-500">Таараагүй (алгасна)</p>
                    </div>
                  </div>

                  {/* Хот сонголт - дахин match хийх */}
                  {unmatchedCount > 0 && (
                    <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-3 mb-4">
                      <p className="text-xs text-yellow-400 mb-2">Дүүрэг таараагүй байна. Хот сонгож таарахыг оролдоно уу:</p>
                      <select
                        value={fileCityId}
                        onChange={e => rematchRows(Number(e.target.value) || '')}
                        className="w-48 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Бүх хот</option>
                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Хүснэгт */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b border-gray-800">
                          <th className="px-3 py-2">№</th>
                          <th className="px-3 py-2">Нэр</th>
                          <th className="px-3 py-2">Дүүрэг</th>
                          <th className="px-3 py-2">Хороо</th>
                          <th className="px-3 py-2">Хаяг</th>
                          <th className="px-3 py-2">Утас</th>
                          <th className="px-3 py-2">Төлөв</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={`border-b border-gray-800/50 ${r.matched ? '' : 'opacity-50'}`}>
                            <td className="px-3 py-2 text-gray-500 text-xs">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-400">{r.district || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{r.khoroo || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{r.address || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{r.phone || '—'}</td>
                            <td className="px-3 py-2">
                              {r.matched
                                ? <span className="text-green-400 text-xs">✓</span>
                                : <span className="text-yellow-400 text-xs">✕ таараагүй</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedRows.length > 50 && (
                      <p className="text-center text-xs text-gray-500 py-2">...болон {parsedRows.length - 50} бусад</p>
                    )}
                  </div>

                  {/* Товчлуурууд */}
                  <div className="flex gap-3">
                    <button onClick={resetFileImport} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition">
                      Цуцлах
                    </button>
                    <button
                      onClick={doFileImport}
                      disabled={matchedCount === 0}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition"
                    >
                      ✓ Импортлох ({matchedCount} СӨХ)
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 animate-bounce">⏳</div>
                  <p className="text-gray-300">Импортлож байна...</p>
                  <p className="text-sm text-gray-500">{matchedCount} СӨХ нэмж байна</p>
                </div>
              )}

              {importStep === 'done' && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-lg font-semibold mb-4">Импорт дууслаа!</p>
                  <div className="flex justify-center gap-6 mb-6">
                    <div>
                      <p className="text-2xl font-bold text-green-400">{importResult.success}</p>
                      <p className="text-xs text-gray-500">Амжилттай</p>
                    </div>
                    {importResult.skipped > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-yellow-400">{importResult.skipped}</p>
                        <p className="text-xs text-gray-500">Алгассан</p>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
                        <p className="text-xs text-gray-500">Алдаатай</p>
                      </div>
                    )}
                  </div>
                  <button onClick={resetFileImport} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">
                    Дахин импорт
                  </button>
                </div>
              )}
            </>
          )}

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
