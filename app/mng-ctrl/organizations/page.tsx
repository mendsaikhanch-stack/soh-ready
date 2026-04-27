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
  claim_status?: 'unclaimed' | 'pending' | 'active';
  activated_at?: string | null;
  khoroos?: { name: string; districts?: { name: string; cities?: { name: string } } };
}

interface ActivationResult {
  sokh_id: number;
  sokh_name: string;
  code: string;
  contact_phone: string;
  expires_at: string;
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

type EntryMode = 'manual' | 'file' | 'image' | 'paste';

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

  // Paste state
  const [pasteText, setPasteText] = useState('');

  // Image OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState('');

  // Жагсаалт шүүлтүүр
  const [filterCityId, setFilterCityId] = useState<number | ''>('');
  const [filterDistrictId, setFilterDistrictId] = useState<number | ''>('');
  const [filterKhorooId, setFilterKhorooId] = useState<number | ''>('');
  const [searchText, setSearchText] = useState('');

  // Идэвхжүүлэх код модал
  const [activatePrompt, setActivatePrompt] = useState<{ id: number; name: string } | null>(null);
  const [activatePhone, setActivatePhone] = useState('');
  const [activateLoading, setActivateLoading] = useState(false);
  const [activateError, setActivateError] = useState('');
  const [activateResult, setActivateResult] = useState<ActivationResult | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const addedCount = useRef(0);

