'use client';

import { useState, useEffect, useRef } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import Field from '@/app/components/Field';
import CreateDebtAgreementModal from '@/app/components/admin/CreateDebtAgreementModal';
import { fetchAppUsage, fmtDate, type AppUsageResident } from '@/app/components/admin/AppUsagePanel';

interface Resident {
  id: number;
  name: string;
  apartment: string;
  phone: string;
  debt: number;
  area_sqm: number;
  building: string;
  block: string;
  entrance: string;
  floor: string;
  sokh_id: number;
  resident_type: string | null;
  household_size: number | null;
  move_in_date: string | null;
  profile_completed_at: string | null;
  monthly_fee: number | null;
  pending_claim: boolean;
  unit_kind: string | null;
  bank_customer_code: string | null;
}

const emptyForm = { name: '', apartment: '', phone: '', debt: '0', area_sqm: '0', building: '', resident_type: '', monthly_fee: '', unit_kind: 'household', bank_customer_code: '' };

const TYPE_LABELS: Record<string, string> = { owner: 'Эзэмшигч', tenant: 'Түрээслэгч', family: 'Гэр бүл' };
const isPlaceholderName = (n: string) => /тоот\s*$/i.test(n || '') || /-р\s*байр/i.test(n || '');
const isComplete = (r: Resident) => !!r.resident_type && !isPlaceholderName(r.name);

