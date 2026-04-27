'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/app/lib/supabase';

interface City { id: number; name: string }
interface District { id: number; city_id: number; name: string }
interface Khoroo { id: number; district_id: number; name: string }

interface ParsedRow {
  raw: number;            // эх файлын мөрийн дугаар (header-ыг тооцолгүй)
  district: string;
  khoroo: string;
  sokh_name: string;
  darga_phone: string;
  darga_name: string;
  unit_count: string;     // энд string, server рүү явуулахдаа number-руу хөрвүүлнэ
  khoroo_id?: number;
  matched: boolean;
  reason?: string;
}

interface ResultRow {
  row: number;
  status: 'created' | 'matched' | 'skipped' | 'error';
  sokh_id?: number;
  sokh_name?: string;
  code?: string;
  contact_phone?: string;
  expires_at?: string;
  reason?: string;
}

const DISTRICT_ALIASES: Record<string, string> = {
  'БГД': 'Баянгол',
  'БЗД': 'Баянзүрх',
  'СБД': 'Сүхбаатар',
  'ЧД': 'Чингэлтэй',
  'ХУД': 'Хан-Уул',
  'СХД': 'Сонгинохайрхан',
};

export default function BulkOnboardPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [khoroos, setKhoroos] = useState<Khoroo[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [cityId, setCityId] = useState<number | ''>('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'submitting' | 'done'>('upload');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; created: number; matched: number; skipped: number; error: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: d }, { data: k }] = await Promise.all([
        supabase.from('cities').select('*').order('id'),
        supabase.from('districts').select('*').order('name'),
        supabase.from('khoroos').select('*').order('id'),
      ]);
      setCities(c || []);
      setDistricts(d || []);
      setKhoroos(k || []);
      const ub = (c || []).find(x => x.name === 'Улаанбаатар');
      if (ub) setCityId(ub.id);
      setLoadingMeta(false);
    };
    load();
  }, []);

  const resolveDistrict = (raw: string): District | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/дүүрэг/g, '');
    const aliasName = DISTRICT_ALIASES[trimmed.toUpperCase()] || DISTRICT_ALIASES[trimmed];
    const target = aliasName || trimmed;
    return districts.find(d => {
      if (cityId && d.city_id !== cityId) return false;
      return normalize(d.name) === normalize(target);
    });
  };

  const matchKhoroo = (districtName: string, khorooName: string): number | undefined => {
    const dist = resolveDistrict(districtName);
    if (!dist) return undefined;
    const num = khorooName.match(/(\d+)/)?.[1];
    if (!num) return undefined;
    const kh = khoroos.find(k => k.district_id === dist.id && k.name.includes(num + '-р хороо'));
    return kh?.id;
  };

  const reset = () => {
    setParsed([]);
    setResults([]);
    setSummary(null);
    setError('');
    setStep('upload');
    setPasteText('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    try {
      let data: unknown[][] = [];
      if (file.name.match(/\.csv$|\.txt$/i)) {
        const text = await file.text();
        data = parseCsv(text);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      }
      if (data.length < 2) { setError('Файл хоосон'); return; }
      parseRows(data);
    } catch (err) {
      console.error(err);
      setError('Файл уншихад алдаа гарлаа');
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) { setError('Текст оруулна уу'); return; }
    setError('');
    const data = parseCsv(pasteText);
    if (data.length < 1) { setError('Текст хоосон'); return; }
    parseRows(data);
  };

  function parseCsv(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
      const out: string[] = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if ((ch === ',' || ch === '\t' || ch === ';') && !inQ) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
  }

  function parseRows(data: unknown[][]) {
    // Header detect
    let headerIdx = 0;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      const joined = row.map(c => String(c).toLowerCase()).join('|');
      if (joined.includes('хороо') || joined.includes('сөх') || joined.includes('дарга') || joined.includes('утас')) {
        headerIdx = i;
        break;
      }
    }
    const headers = (data[headerIdx] || []).map(h => String(h).toLowerCase().trim());

    let cDist = -1, cKhoroo = -1, cName = -1, cPhone = -1, cDarga = -1, cUnit = -1;
    headers.forEach((h, i) => {
      if (cDist === -1 && (h.includes('дүүрэг') || h.includes('district'))) cDist = i;
      else if (cKhoroo === -1 && (h.includes('хороо') || h.includes('khoroo'))) cKhoroo = i;
      else if (cName === -1 && (h.includes('сөх') || h.includes('байгууллага') || h === 'нэр' || h.includes('name'))) cName = i;
      else if (cPhone === -1 && (h.includes('утас') || h.includes('phone') || h.includes('дугаар'))) cPhone = i;
      else if (cDarga === -1 && (h.includes('дарга') || h.includes('хариуцсан') || h.includes('contact'))) cDarga = i;
      else if (cUnit === -1 && (h.includes('айл') || h.includes('тоо') || h.includes('unit') || h.includes('count'))) cUnit = i;
    });

    if (cName === -1 || cPhone === -1 || cKhoroo === -1) {
      setError('"Хороо", "СӨХ нэр", "Дарга утас" багана заавал шаардлагатай');
      return;
    }

    const rows: ParsedRow[] = [];
    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const sokh_name = String(row[cName] ?? '').trim();
      if (!sokh_name || sokh_name.length < 2) continue;

      const district = cDist >= 0 ? String(row[cDist] ?? '').trim() : '';
      const khoroo = String(row[cKhoroo] ?? '').trim();
      const phoneRaw = String(row[cPhone] ?? '').trim().replace(/\D/g, '');
      const darga_phone = phoneRaw.length === 8 ? phoneRaw : '';
      const darga_name = cDarga >= 0 ? String(row[cDarga] ?? '').trim() : '';
      const unit_count = cUnit >= 0 ? String(row[cUnit] ?? '').trim() : '';

      const kId = matchKhoroo(district, khoroo);

      let reason: string | undefined;
      if (!darga_phone) reason = 'Утас 8 оронтой биш';
      else if (!kId) reason = 'Хороо тохироогүй';

      rows.push({
        raw: i + 1,
        district,
        khoroo,
        sokh_name,
        darga_phone,
        darga_name,
        unit_count,
        khoroo_id: kId,
        matched: !!kId && !!darga_phone,
        reason,
      });
    }

    if (rows.length === 0) { setError('Мөр олдсонгүй'); return; }
    setParsed(rows);
    setStep('preview');
  }

  const submit = async () => {
    const valid = parsed.filter(r => r.matched);
    if (valid.length === 0) { setError('Хүчинтэй мөр алга'); return; }
    setError('');
    setStep('submitting');
    try {
      const res = await fetch('/api/admin/organizations/bulk-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: valid.map(r => ({
            khoroo_id: r.khoroo_id,
            sokh_name: r.sokh_name,
            address: '',
            darga_phone: r.darga_phone,
            darga_name: r.darga_name || undefined,
            unit_count: r.unit_count ? Number(r.unit_count.replace(/\D/g, '')) : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа');
        setStep('preview');
        return;
      }
      setResults(data.results || []);
      setSummary(data.summary || null);
      setStep('done');
    } catch {
      setError('Сүлжээний алдаа');
      setStep('preview');
    }
  };

  const downloadResultsCsv = () => {
    const headers = ['СӨХ нэр', 'Утас', 'Идэвхжүүлэх код', 'Хүчинтэй хүртэл', 'Төлөв', 'Тайлбар'];
    const lines = [headers.join(',')];
    for (const r of results) {
      const cols = [
        csvEscape(r.sokh_name || ''),
        csvEscape(r.contact_phone || ''),
        csvEscape(r.code || ''),
        csvEscape(r.expires_at ? new Date(r.expires_at).toLocaleString('mn-MN') : ''),
        csvEscape(r.status),
        csvEscape(r.reason || ''),
      ];
      lines.push(cols.join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-onboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function csvEscape(s: string): string {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const validCount = parsed.filter(r => r.matched).length;
  const invalidCount = parsed.length - validCount;

  if (loadingMeta) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <a href="/mng-ctrl/organizations" className="text-sm text-gray-400 hover:text-gray-200">← Буцах</a>
        <h1 className="text-2xl font-bold mt-1">🚀 Бөөн онбординг</h1>
        <p className="text-sm text-gray-500 mt-1">CSV/Excel-аар СӨХ + идэвхжүүлэх кодуудыг нэг алхамд үүсгэнэ</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 p-3 rounded-xl text-sm mb-4">{error}</div>
      )}

      {step === 'upload' && (
        <>
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Хот</label>
            <select
              value={cityId}
              onChange={e => setCityId(e.target.value ? Number(e.target.value) : '')}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm w-full max-w-xs"
            >
              <option value="">— Сонгох —</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">Энэ хотын дүүрэг/хороонд тохирох мөрүүдийг ашиглана</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5 mb-4">
            <h3 className="font-semibold text-sm mb-3">📁 Файлаар оруулах</h3>
            <p className="text-xs text-gray-400 mb-3">
              Заавал багана: <code className="text-amber-300">Хороо</code>,{' '}
              <code className="text-amber-300">СӨХ нэр</code>,{' '}
              <code className="text-amber-300">Дарга утас</code>.
              Сонголтоор: <code>Дүүрэг</code>, <code>Дарга нэр</code>, <code>Айлын тоо</code>
            </p>
            <input
              type="file"
              ref={fileRef}
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFile}
              className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            />
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">📋 Эсвэл текст буулгах</h3>
            <p className="text-xs text-gray-400 mb-2">CSV/таб-аар тусгаарласан, эхний мөр гарчигтай</p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              rows={6}
              placeholder={'Дүүрэг,Хороо,СӨХ нэр,Дарга утас,Дарга нэр,Айлын тоо\nБаянгол,1-р хороо,Нарантуул СӨХ,99001122,Бат,60'}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono"
            />
            <button
              onClick={handlePaste}
              disabled={!pasteText.trim()}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Текст шалгах
            </button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="flex gap-3 mb-4 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">
              ✓ {validCount} зөв
            </span>
            {invalidCount > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-red-900/30 text-red-400 border border-red-800/50">
                ✗ {invalidCount} алдаатай
              </span>
            )}
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/50 text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">№</th>
                  <th className="px-3 py-2 text-left">Хороо</th>
                  <th className="px-3 py-2 text-left">СӨХ нэр</th>
                  <th className="px-3 py-2 text-left">Дарга утас</th>
                  <th className="px-3 py-2 text-left">Дарга нэр</th>
                  <th className="px-3 py-2 text-center">Айл</th>
                  <th className="px-3 py-2 text-center">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-800/50 ${!r.matched ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.raw}</td>
                    <td className="px-3 py-2 text-xs">{[r.district, r.khoroo].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.sokh_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.darga_phone || <span className="text-red-400">—</span>}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{r.darga_name || '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.unit_count || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {r.matched
                        ? <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400">Бэлэн</span>
                        : <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-900/30 text-red-400" title={r.reason}>{r.reason || 'Алдаа'}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
              Цуцлах
            </button>
            <button
              onClick={submit}
              disabled={validCount === 0}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {validCount} мөр импортлоход + код үүсгэх
            </button>
          </div>
        </>
      )}

      {step === 'submitting' && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
          <p className="text-amber-400 mb-2">⏳ Импорт хийж, кодуудыг үүсгэж байна...</p>
          <p className="text-xs text-gray-500">{validCount} мөр</p>
        </div>
      )}

      {step === 'done' && summary && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-3">
              <p className="text-2xl font-bold text-green-400">{summary.created}</p>
              <p className="text-xs text-gray-400">Шинэ СӨХ</p>
            </div>
            <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-3">
              <p className="text-2xl font-bold text-blue-400">{summary.matched}</p>
              <p className="text-xs text-gray-400">Одоо байгаа+код</p>
            </div>
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3">
              <p className="text-2xl font-bold text-gray-400">{summary.skipped}</p>
              <p className="text-xs text-gray-400">Алгассан</p>
            </div>
            <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-3">
              <p className="text-2xl font-bold text-red-400">{summary.error}</p>
              <p className="text-xs text-gray-400">Алдаа</p>
            </div>
          </div>

          <div className="bg-amber-950/30 border border-amber-900/50 rounded-xl p-4 text-xs text-amber-200/80 mb-4">
            ⚠️ Доорх кодуудыг зөвхөн нэг удаа харуулж байна. CSV-аар татаж аваад СӨХ-н даргад утсаар/SMS-аар дамжуулна уу.
            Хэрэглэгч <code className="bg-black/30 px-1 rounded">/activate</code> хуудсаар идэвхжүүлнэ.
          </div>

          <div className="flex gap-3 mb-4">
            <button onClick={downloadResultsCsv} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">
              📥 Үр дүн CSV татах
            </button>
            <button onClick={reset} className="px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
              Шинэ batch
            </button>
            <a href="/mng-ctrl/organizations" className="px-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
              СӨХ жагсаалт руу
            </a>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/50 text-xs text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left">СӨХ</th>
                  <th className="px-3 py-2 text-left">Утас</th>
                  <th className="px-3 py-2 text-left">Код</th>
                  <th className="px-3 py-2 text-left">Хүчинтэй хүртэл</th>
                  <th className="px-3 py-2 text-center">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.row} className="border-b border-gray-800/50">
                    <td className="px-3 py-2 font-medium">{r.sokh_name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.contact_phone || '—'}</td>
                    <td className="px-3 py-2 font-mono text-amber-300 tracking-widest">{r.code || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{r.expires_at ? new Date(r.expires_at).toLocaleString('mn-MN') : '—'}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {r.status === 'created' && <span className="text-green-400">Шинэ</span>}
                      {r.status === 'matched' && <span className="text-blue-400">Шинэ код</span>}
                      {r.status === 'skipped' && <span className="text-gray-500" title={r.reason}>Алгассан</span>}
                      {r.status === 'error' && <span className="text-red-400" title={r.reason}>Алдаа</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-6 mb-2 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl">
        <p className="text-xs font-semibold text-gray-300 mb-2">📋 CSV дээж</p>
        <pre className="text-xs text-gray-400 font-mono overflow-x-auto">{`Дүүрэг,Хороо,СӨХ нэр,Дарга утас,Дарга нэр,Айлын тоо
Баянгол,1-р хороо,Нарантуул СӨХ,99001122,Бат,60
БЗД,5-р хороо,Алтай СӨХ,88112233,Дорж,45`}</pre>
      </div>
    </div>
  );
}