  // Load data
  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: r }, { data: c }, { data: d }, { data: k }] = await Promise.all([
        supabase.from('sokh_organizations').select('id, name, address, phone, khoroo_id, created_at, claim_status, activated_at, khoroos(name, districts(name, cities(name)))').order('created_at', { ascending: false }),
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

  // ===== Reset functions =====

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setEditId(null);
    setError('');
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const resetFileImport = () => {
    setParsedRows([]);
    setFileName('');
    setImportStep('upload');
    setImportResult({ success: 0, failed: 0, skipped: 0 });
    setFileCityId('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetImageImport = () => {
    setImagePreview('');
    setOcrProgress(0);
    setParsedRows([]);
    setImportStep('upload');
    setImportResult({ success: 0, failed: 0, skipped: 0 });
    setFileCityId('');
    if (imgRef.current) imgRef.current.value = '';
  };

  const resetFormFull = () => {
    setCityId('');
    setDistrictId('');
    setKhorooId('');
    resetForm();
    resetFileImport();
    resetImageImport();
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

  const DISTRICT_ALIASES: Record<string, string> = {
    'БГД': 'Баянгол', 'BGD': 'Баянгол',
    'СБД': 'Сүхбаатар', 'SBD': 'Сүхбаатар',
    'ЧД': 'Чингэлтэй', 'CHD': 'Чингэлтэй',
    'СХД': 'Сонгинохайрхан', 'SHD': 'Сонгинохайрхан', 'СОХД': 'Сонгинохайрхан',
    'БЗД': 'Баянзүрх', 'BZD': 'Баянзүрх',
    'ХУД': 'Хан-Уул', 'HUD': 'Хан-Уул',
    'НД': 'Налайх',
    'БНУД': 'Багануур', 'БНД': 'Багануур',
    'БХД': 'Багахангай',
  };

  const resolveDistrict = (raw: string, selectedCityId: number | '') => {
    const trimmed = raw.trim();
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/дүүрэг/g, '');
    // Try alias first
    const aliasName = DISTRICT_ALIASES[trimmed.toUpperCase()] || DISTRICT_ALIASES[trimmed];
    const target = aliasName || trimmed;
    return districts.find(d => {
      if (selectedCityId && d.city_id !== selectedCityId) return false;
      return normalize(d.name) === normalize(target);
    });
  };

  const matchKhoroo = (districtName: string, khorooName: string, selectedCityId: number | ''): number | undefined => {
    const dist = resolveDistrict(districtName, selectedCityId);
    if (!dist) return undefined;
    const khorooNum = khorooName.match(/(\d+)/)?.[1];
    if (!khorooNum) return undefined;
    const kh = khoroos.find(k =>
      k.district_id === dist.id && k.name.includes(khorooNum + '-р хороо')
    );
    return kh?.id;
  };

  // "БГД, 8-р хороо" гэх мэт нэгдсэн форматыг задлах
  const parseDistrictKhoroo = (combined: string): { district: string; khoroo: string } | null => {
    // "БГД, 8-р хороо" or "Баянгол 8" or "БГД 8-р хороо"
    const m = combined.match(/^([А-Яа-яA-Za-zӨөҮүЁё-]+)\s*[,.\s]+\s*(\d+)\s*-?\s*р?\s*хороо?/i)
      || combined.match(/^([А-Яа-яA-Za-zӨөҮүЁё-]+)\s*[,.\s]+\s*(\d+)/);
    if (m) return { district: m[1].trim(), khoroo: m[2] + '-р хороо' };
    return null;
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
        if (joined.includes('нэр') || joined.includes('name') || joined.includes('сөх') || joined.includes('дүүрэг') || joined.includes('хороо') || joined.includes('утас')) {
          headerIdx = i;
          break;
        }
      }

      const headers = data[headerIdx].map((h: any) => String(h).toLowerCase().trim());

      // Баганууд таних
      let colName = -1, colDistrict = -1, colKhoroo = -1, colAddress = -1, colPhone = -1, colContact = -1, colCombined = -1;
      headers.forEach((h, i) => {
        if ((h.includes('нэр') || h.includes('name') || h.includes('сөх') || h.includes('байгууллага')) && colName === -1) colName = i;
        else if ((h.includes('дүүрэг') && h.includes('хороо')) || h === 'дүүрэг/хороо') colCombined = i;
        else if (h.includes('дүүрэг') || h.includes('district')) colDistrict = i;
        else if (h.includes('хороо') || h.includes('khoroo')) colKhoroo = i;
        else if (h.includes('хаяг') || h.includes('address') || h.includes('байр')) colAddress = i;
        else if (h.includes('утас') || h.includes('phone') || h.includes('дугаар')) colPhone = i;
        else if (h.includes('холбоо') || h.includes('contact') || h.includes('хүн')) colContact = i;
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

        let districtName = colDistrict >= 0 ? String(row[colDistrict] ?? '').trim() : '';
        let khorooName = colKhoroo >= 0 ? String(row[colKhoroo] ?? '').trim() : '';

        // Нэгдсэн "Дүүрэг/Хороо" багана задлах
        if (colCombined >= 0 && !districtName) {
          const combined = String(row[colCombined] ?? '').trim();
          const parsed = parseDistrictKhoroo(combined);
          if (parsed) { districtName = parsed.district; khorooName = parsed.khoroo; }
        }

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

    // Дутуу хороо автомат үүсгэх
    const missingKhoroos: { district: string; khoroo: string }[] = [];
    for (const row of parsedRows) {
      if (!row.khoroo_id && row.district && row.khoroo) {
        const dist = resolveDistrict(row.district, fileCityId);
        if (dist) {
          const kNum = row.khoroo.match(/(\d+)/)?.[1];
          if (kNum && !khoroos.find(k => k.district_id === dist.id && k.name === kNum + '-р хороо')) {
            missingKhoroos.push({ district: dist.id.toString(), khoroo: kNum });
          }
        }
      }
    }

    if (missingKhoroos.length > 0) {
      const unique = [...new Set(missingKhoroos.map(m => m.district + ':' + m.khoroo))];
      const toInsert = unique.map(k => {
        const [dId, num] = k.split(':');
        return { district_id: +dId, name: num + '-р хороо' };
      });
      await supabase.from('khoroos').insert(toInsert);
      // Дахин ачаалах
      const { data: newK } = await supabase.from('khoroos').select('*').order('id');
      if (newK) {
        setKhoroos(newK);
        // Re-match
        for (const row of parsedRows) {
          if (!row.khoroo_id && row.district && row.khoroo) {
            const dist = resolveDistrict(row.district, fileCityId);
            if (dist) {
              const kNum = row.khoroo.match(/(\d+)/)?.[1];
              const kh = newK.find(k => k.district_id === dist.id && k.name === kNum + '-р хороо');
              if (kh) { row.khoroo_id = kh.id; row.matched = true; }
            }
          }
        }
      }
    }

    // Давхардал шалгах
    const existingNames = new Set(sokhs.map(s => s.name.toLowerCase() + '|' + s.khoroo_id));

    for (const row of parsedRows) {
      if (!row.khoroo_id) { skipped++; continue; }

      const dupKey = row.name.toLowerCase() + '|' + row.khoroo_id;
      if (existingNames.has(dupKey)) { skipped++; continue; }

      const { error } = await supabase
        .from('sokh_organizations')
        .insert({
          khoroo_id: row.khoroo_id,
          name: row.name,
          address: row.address || null,
          phone: row.phone || null,
        });

      if (error) { failed++; console.error('Import error:', error, row); }
      else { success++; existingNames.add(dupKey); }
    }

    setImportResult({ success, failed, skipped });
    setImportStep('done');

    const { data: s } = await supabase
      .from('sokh_organizations')
      .select('*, khoroos(name, districts(name, cities(name)))')
      .order('created_at', { ascending: false });
    setSokhs(s || []);
  };

  // ===== Image OCR functions =====

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    // Preview
    const url = URL.createObjectURL(file);
    setImagePreview(url);

    // OCR
    setOcrLoading(true);
    setOcrProgress(0);

    try {
      const Tesseract = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(file, 'mon+rus+eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Parse OCR text into rows
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      const rows: ParsedSokh[] = [];

      for (const line of lines) {
        // Утасны дугаар олох (8 оронтой)
        const phoneMatch = line.match(/(\d{8})/);
        const phonePart = phoneMatch ? phoneMatch[1] : '';

        // Дүүрэг олох
        const districtMatch = line.match(/(баянгол|хан-уул|сүхбаатар|чингэлтэй|баянзүрх|сонгинохайрхан|налайх|багануур|багахангай)/i);
        const districtPart = districtMatch ? districtMatch[1] : '';

        // Хороо олох
        const khorooMatch = line.match(/(\d+)\s*-?\s*(?:р\s*)?хороо/i) || line.match(/хороо\s*(\d+)/i);
        const khorooPart = khorooMatch ? khorooMatch[1] + '-р хороо' : '';

        // Утас, дүүрэг, хороо хассан хэсгийг нэр болгох
        let namePart = line;
        if (phonePart) namePart = namePart.replace(phonePart, '');
        if (districtMatch) namePart = namePart.replace(districtMatch[0], '');
        if (khorooMatch) namePart = namePart.replace(khorooMatch[0], '');
        namePart = namePart.replace(/[,;|/\-]+$/g, '').replace(/^[,;|/\-]+/g, '').trim();
        // Хаяг тусад нь салгах
        const addrMatch = namePart.match(/(\d+\s*-?\s*р?\s*байр)/i);
        const addressPart = addrMatch ? addrMatch[1] : '';
        if (addrMatch) namePart = namePart.replace(addrMatch[0], '').trim();
        namePart = namePart.replace(/\s{2,}/g, ' ').replace(/[,;|]+$/g, '').trim();

        if (!namePart || namePart.length < 2) continue;

        const kId = districtPart && khorooPart
          ? matchKhoroo(districtPart, khorooPart, fileCityId)
          : undefined;

        rows.push({
          name: namePart,
          district: districtPart,
          khoroo: khorooPart,
          address: addressPart,
          phone: phonePart,
          khoroo_id: kId,
          matched: !!kId,
        });
      }

      if (rows.length === 0) {
        setError('Зургаас өгөгдөл таниж чадсангүй. Илүү тод зураг оруулна уу.');
      } else {
        setParsedRows(rows);
        setImportStep('preview');
      }
    } catch (err) {
      setError('Зураг танихад алдаа гарлаа');
      console.error(err);
    } finally {
      setOcrLoading(false);
    }
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

  const openActivate = (s: Sokh) => {
    setActivatePrompt({ id: s.id, name: s.name });
    setActivatePhone(s.phone || '');
    setActivateError('');
    setActivateResult(null);
  };

  const closeActivate = () => {
    setActivatePrompt(null);
    setActivatePhone('');
    setActivateError('');
    setActivateResult(null);
    setActivateLoading(false);
  };

  const submitActivate = async () => {
    if (!activatePrompt) return;
    if (!/^\d{8}$/.test(activatePhone.trim())) {
      setActivateError('Утасны дугаар 8 оронтой байна');
      return;
    }
    setActivateLoading(true);
    setActivateError('');
    try {
      const res = await fetch(`/api/admin/organizations/${activatePrompt.id}/issue-activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_phone: activatePhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActivateError(data.error || 'Алдаа гарлаа');
      } else {
        setActivateResult({
          sokh_id: activatePrompt.id,
          sokh_name: activatePrompt.name,
          code: data.code,
          contact_phone: data.contact_phone,
          expires_at: data.expires_at,
        });
        // Жагсаалтад claim_status='pending' болсныг тусгах
        setSokhs(prev => prev.map(x => x.id === activatePrompt.id
          ? { ...x, claim_status: x.claim_status === 'active' ? x.claim_status : 'pending' }
          : x));
      }
    } catch {
      setActivateError('Сүлжээний алдаа');
    } finally {
      setActivateLoading(false);
    }
  };

  const claimBadge = (status?: Sokh['claim_status']) => {
    if (status === 'active') return { label: 'Идэвхтэй', cls: 'bg-green-900/30 text-green-400 border border-green-800/50' };
    if (status === 'pending') return { label: 'Хүлээгдэж буй', cls: 'bg-amber-900/30 text-amber-400 border border-amber-800/50' };
    return { label: 'Гэрээгүй', cls: 'bg-gray-800 text-gray-500 border border-gray-700' };
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
            <button
              onClick={() => { setEntryMode('paste'); setEditId(null); setError(''); setSuccess(''); setPasteText(''); setParsedRows([]); setImportStep('upload'); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                entryMode === 'paste'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              📋 Буулгах
            </button>
            <button
              onClick={() => { setEntryMode('image'); setEditId(null); setError(''); setSuccess(''); resetImageImport(); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                entryMode === 'image'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              📷 Зургаар оруулах
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

          {/* ===== Буулгаж оруулах ===== */}
          {entryMode === 'paste' && (
            <>
              {importStep === 'upload' && (
                <>
                  <h2 className="text-lg font-semibold mb-4">📋 Текст буулгаж оруулах</h2>
                  <p className="text-xs text-gray-500 mb-3">CSV, хүснэгт, чөлөөт текст — ямар ч формат, автомат таниж задална. Товчилсон нэрс (БГД, СБД, ЧД, СХД...) танина.</p>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={"Жишээ:\nБГД, 8-р хороо, Тэмүүлэл, Г.Эрдэнэцэцэг, 99037139\nСБД, 11-р хороо, Рашаант, СӨХ, 80129114\n\nЭсвэл header-тай:\nДүүрэг/Хороо,СӨХ,Холбоо барих хүн,Утас\nБГД 8-р хороо,Тэмүүлэл,Г.Эрдэнэцэцэг,99037139"}
                    className="w-full h-48 bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y placeholder:text-gray-600"
                  />
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => {
                        if (!pasteText.trim()) { setError('Текст оруулна уу'); return; }
                        setError('');
                        const lines = pasteText.split('\n').filter(l => l.trim());
                        // CSV parse
                        const parsed: string[][] = lines.map(line => {
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

                        // Detect header
                        let headerIdx = -1;
                        for (let i = 0; i < Math.min(3, parsed.length); i++) {
                          const joined = parsed[i].join('|').toLowerCase();
                          if (joined.includes('нэр') || joined.includes('сөх') || joined.includes('дүүрэг') || joined.includes('утас') || joined.includes('байгууллага')) {
                            headerIdx = i;
                            break;
                          }
                        }

                        const rows: ParsedSokh[] = [];
                        const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;

                        if (headerIdx >= 0) {
                          // Header-тай формат
                          const headers = parsed[headerIdx].map(h => h.toLowerCase());
                          let cName = -1, cDist = -1, cKhoroo = -1, cPhone = -1, cCombined = -1;
                          headers.forEach((h, i) => {
                            if ((h.includes('нэр') || h.includes('сөх') || h.includes('байгууллага')) && cName === -1) cName = i;
                            else if ((h.includes('дүүрэг') && h.includes('хороо')) || h === 'дүүрэг/хороо') cCombined = i;
                            else if (h.includes('дүүрэг')) cDist = i;
                            else if (h.includes('хороо')) cKhoroo = i;
                            else if (h.includes('утас') || h.includes('дугаар')) cPhone = i;
                          });

                          for (let i = startIdx; i < parsed.length; i++) {
                            const r = parsed[i];
                            const name = cName >= 0 ? (r[cName] || '').trim() : '';
                            if (!name || name.length < 2) continue;
                            let district = cDist >= 0 ? (r[cDist] || '').trim() : '';
                            let khoroo = cKhoroo >= 0 ? (r[cKhoroo] || '').trim() : '';
                            if (cCombined >= 0 && !district) {
                              const p = parseDistrictKhoroo((r[cCombined] || '').trim());
                              if (p) { district = p.district; khoroo = p.khoroo; }
                            }
                            const kId = district && khoroo ? matchKhoroo(district, khoroo, '') : undefined;
                            rows.push({ name, district, khoroo, address: '', phone: cPhone >= 0 ? (r[cPhone] || '').trim() : '', khoroo_id: kId, matched: !!kId });
                          }
                        } else {
                          // Header-гүй — автомат таних
                          for (let i = startIdx; i < parsed.length; i++) {
                            const r = parsed[i].filter(c => c);
                            if (r.length < 2) continue;
                            // Дүүрэг/хороо олох
                            let district = '', khoroo = '', name = '', phone = '';
                            const rest: string[] = [];
                            for (const cell of r) {
                              const p = parseDistrictKhoroo(cell);
                              if (p && !district) { district = p.district; khoroo = p.khoroo; }
                              else if (/^\d{8}/.test(cell.replace(/\s/g, '')) || /\d{8}/.test(cell.replace(/[,; ]/g, ''))) {
                                phone = phone ? phone + ', ' + cell : cell;
                              } else if (/^\d+$/.test(cell)) {
                                // Skip row numbers
                              } else {
                                rest.push(cell);
                              }
                            }
                            name = rest[0] || '';
                            if (!name || name.length < 2) continue;
                            const kId = district && khoroo ? matchKhoroo(district, khoroo, '') : undefined;
                            rows.push({ name, district, khoroo, address: '', phone, khoroo_id: kId, matched: !!kId });
                          }
                        }

                        if (rows.length === 0) { setError('Текстээс өгөгдөл олдсонгүй'); return; }
                        setParsedRows(rows);
                        setImportStep('preview');
                      }}
                      disabled={!pasteText.trim()}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition"
                    >
                      Задлах
                    </button>
                    <span className="text-xs text-gray-500 self-center">{pasteText.split('\n').filter(l => l.trim()).length} мөр</span>
                  </div>
                </>
              )}

              {/* Preview/importing/done — file import-тай ижил UI */}
              {importStep === 'preview' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">📋 Буулгасан өгөгдөл</h2>
                      <p className="text-sm text-gray-400">{parsedRows.length} СӨХ олдлоо</p>
                    </div>
                    <button onClick={() => { setImportStep('upload'); setParsedRows([]); }} className="text-sm text-gray-400 hover:text-gray-200">
                      Буцах
                    </button>
                  </div>
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
                      <p className="text-xs text-gray-500">Таараагүй (хороо үүсгэнэ)</p>
                    </div>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b border-gray-800">
                          <th className="px-3 py-2">№</th>
                          <th className="px-3 py-2">Нэр</th>
                          <th className="px-3 py-2">Дүүрэг</th>
                          <th className="px-3 py-2">Хороо</th>
                          <th className="px-3 py-2">Утас</th>
                          <th className="px-3 py-2">Төлөв</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 100).map((r, i) => (
                          <tr key={i} className={`border-b border-gray-800/50 ${r.matched ? '' : 'opacity-60'}`}>
                            <td className="px-3 py-2 text-gray-500 text-xs">{i + 1}</td>
                            <td className="px-3 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-gray-400">{r.district || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{r.khoroo || '—'}</td>
                            <td className="px-3 py-2 text-gray-400">{r.phone || '—'}</td>
                            <td className="px-3 py-2">
                              {r.matched
                                ? <span className="text-green-400 text-xs">✓</span>
                                : r.district && r.khoroo
                                  ? <span className="text-blue-400 text-xs">+ хороо үүсгэнэ</span>
                                  : <span className="text-yellow-400 text-xs">✕ таараагүй</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setImportStep('upload'); setParsedRows([]); }} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition">Цуцлах</button>
                    <button
                      onClick={doFileImport}
                      disabled={parsedRows.filter(r => r.matched || (r.district && r.khoroo)).length === 0}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition"
                    >
                      ✓ Импортлох ({parsedRows.filter(r => r.matched || (r.district && r.khoroo)).length} СӨХ)
                    </button>
                  </div>
                </>
              )}

              {importStep === 'importing' && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 animate-bounce">⏳</div>
                  <p className="text-gray-300">Импортлож байна...</p>
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
                        <p className="text-xs text-gray-500">Алгассан / давхардсан</p>
                      </div>
                    )}
                    {importResult.failed > 0 && (
                      <div>
                        <p className="text-2xl font-bold text-red-400">{importResult.failed}</p>
                        <p className="text-xs text-gray-500">Алдаатай</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setImportStep('upload'); setParsedRows([]); setPasteText(''); }} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">
                    Дахин буулгах
                  </button>
                </div>
              )}
            </>
          )}

          {/* ===== Зургаар оруулах ===== */}
          {entryMode === 'image' && (
            <>
              {importStep === 'upload' && (
                <>
                  <h2 className="text-lg font-semibold mb-4">📷 Зургаар оруулах (OCR)</h2>

                  {/* Хот сонголт */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Хот (таних үр дүнг дүүргэд тулгахад ашиглана)</label>
                    <select
                      value={fileCityId}
                      onChange={e => setFileCityId(Number(e.target.value) || '')}
                      className="w-64 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Бүх хот</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* Зураг сонгох */}
                  <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500 transition mb-4">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto mb-3 rounded-lg" />
                    ) : (
                      <p className="text-3xl mb-3">📷</p>
                    )}
                    {ocrLoading ? (
                      <div>
                        <p className="text-sm text-gray-300 mb-2">Зураг танилт хийж байна...</p>
                        <div className="w-64 mx-auto bg-gray-700 rounded-full h-2 mb-2">
                          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
                        </div>
                        <p className="text-xs text-gray-500">{ocrProgress}%</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-300 mb-1">СӨХ жагсаалтын зургаа оруулна уу</p>
                        <p className="text-xs text-gray-500 mb-4">JPG, PNG форматтай тод зураг илүү сайн танина</p>
                        <label className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-500 transition">
                          Зураг сонгох
                          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Тайлбар */}
                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <p className="text-xs text-gray-400 font-medium mb-2">💡 Зөвлөмж:</p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>- Тод, ойлгомжтой зураг илүү сайн танигдана</li>
                      <li>- СӨХ нэр, дүүрэг, хороо, утас агуулсан хүснэгт маягийн зураг тохиромжтой</li>
                      <li>- OCR танилтын дараа мэдээллийг шалгаж, засварлах боломжтой</li>
                    </ul>
                  </div>
                </>
              )}

              {/* Preview, importing, done — file import-тай ижил UI ашиглана */}
              {importStep === 'preview' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">📷 OCR үр дүн</h2>
                      <p className="text-sm text-gray-400">{parsedRows.length} мөр таниглаа</p>
                    </div>
                    <button onClick={resetImageImport} className="text-sm text-gray-400 hover:text-gray-200">
                      Өөр зураг
                    </button>
                  </div>

                  {imagePreview && (
                    <div className="mb-4">
                      <img src={imagePreview} alt="Source" className="max-h-40 rounded-lg border border-gray-700" />
                    </div>
                  )}

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

                  {/* Хот сонголт - дахин match */}
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
                    <button onClick={resetImageImport} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition">
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
                  <button onClick={resetImageImport} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">
                    Дахин зураг оруулах
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

      {/* Шүүлтүүр */}
      {!loading && sokhs.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500 block mb-1">Хайх</label>
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="СӨХ нэр, утас..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Хот</label>
              <select
                value={filterCityId}
                onChange={e => { setFilterCityId(Number(e.target.value) || ''); setFilterDistrictId(''); setFilterKhorooId(''); }}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Бүгд</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дүүрэг</label>
              <select
                value={filterDistrictId}
                onChange={e => { setFilterDistrictId(Number(e.target.value) || ''); setFilterKhorooId(''); }}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Бүгд</option>
                {districts.filter(d => !filterCityId || d.city_id === filterCityId).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Хороо</label>
              <select
                value={filterKhorooId}
                onChange={e => setFilterKhorooId(Number(e.target.value) || '')}
                className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Бүгд</option>
                {khoroos.filter(k => !filterDistrictId || k.district_id === filterDistrictId).map(k => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>
            {(filterCityId || filterDistrictId || filterKhorooId || searchText) && (
              <button
                onClick={() => { setFilterCityId(''); setFilterDistrictId(''); setFilterKhorooId(''); setSearchText(''); }}
                className="text-xs text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-700"
              >
                Цэвэрлэх
              </button>
            )}
          </div>
        </div>
      )}

      {/* Жагсаалт — хүснэгт хэлбэрээр */}
      {loading ? <p className="text-gray-500">Ачаалж байна...</p> : sokhs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">🏢</p>
          <p>СӨХ бүртгэлгүй байна</p>
          <p className="text-sm mt-1">Дээрх "+ СӨХ нэмэх" товч дарж эхлэнэ үү</p>
        </div>
      ) : (
        <>
        {(() => {
          const search = searchText.toLowerCase().trim();
          const filtered = sokhs.filter(s => {
            // Хороо шүүлтүүр
            if (filterKhorooId && s.khoroo_id !== filterKhorooId) return false;
            // Дүүрэг шүүлтүүр
            if (filterDistrictId) {
              const k = khoroos.find(k => k.id === s.khoroo_id);
              if (!k || k.district_id !== filterDistrictId) return false;
            }
            // Хот шүүлтүүр
            if (filterCityId && !filterDistrictId) {
              const k = khoroos.find(k => k.id === s.khoroo_id);
              const d = k ? districts.find(d => d.id === k.district_id) : null;
              if (!d || d.city_id !== filterCityId) return false;
            }
            // Текст хайлт
            if (search) {
              const haystack = `${s.name} ${s.phone || ''} ${s.address || ''}`.toLowerCase();
              if (!haystack.includes(search)) return false;
            }
            return true;
          });

          return (<>
            <p className="text-xs text-gray-500 mb-2">{filtered.length} / {sokhs.length} СӨХ</p>
            <div className="bg-gray-800/50 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-700 bg-gray-900/50">
                  <th className="px-4 py-3 font-medium">№</th>
                  <th className="px-4 py-3 font-medium">СӨХ нэр</th>
                  <th className="px-4 py-3 font-medium">Дүүрэг</th>
                  <th className="px-4 py-3 font-medium">Хороо</th>
                  <th className="px-4 py-3 font-medium">Хаяг</th>
                  <th className="px-4 py-3 font-medium">Утас</th>
                  <th className="px-4 py-3 font-medium text-center">Айл</th>
                  <th className="px-4 py-3 font-medium text-center">Өр</th>
                  <th className="px-4 py-3 font-medium text-center">Гэрээ</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const stats = getOrgStats(s.id);
                  const k = s.khoroos;
                  const districtName = k?.districts?.name || '—';
                  const khorooName = k?.name || '—';
                  return (
                    <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/80 transition group">
                      <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-400">{districtName}</td>
                      <td className="px-4 py-3 text-gray-400">{khorooName}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{s.address || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{s.phone || <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3 text-center">{stats.count}</td>
                      <td className="px-4 py-3 text-center">
                        {stats.debt > 0 ? <span className="text-red-400">{(stats.debt/1000).toFixed(0)}к₮</span> : <span className="text-gray-600">0₮</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const b = claimBadge(s.claim_status);
                          return <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${b.cls}`}>{b.label}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                          {s.claim_status !== 'active' && (
                            <button onClick={() => openActivate(s)} className="text-xs bg-amber-900/40 hover:bg-amber-800/60 px-2.5 py-1 rounded-lg text-amber-300">
                              {s.claim_status === 'pending' ? '🔁 Шинэ код' : '🔑 Идэвхжүүлэх'}
                            </button>
                          )}
                          <button onClick={() => handleEdit(s)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2.5 py-1 rounded-lg text-gray-300">✏️</button>
                          <button onClick={() => handleDelete(s)} className="text-xs bg-red-900/50 hover:bg-red-800/50 px-2.5 py-1 rounded-lg text-red-400">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
          </>);
        })()}
        </>
      )}

      {/* Идэвхжүүлэх код модал */}
      {activatePrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={closeActivate}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {!activateResult ? (
              <>
                <h3 className="text-lg font-bold mb-1">🔑 Идэвхжүүлэх код илгээх</h3>
                <p className="text-sm text-gray-400 mb-4">{activatePrompt.name}</p>
                <p className="text-xs text-gray-500 mb-2">СӨХ-н дарга/няраваас баталгаажсан утасны дугаар</p>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={activatePhone}
                  onChange={e => setActivatePhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="99XXXXXX"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3"
                  autoFocus
                />
                {activateError && <p className="text-red-400 text-xs mb-3">{activateError}</p>}
                <div className="flex gap-2">
                  <button onClick={closeActivate} className="flex-1 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">Цуцлах</button>
                  <button onClick={submitActivate} disabled={activateLoading || activatePhone.length !== 8}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm disabled:opacity-50">
                    {activateLoading ? '...' : 'Код үүсгэх'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-1">✅ Код үүсгэлээ</h3>
                <p className="text-sm text-gray-400 mb-4">{activateResult.sokh_name}</p>
                <div className="bg-gray-800 border border-amber-700/50 rounded-xl p-4 text-center mb-3">
                  <p className="text-xs text-amber-400 mb-1">Идэвхжүүлэх код</p>
                  <p className="text-3xl font-bold tracking-[0.4em] text-amber-300">{activateResult.code}</p>
                </div>
                <p className="text-xs text-gray-500 mb-1">📱 {activateResult.contact_phone}</p>
                <p className="text-xs text-gray-500 mb-3">⏳ {new Date(activateResult.expires_at).toLocaleString('mn-MN')} хүртэл</p>
                <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 text-xs text-amber-200/80 mb-4">
                  ⚠️ Энэ кодыг зөвхөн нэг удаа харуулна. СӨХ-н даргад утсаар, SMS-ээр дамжуулна уу.
                  Хэрэглэгч <code className="bg-black/30 px-1 rounded">/activate</code> хуудсаар орж нууц үгээ тавина.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(activateResult.code); }}
                    className="flex-1 py-2 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
                    📋 Код хуулах
                  </button>
                  <button onClick={closeActivate} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">Хаах</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