export default function AdminResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<number | null>(null);
  const [orgFee, setOrgFee] = useState(0);                                  // СӨХ-ийн ерөнхий тариф
  const [platesByApt, setPlatesByApt] = useState<Record<string, string[]>>({}); // тоот → улсын дугаарууд
  const [agreementFor, setAgreementFor] = useState<number | null>(null);    // өрийн гэрээ байгуулах айл
  const [appById, setAppById] = useState<Record<number, AppUsageResident>>({}); // айл → апп-д нэвтэрсэн эсэх
  const [onlyNoApp, setOnlyNoApp] = useState(false);                        // зөвхөн апп-д ороогүй айлыг харуулах
  const [buildingFilter, setBuildingFilter] = useState('');                 // '' = бүх байр
  const [matchIdx, setMatchIdx] = useState(0);                              // олдсон айлуудын хэд дэх дээр зогсож байгаа
  const [showAgreement, setShowAgreement] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});   // тоот → мөрийн DOM (хайлтаар гүйлгэхэд)

  // Айлын сарын төлбөр: тусгай тариф байвал түүнийг, үгүй бол СӨХ-ийн ерөнхий дүнг
  const feeOf = (r: Resident) => Number(r.monthly_fee ?? orgFee) || 0;

  // Тоотын доор зөвхөн байрны нэрийг харуулна (талбай нь өөрийн баганатай)
  const locationOf = (r: Resident) => (r.building || '').trim();

  // ---- Хайлт ----------------------------------------------------------------
  // СӨХ бүрийн дугаарлалт өөр өөр (Бадрах: 7 байранд 0–144 тоот ДАВТАГДДАГ,
  // Өргөө-142: 801–1211 давхардалгүй). Тиймээс тогтсон загвар шаардахгүй:
  // хайлтын мөрийг үг/тоо болгон хуваагаад, ХЭСЭГ БҮР нь аль нэг талбарт
  // таарсан айлыг олдсонд тооцно. Ингэснээр «88-14», «88 14», «14 88» бүгд ажиллана.
  const tokenize = (s: string) => s.toLowerCase().split(/[\s\-–—/,.]+/).filter(Boolean);
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

  // strict = цэвэр тоог ЯГ таарахаар нь шалгана («14» гэхэд 114, 140–144 гарахгүй).
  const hitsToken = (r: Resident, t: string, strict: boolean) => {
    const apt = norm(r.apartment);
    const bld = norm(r.building);
    if (strict && /^\d+$/.test(t)) {
      return apt === t || bld === t || (t.length >= 3 && norm(r.phone).includes(t));
    }
    return apt.includes(t) || bld.includes(t) || norm(r.name).includes(t) ||
      norm(r.phone).includes(t) || norm(r.block).includes(t) ||
      norm(r.entrance).includes(t) || norm(r.floor).includes(t);
  };

  const findMatches = (list: Resident[], q: string) => {
    const tokens = tokenize(q);
    if (!tokens.length) return [];
    const strict = list.filter(r => tokens.every(t => hitsToken(r, t, true)));
    // Яг таарах нь олдоогүй бол сул шалгуураар дахин хайна (дутуу бичсэн байж болно)
    return strict.length ? strict : list.filter(r => tokens.every(t => hitsToken(r, t, false)));
  };

  // Апп: тухайн айл нэвтэрч үзсэн эсэх (auth-ийн өгөгдөл тул тусдаа API-аас)
  const appOf = (r: Resident) => appById[r.id] || null;
  const signedIn = (r: Resident) => !!appOf(r)?.last_sign_in_at;

  // Аж ахуйн нэгж үү, айл өрх үү (unit_kind багана хоосон бол айл гэж үзнэ)
  const isBusiness = (r: Resident) => r.unit_kind === 'business';

  // Оршин суугчийн нууц үгийг түр нууц үг (= утасны дугаар) болгож сэргээнэ
  const resetPassword = async (r: Resident) => {
    if (!r.phone) {
      alert('Энэ оршин суугчид утасны дугаар бүртгэгдээгүй байна. Эхлээд "Засах"-аас дугаарыг нь оруулна уу.');
      return;
    }
    if (!confirm(`${r.apartment} тоот (${r.phone}) — нууц үгийг нь утасны дугаар болгож сэргээх үү?`)) return;

    setResetting(r.id);
    try {
      const res = await fetch('/api/admin/residents/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId: r.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Сэргээж чадсангүй');
      } else {
        alert(
          `Сэргээлээ.\n\n${r.apartment} тоот\nНэвтрэх нэр: ${data.phone}\nТүр нууц үг: ${data.tempPassword}\n\n` +
          'Оршин суугчид дамжуулаад, нэвтэрсний дараа "Миний мэдээлэл" хэсгээс нууц үгээ солихыг сануулна уу.'
        );
      }
    } catch {
      alert('Сервертэй холбогдож чадсангүй');
    }
    setResetting(null);
  };

  useEffect(() => { fetchResidents(); }, []);

  // Апп-д нэвтэрсэн эсэх нь Supabase-ийн auth хүснэгтээс уншигддаг тул жагсаалтаас
  // удаан ирдэг. Тусад нь ачаалж, хүснэгтийг хүлээлгэхгүй.
  useEffect(() => {
    fetchAppUsage().then(usage => {
      const map: Record<number, AppUsageResident> = {};
      for (const u of usage?.residents || []) map[u.id] = u;
      setAppById(map);
    });
  }, []);

  const fetchResidents = async () => {
    const sokhId = await getAdminSokhId();
    // adminFrom proxy (service_role + tenant-scope) ашиглана — admin нь Supabase auth биш тул
    // anon client RLS-д бүх мөр блоклогддог. Бичих үйлдэлтэй ижил замаар уншина.
    const [{ data }, { data: org }, { data: cars }] = await Promise.all([
      adminFrom('residents').select('*').eq('sokh_id', sokhId),
      adminFrom('sokh_organizations').select('monthly_fee').eq('id', sokhId).single(),
      adminFrom('parking_vehicles').select('plate_number, apartment, status').eq('sokh_id', sokhId),
    ]);
    const cmp = (a?: string, b?: string) => (a || '').localeCompare(b || '', undefined, { numeric: true });
    const raw = ((data as unknown as Resident[]) || []).slice();

    // Олон байртай СӨХ-д тоот байр бүрт дахин эхэлдэг (Бадрах: 6 байранд 0–144).
    // Ийм үед байраар нь бүлэглэж эрэмбэлэхгүй бол жагсаалт 0,0,0,0,1,1,1… гэж
    // сүлжилдээд айлаа олохын аргагүй болдог. Харин байраа цөөхөн айлдаа бөглөсөн
    // СӨХ-д байраар эрэмбэлбэл тэр цөөхөн нь хамгийн ард үсэрдэг тул тоотоор нь
    // хэвээр үлдээнэ.
    const filled = raw.filter(r => (r.building || '').trim()).length;
    const distinct = new Set(raw.map(r => (r.building || '').trim()).filter(Boolean)).size;
    const groupByBuilding = distinct >= 2 && filled >= raw.length * 0.9;

    const rows = raw.sort((a, b) =>
      (groupByBuilding ? cmp(a.building, b.building) : 0) ||
      cmp(a.apartment, b.apartment) || a.id - b.id
    );

    // Машины бүртгэлийг тоотоор нь бүлэглэнэ (хассан машиныг оруулахгүй)
    const plates: Record<string, string[]> = {};
    for (const c of (cars as unknown as { plate_number: string; apartment: string; status: string }[]) || []) {
      if (!c.apartment || c.status === 'removed') continue;
      const key = String(c.apartment).trim();
      (plates[key] = plates[key] || []).push(c.plate_number);
    }

    setOrgFee(Number((org as unknown as { monthly_fee?: number } | null)?.monthly_fee) || 0);
    setPlatesByApt(plates);
    setResidents(rows);
    setLoading(false);
  };

  // Жагсаалтаас мөр ХАСАХ нь зөвхөн эдгээр сонголт. Хайлт нь мөр нуудаггүй —
  // олдсон айлыг тодруулж, түүн дээр нь аваачдаг (дарга хөршүүдийг нь хамт хардаг).
  const visible = residents.filter(r => {
    if (onlyNoApp && signedIn(r)) return false;
    if (buildingFilter && (r.building || '').trim() !== buildingFilter) return false;
    return true;
    // Баталгаажуулах хүлээж буй мөрийг дээр гаргана — дарга анзаарахгүй өнгөрөх ёсгүй
  }).sort((a, b) => Number(b.pending_claim) - Number(a.pending_claim));

  // Байрны шүүлтүүр — зөвхөн олон байртай СӨХ-д харагдана
  const buildings = [...new Set(residents.map(r => (r.building || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const countIn = (b: string) => residents.filter(r => (r.building || '').trim() === b).length;

  const matches = findMatches(visible, search);
  const matchIds = new Set(matches.map(m => m.id));
  const safeIdx = matches.length ? Math.min(matchIdx, matches.length - 1) : 0;
  const currentId = matches[safeIdx]?.id ?? null;
  const stepMatch = (d: number) => {
    if (matches.length) setMatchIdx((safeIdx + d + matches.length) % matches.length);
  };

  // Олдсон айлыг дэлгэцийн голд аваачна — 437 айлтай СӨХ-д дээш доош гүйлгэхгүй.
  // (Хуучин мөрийн дараалал тогтвортой тул зөвхөн id-аас хамаарна.)
  useEffect(() => {
    if (currentId == null) return;
    rowRefs.current[currentId]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentId]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (r: Resident) => {
    setEditId(r.id);
    setForm({
      name: r.name, apartment: r.apartment, phone: r.phone || '',
      debt: String(r.debt), area_sqm: String(r.area_sqm || 0),
      building: r.building || '',
      resident_type: r.resident_type || '',
      monthly_fee: r.monthly_fee == null ? '' : String(r.monthly_fee),
      unit_kind: r.unit_kind === 'business' ? 'business' : 'household',
      bank_customer_code: r.bank_customer_code || '',
    });
    setShowForm(true);
  };

  const saveResident = async () => {
    if (!form.name || !form.apartment) return;
    setSaving(true);

    const payload = {
      name: form.name,
      apartment: form.apartment,
      phone: form.phone || null,
      debt: Number(form.debt) || 0,
      area_sqm: Number(form.area_sqm) || 0,
      building: form.building || null,
      resident_type: form.resident_type || null,
      unit_kind: form.unit_kind === 'business' ? 'business' : 'household',
      // Банкны и-биллингийн код — хоосон бол тоотыг нь ашиглана
      bank_customer_code: form.bank_customer_code.trim() || form.apartment,
      // Хоосон орхивол null — тэгвэл СӨХ-ийн ерөнхий тариф үйлчилнэ
      monthly_fee: form.monthly_fee === '' ? null : Number(form.monthly_fee) || 0,
    };

    // Утас солигдвол нэвтрэх бүртгэл нь ХУУЧИН дугаартаа үлдэнэ. "Нууц үг
    // сэргээх" дарж байж шинэ дугаар руу шилждэг тул даргад заавал сануулна.
    const prev = editId ? residents.find(r => r.id === editId) : null;
    const phoneChanged = !!prev && !!payload.phone && payload.phone !== (prev.phone || '');

    const { error } = editId
      ? await adminFrom('residents').update(payload).eq('id', editId)
      : await adminFrom('residents').insert([payload]);

    setSaving(false);
    if (error) {
      alert(`Хадгалж чадсангүй: ${error}`);
      return;
    }

    setShowForm(false);
    await fetchResidents();

    if (phoneChanged) {
      alert(
        `${payload.apartment} тоотын утас солигдлоо.\n\n` +
        `⚠️ Одоо тэр айлын мөрөн дээрх "Нууц үг сэргээх" товчийг ЗААВАЛ дарна уу.\n\n` +
        `Түүнийг дарж байж нэвтрэх эрх нь шинэ дугаар руу шилжинэ. Эс бөгөөс\n` +
        `тэр айл шинэ ч, хуучин ч дугаараараа нэвтэрч чадахгүй болно.`
      );
    }
  };

  // Өөрөө бүртгүүлсэн айлыг дарга баталгаажуулна — үүний дараа тоо/дүнд орно
  const approveResident = async (r: Resident) => {
    if (!confirm(
      `${r.apartment} тоот — ${r.name} (${r.phone || 'утасгүй'})\n\n` +
      `Энэ хүн өөрөө бүртгүүлсэн байна. Үнэхээр танай СӨХ-ийн оршин суугч мөн бол\n` +
      `баталгаажуулна уу. Баталгаажуулсны дараа айлын тоо, нийт дүнд орно.\n\n` +
      `Баталгаажуулах уу?`
    )) return;
    await adminFrom('residents').update({ pending_claim: false }).eq('id', r.id);
    await fetchResidents();
  };

  const deleteResident = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('residents').delete().eq('id', id);
    await fetchResidents();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    // CSV: name,apartment,phone,building,block,entrance,floor,area_sqm,debt,monthly_fee,unit_kind
    // (Экспортын "plates" багана нь зөвхөн харах зориулалттай — машины бүртгэлийг
    //  Зогсоол цэснээс удирдана, эндээс импортлохгүй.)
    // Тоотоор нь тулгана: байгаа тоот бол ШИНЭЧИЛНЭ, байхгүй бол НЭМНЭ.
    // (Өмнө нь бүх мөрийг insert хийдэг байсан тул засварласан жагсаалт
    //  оруулахад бүх айл давхардаж ордог байв.)
    const parsed = lines.slice(1).map(line => {
      const cols = line.split(',').map(s => s.trim().replace(/"/g, ''));
      return {
        name: cols[0] || '', apartment: cols[1] || '', phone: cols[2] || '',
        building: cols[3] || '', block: cols[4] || '', entrance: cols[5] || '',
        floor: cols[6] || '', area_sqm: cols[7] || '', debt: cols[8] || '',
        monthly_fee: cols[9] || '', unit_kind: cols[10] || '',
      };
    }).filter(r => r.name && r.apartment);

    if (parsed.length === 0) {
      alert('CSV формат: name,apartment,phone,building,block,entrance,floor,area_sqm,debt,monthly_fee,unit_kind');
      return;
    }

    const byApartment = new Map(residents.map(r => [String(r.apartment).trim(), r]));
    const toUpdate = parsed.filter(r => byApartment.has(r.apartment));
    const toInsert = parsed.filter(r => !byApartment.has(r.apartment));

    const proceed = confirm(
      `${parsed.length} мөр уншлаа:\n\n` +
      `• Байгаа ${toUpdate.length} тоот ШИНЭЧЛЭГДЭНЭ\n` +
      `• Шинэ ${toInsert.length} тоот НЭМЭГДЭНЭ\n\n` +
      `Хоосон үлдээсэн нүд байвал тэр талбар хэвээрээ үлдэнэ.\n\n` +
      `Үргэлжлүүлэх үү?`
    );
    if (!proceed) { if (fileRef.current) fileRef.current.value = ''; return; }

    // Зөвхөн бөглөсөн нүдийг бичнэ — хоосон нүд байгаа өгөгдлийг арилгахгүй.
    const patchOf = (r: typeof parsed[number]) => {
      const p: Record<string, unknown> = {};
      if (r.name) p.name = r.name;
      if (r.phone) p.phone = r.phone;
      if (r.building) p.building = r.building;
      if (r.block) p.block = r.block;
      if (r.entrance) p.entrance = r.entrance;
      if (r.floor) p.floor = r.floor;
      if (r.area_sqm !== '') p.area_sqm = Number(r.area_sqm) || 0;
      if (r.debt !== '') p.debt = Number(r.debt) || 0;
      if (r.monthly_fee !== '') p.monthly_fee = Number(r.monthly_fee) || 0;
      // "ААН", "аж ахуйн нэгж", "business" → аж ахуйн нэгж; бусад бөглөсөн утга → айл
      if (r.unit_kind !== '') {
        p.unit_kind = /аан|аж ахуй|business/i.test(r.unit_kind) ? 'business' : 'household';
      }
      return p;
    };

    let updated = 0, inserted = 0, failed = 0;
    const phoneChanged: string[] = [];

    for (const r of toUpdate) {
      const row = byApartment.get(r.apartment);
      if (!row) continue;
      if (r.phone && r.phone !== (row.phone || '')) phoneChanged.push(r.apartment);
      const { error } = await adminFrom('residents').update(patchOf(r)).eq('id', row.id);
      if (error) failed++; else updated++;
    }

    if (toInsert.length) {
      const { error } = await adminFrom('residents').insert(
        toInsert.map(r => ({ apartment: r.apartment, ...patchOf(r) }))
      );
      if (error) failed += toInsert.length; else inserted = toInsert.length;
    }

    const needsReset = [...phoneChanged, ...toInsert.map(r => r.apartment)];
    alert(
      `Дууслаа.\n\n` +
      `Шинэчилсэн : ${updated}\n` +
      `Нэмсэн     : ${inserted}\n` +
      (failed ? `Алдаа      : ${failed}\n` : '') +
      (needsReset.length
        ? `\n⚠️ Утас нь солигдсон/шинэ ${needsReset.length} айл дээр "Нууц үг сэргээх" дарж өгнө үү,\n` +
          `эс бөгөөс тэд нэвтэрч чадахгүй:\n${needsReset.join(', ')}`
        : '')
    );
    await fetchResidents();
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportCSV = () => {
    const header = 'name,apartment,phone,building,block,entrance,floor,area_sqm,debt,monthly_fee,unit_kind,plates\n';
    const rows = residents.map(r =>
      `"${r.name}","${r.apartment}","${r.phone || ''}","${r.building || ''}","${r.block || ''}","${r.entrance || ''}","${r.floor || ''}",${r.area_sqm || 0},${r.debt},${r.monthly_fee ?? ''},"${isBusiness(r) ? 'ААН' : 'айл'}","${(platesByApt[String(r.apartment).trim()] || []).join(' ')}"`
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'residents.csv'; a.click();
  };

  // Баталгаажаагүй мөрийг тоо/дүнд оруулахгүй — эс бөгөөс хэн ч бүртгүүлээд
  // даргын тайланг гажуудуулж чадна.
  const confirmed = residents.filter(r => !r.pending_claim);
  const pendingCount = residents.length - confirmed.length;
  const businessCount = confirmed.filter(isBusiness).length;
  const totalDebt = visible.filter(r => !r.pending_claim).reduce((s, r) => s + r.debt, 0);
  const totalFee = visible.filter(r => !r.pending_claim).reduce((s, r) => s + feeOf(r), 0);
  const completedCount = confirmed.filter(isComplete).length;
  const completedPct = confirmed.length ? Math.round((completedCount / confirmed.length) * 100) : 0;
  // Апп татаж нэвтэрсэн айл (бүх мөрөөр — өөрөө бүртгүүлсэн нь ч аппаараа орсон)
  const appCount = residents.filter(signedIn).length;
  const appPct = residents.length ? Math.round((appCount / residents.length) * 100) : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">👥 Оршин суугчид</h1>
          <p className="text-sm text-gray-500">
            {confirmed.length - businessCount} айл
            {businessCount > 0 && <> &middot; {businessCount} аж ахуйн нэгж</>}
            &middot; Өмнөх үлдэгдэл: {totalDebt.toLocaleString()}₮
            &middot; Сарын төлбөр: {totalFee.toLocaleString()}₮
            &middot; Нийт: <b>{(totalDebt + totalFee).toLocaleString()}₮</b>
            &middot; <span className={completedPct >= 80 ? 'text-green-600' : completedPct >= 40 ? 'text-amber-600' : 'text-red-500'}>
              Бүрдэлт: {completedCount}/{confirmed.length} ({completedPct}%)
            </span>
            &middot; <span className={appPct >= 60 ? 'text-green-600' : appPct >= 25 ? 'text-amber-600' : 'text-gray-500'}>
              📱 Апп: {appCount}/{residents.length} ({appPct}%)
            </span>
            {pendingCount > 0 && (
              <> &middot; <span className="text-orange-600 font-semibold">
                ⏳ {pendingCount} хүн баталгаажуулахыг хүлээж байна
              </span></>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">📥 Экспорт</button>
          <label className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm cursor-pointer hover:bg-green-200">
            📤 Импорт
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
          </label>
          <button
            onClick={() => { setAgreementFor(null); setShowAgreement(true); }}
            className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm hover:bg-amber-200"
          >
            🤝 Гэрээ байгуулах
          </button>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ Нэмэх</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-1.5 focus-within:border-blue-400">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            placeholder={buildings.length >= 2
              ? `Нэр, утас, эсвэл «${buildings[0]}-101» гэж байр-тоотоор хайх...`
              : 'Нэр, тоот, утас, байраар хайх...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setMatchIdx(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); } }}
            className="flex-1 py-0.5 text-sm outline-none"
          />
          {/* Хайлт мөр нууxгүй — олдсоныг нь тодруулж, дээр нь аваачна */}
          {search.trim() && (matches.length ? (
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-xs text-gray-500">{safeIdx + 1} / {matches.length}</span>
              <button type="button" onClick={() => stepMatch(-1)} title="Өмнөх (Shift+Enter)"
                      className="px-1.5 text-gray-500 hover:text-gray-800">‹</button>
              <button type="button" onClick={() => stepMatch(1)} title="Дараах (Enter)"
                      className="px-1.5 text-gray-500 hover:text-gray-800">›</button>
              <button type="button" onClick={() => { setSearch(''); setMatchIdx(0); }} title="Цэвэрлэх"
                      className="px-1 text-gray-400 hover:text-gray-700">✕</button>
            </div>
          ) : (
            <span className="text-xs text-red-500 whitespace-nowrap">олдсонгүй</span>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
          <input type="checkbox" checked={onlyNoApp}
                 onChange={e => { setOnlyNoApp(e.target.checked); setMatchIdx(0); }} />
          Зөвхөн апп татаагүй айл
        </label>
      </div>

      {/* Байрны шүүлтүүр — зөвхөн олон байртай СӨХ-д. Тоот байр бүрт давтагддаг
          тул эхлээд байраа сонгоод дараа нь тоотоо хайх нь хамгийн хурдан. */}
      {buildings.length >= 2 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-gray-400 mr-1">Байр:</span>
          <button
            onClick={() => { setBuildingFilter(''); setMatchIdx(0); }}
            className={`px-2.5 py-1 rounded-full text-xs border ${
              buildingFilter === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Бүгд ({residents.length})
          </button>
          {buildings.map(b => (
            <button
              key={b}
              onClick={() => { setBuildingFilter(buildingFilter === b ? '' : b); setMatchIdx(0); }}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                buildingFilter === b ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {b} ({countIn(b)})
            </button>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">{editId ? 'Засах' : 'Шинэ оршин суугч'}</h3>
          {/* Нүд бүрийн дээр нэр нь бичээстэй байна — бөглөсний дараа ч ямар
              талбар болох нь харагдана (placeholder бол бөглөхөд алга болдог) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Нэр" required>
              <input placeholder="Овог нэр" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Тоот" required>
              <input placeholder="жнь: 101" value={form.apartment} onChange={e => setForm({...form, apartment: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Утас">
              <input placeholder="99001122" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Байр">
              <input placeholder="жнь: 1-р байр" value={form.building} onChange={e => setForm({...form, building: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Хэлбэр">
              <select value={form.unit_kind} onChange={e => setForm({...form, unit_kind: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="household">🏠 Айл өрх</option>
                <option value="business">🏢 Аж ахуйн нэгж</option>
              </select>
            </Field>
            <Field label="Талбай (мкв)">
              <input placeholder="жнь: 42.5" type="number" step="0.1" value={form.area_sqm} onChange={e => setForm({...form, area_sqm: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Өмнөх үлдэгдэл (₮)" hint="Энэ айлын өмнөх саруудаас үлдсэн өр">
              <input placeholder="0" type="number" value={form.debt} onChange={e => setForm({...form, debt: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field
              label="Сарын төлбөр (₮)"
              hint={orgFee
                ? `Хоосон орхивол СӨХ-ийн ерөнхий тариф (${orgFee.toLocaleString()}₮) үйлчилнэ`
                : 'Зөвхөн энэ тоотод тусгай тариф тогтоох бол бөглөнө'}
            >
              <input
                placeholder={orgFee ? `Хоосон = ${orgFee.toLocaleString()}₮` : 'Тусгай тариф'}
                type="number"
                value={form.monthly_fee}
                onChange={e => setForm({...form, monthly_fee: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Банкны код" hint="И-биллингийн хэрэглэгчийн код. Хоосон бол тоотыг ашиглана.">
              <input placeholder={form.apartment || 'тоот'} value={form.bank_customer_code} onChange={e => setForm({...form, bank_customer_code: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Эзэмшил">
              <select value={form.resident_type} onChange={e => setForm({...form, resident_type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm text-gray-600">
                <option value="">Сонгоогүй</option>
                <option value="owner">Эзэмшигч</option>
                <option value="tenant">Түрээслэгч</option>
                <option value="family">Гэр бүлийн гишүүн</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={saveResident} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Ачаалж байна...</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-3">№</th>
                  <th className="px-3 py-3">Нэр</th>
                  <th className="px-3 py-3">Тоот</th>
                  <th className="px-3 py-3 text-right">Талбай (мкв)</th>
                  <th className="px-3 py-3">Хэлбэр</th>
                  <th className="px-3 py-3">Эзэмшлийн төрөл</th>
                  <th className="px-3 py-3">Утас</th>
                  <th className="px-3 py-3">Апп</th>
                  <th className="px-3 py-3">Машины бүртгэл</th>
                  <th className="px-3 py-3 text-right">Өмнөх үлдэгдэл</th>
                  <th className="px-3 py-3 text-right">Сарын төлбөр</th>
                  <th className="px-3 py-3 text-right">Нийт дүн</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr
                    key={r.id}
                    ref={el => { rowRefs.current[r.id] = el; }}
                    className={`border-t text-sm ${
                      currentId === r.id ? 'bg-amber-200 font-semibold'
                      : matchIds.has(r.id) ? 'bg-amber-50'
                      : r.pending_claim ? 'bg-orange-50 hover:bg-orange-100'
                      : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {r.name}
                      {r.pending_claim && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-200 text-orange-800 align-middle">өөрөө бүртгүүлсэн</span>}
                      {!r.pending_claim && !isComplete(r) && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">дутуу</span>}
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {r.apartment}
                      {/* Байрны нэрийг тоотын доор жижгээр — багана нэмэхгүйгээр мэдээллийг хадгална */}
                      {locationOf(r) && <div className="text-[10px] text-gray-400 font-normal">{locationOf(r)}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {r.area_sqm > 0 ? r.area_sqm : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${isBusiness(r) ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {isBusiness(r) ? '🏢 Аж ахуйн нэгж' : '🏠 Айл'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {r.resident_type ? TYPE_LABELS[r.resident_type] || r.resident_type : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">{r.phone || '-'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {signedIn(r) ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700"
                              title={`Сүүлд нэвтэрсэн: ${fmtDate(appOf(r)!.last_sign_in_at)}`}>
                          ✅ Нэвтэрсэн
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                              title={(r.phone || '').trim()
                                ? 'Энэ айл аппаар хараахан нэвтрээгүй байна'
                                : 'Утасны дугаар бүртгэгдээгүй тул нэвтэрч чадахгүй'}>
                          {(r.phone || '').trim() ? '⬜ Ороогүй' : '⚠️ Утасгүй'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {(platesByApt[String(r.apartment).trim()] || []).length
                        ? platesByApt[String(r.apartment).trim()].join(', ')
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${r.debt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '0₮'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {feeOf(r) ? `${feeOf(r).toLocaleString()}₮` : <span className="text-gray-300">-</span>}
                      {r.monthly_fee == null && orgFee > 0 && <div className="text-[10px] text-gray-300">ерөнхий</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-800">
                      {(r.debt + feeOf(r)).toLocaleString()}₮
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.pending_claim && (
                        <button onClick={() => approveResident(r)} className="text-white bg-green-600 text-xs mr-2 px-2 py-1 rounded hover:bg-green-700">
                          ✓ Баталгаажуулах
                        </button>
                      )}
                      {r.debt > 0 && (
                        <button
                          onClick={() => { setAgreementFor(r.id); setShowAgreement(true); }}
                          title="Өрөө хуваан төлөх гэрээ байгуулах"
                          className="text-amber-600 text-xs mr-2 hover:underline"
                        >
                          Гэрээ
                        </button>
                      )}
                      <button onClick={() => openEdit(r)} className="text-blue-500 text-xs mr-2 hover:underline">Засах</button>
                      <button
                        onClick={() => resetPassword(r)}
                        disabled={resetting === r.id}
                        title="Нууц үгийг утасны дугаар болгож сэргээх"
                        className="text-amber-600 text-xs mr-2 hover:underline disabled:text-gray-300"
                      >
                        {resetting === r.id ? 'Сэргээж байна...' : 'Нууц үг сэргээх'}
                      </button>
                      <button onClick={() => deleteResident(r.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && (
            <p className="text-gray-400 text-center py-6">Өгөгдөл байхгүй</p>
          )}
        </div>
      )}

      {/* Өр төлөх гэрээ байгуулах цонх */}
      {showAgreement && (
        <CreateDebtAgreementModal
          residents={residents.map(r => ({ id: r.id, name: r.name, apartment: r.apartment, debt: r.debt }))}
          initialResidentId={agreementFor}
          onClose={() => setShowAgreement(false)}
          onCreated={fetchResidents}
        />
      )}
    </div>
  );
}
