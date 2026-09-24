'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import { supabase } from '@/app/lib/supabase';
import Field from '@/app/components/Field';

interface BankAccount {
  id: number;
  sokh_id: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  qr_image_url: string | null;
  note: string | null;
  is_active: boolean;
  sort_order: number | null;
}

const BANKS = [
  'Хаан банк', 'Голомт банк', 'ХХБ', 'Төрийн банк', 'Хас банк',
  'Капитрон банк', 'Богд банк', 'Чингис хаан банк', 'М банк', 'Ард банк',
];

// Оршин суугчид харагдах дараалал. sort_order байхгүй (миграц ажиллаагүй) бол id-гаар.
const sortAccounts = (rows: BankAccount[]) =>
  rows.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id);

const emptyForm = {
  bank_name: BANKS[0],
  account_number: '',
  account_holder: '',
  qr_image_url: '',
  note: '',
  is_active: true,
};

export default function AdminBankAccount() {
  // СӨХ хэдэн ч данстай байж болно (жнь. Хаан + Төрийн) — оршин суугч
  // өөрийн банкны дотор шилжүүлбэл шимтгэлгүй.
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editing, setEditing] = useState<BankAccount | null>(null);  // null + showForm = шинэ данс
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sokhId, setSokhId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const id = await getAdminSokhId();
    setSokhId(id);
    // ЖИЧ: sort_order-оор SQL талд эрэмбэлэхгүй — `supabase-sokh-bank-multi-migration.sql`
    // ажиллаагүй байхад тэр багана байхгүй тул бүх мөр алга болно. Клиент талд эрэмбэлнэ.
    const { data } = await adminFrom('sokh_bank_accounts').select('*').eq('sokh_id', id);
    setAccounts(sortAccounts((data as unknown as BankAccount[]) || []));
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const openEdit = (row: BankAccount) => {
    setEditing(row);
    setForm({
      bank_name: row.bank_name || BANKS[0],
      account_number: row.account_number || '',
      account_holder: row.account_holder || '',
      qr_image_url: row.qr_image_url || '',
      note: row.note || '',
      is_active: row.is_active !== false,
    });
    setShowForm(true);
    setMessage('');
    setError('');
  };

  const removeAccount = async (row: BankAccount) => {
    if (!confirm(`${row.bank_name} · ${row.account_number}

Энэ дансыг устгах уу? Оршин суугчид цаашид харагдахгүй болно.`)) return;
    const { error: e } = await adminFrom('sokh_bank_accounts').delete().eq('id', row.id);
    if (e) { setError(`Устгаж чадсангүй: ${e}`); return; }
    setMessage('Данс устгалаа.');
    if (editing?.id === row.id) setShowForm(false);
    await load();
  };

  // Дарааллыг солих — эхний данс нь оршин суугчид анхны байдлаар харагдана
  const move = async (row: BankAccount, dir: -1 | 1) => {
    const i = accounts.findIndex(a => a.id === row.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= accounts.length) return;
    const other = accounts[j];
    await adminFrom('sokh_bank_accounts').update({ sort_order: j }).eq('id', row.id);
    await adminFrom('sokh_bank_accounts').update({ sort_order: i }).eq('id', other.id);
    await load();
  };

  const uploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sokhId) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Зургийн хэмжээ 2MB-с бага байх ёстой');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('PNG, JPG эсвэл WebP зураг оруулна уу');
      return;
    }

    setError('');
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `sokh-${sokhId}/bank-qr-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (upErr) {
      setError(`Зураг хуулж чадсангүй: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
    setForm(f => ({ ...f, qr_image_url: publicUrl }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    setMessage('');
    setError('');

    if (!form.bank_name || !form.account_number.trim() || !form.account_holder.trim()) {
      setError('Банк, дансны дугаар, данс эзэмшигчийг бөглөнө үү');
      return;
    }

    setSaving(true);
    const payload = {
      bank_name: form.bank_name,
      account_number: form.account_number.trim(),
      account_holder: form.account_holder.trim(),
      qr_image_url: form.qr_image_url || null,
      note: form.note.trim() || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let dbErr;
    if (editing) {
      ({ error: dbErr } = await adminFrom('sokh_bank_accounts').update(payload).eq('id', editing.id));
    } else {
      const base = { sokh_id: sokhId, ...payload };
      ({ error: dbErr } = await adminFrom('sokh_bank_accounts')
        .insert([{ ...base, sort_order: accounts.length }]));
      // Миграц хараахан ажиллаагүй бол sort_order багана байхгүй — эрэмбэгүйгээр бичнэ
      if (dbErr && /sort_order/i.test(String(dbErr))) {
        ({ error: dbErr } = await adminFrom('sokh_bank_accounts').insert([base]));
      }
    }

    setSaving(false);
    if (dbErr) {
      const msg = String(dbErr);
      if (/sokh_id/i.test(msg) && /unique|duplicate/i.test(msg)) {
        // supabase-sokh-bank-multi-migration.sql ажиллаагүй байна
        setError('Олон данс хадгалах боломж хараахан идэвхжээгүй байна. Хотолын багтай холбогдоно уу.');
      } else if (/unique|duplicate/i.test(msg)) {
        setError('Энэ дансны дугаар аль хэдийн бүртгэгдсэн байна.');
      } else {
        setError(`Хадгалж чадсангүй: ${msg}`);
      }
      return;
    }
    setMessage(editing
      ? 'Хадгаллаа. Оршин суугчид "Төлбөр" хэсгээсээ шууд харна.'
      : 'Шинэ данс нэмлээ. Оршин суугч төлөхдөө банкаа сонгоно.');
    setShowForm(false);
    await load();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">🏦 Хураамж хүлээн авах данс</h1>
      <p className="text-sm text-gray-500 mb-6">
        Энд оруулсан данс болон QR нь оршин суугчийн апп дээр «Төлбөр» хэсэгт харагдана.
        Оршин суугч банкны аппаараа QR-ыг уншуулахад мөнгө нь <b>шууд танай СӨХ-ийн данс руу</b> очно —
        Хотол дундаа орохгүй, шимтгэл авахгүй.
      </p>

      {/* Бүртгэсэн данснууд. Олон банктай байж болно — оршин суугч өөрийн
          банкны дотор шилжүүлбэл шимтгэлгүй, шууд ордог. */}
      <div className="space-y-2 mb-4">
        {accounts.map((a, i) => (
          <div
            key={a.id}
            className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${a.is_active ? '' : 'opacity-60'}`}
          >
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-lg">🏦</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {a.bank_name}
                {i === 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 align-middle">үндсэн</span>}
                {!a.is_active && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 align-middle">нуусан</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{a.account_number} · {a.account_holder}</p>
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">{a.qr_image_url ? 'QR-тай ✓' : 'QR-гүй'}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => move(a, -1)} disabled={i === 0}
                      title="Дээш" className="px-1.5 text-gray-400 hover:text-gray-700 disabled:text-gray-200">↑</button>
              <button onClick={() => move(a, 1)} disabled={i === accounts.length - 1}
                      title="Доош" className="px-1.5 text-gray-400 hover:text-gray-700 disabled:text-gray-200">↓</button>
              <button onClick={() => openEdit(a)} className="text-xs text-blue-600 hover:underline px-1.5">Засах</button>
              <button onClick={() => removeAccount(a)} className="text-xs text-red-400 hover:underline px-1.5">Устгах</button>
            </div>
          </div>
        ))}
        {!accounts.length && !showForm && (
          <div className="bg-white border border-dashed rounded-xl p-6 text-center text-sm text-gray-400">
            Данс бүртгээгүй байна. Оршин суугчид «Төлөх» товч харагдахгүй.
          </div>
        )}
      </div>

      {!showForm && (
        <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + Данс нэмэх
        </button>
      )}

      {showForm && (
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">{editing ? 'Данс засах' : 'Шинэ данс'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Банк" required>
            <select
              value={form.bank_name}
              onChange={e => setForm({ ...form, bank_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {BANKS.map(b => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Дансны дугаар" required>
            <input
              value={form.account_number}
              onChange={e => setForm({ ...form, account_number: e.target.value })}
              placeholder="жнь: 5001234567"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Данс эзэмшигч" required hint="Банкинд бүртгэлтэй яг тэр нэр">
            <input
              value={form.account_holder}
              onChange={e => setForm({ ...form, account_holder: e.target.value })}
              placeholder="жнь: Хөгжил хаус СӨХ"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Нэмэлт заавар" hint="Оршин суугчид QR-ын доор харагдана. Хоосон орхиж болно.">
          <input
            value={form.note}
            onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="жнь: Гүйлгээний утгад тоотоо заавал бичнэ үү"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>

        {/* QR зураг */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Банкны QR зураг</p>
          <div className="flex items-start gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 cursor-pointer hover:border-blue-400 transition shrink-0"
            >
              {form.qr_image_url ? (
                <Image src={form.qr_image_url} alt="QR" width={128} height={128} className="w-full h-full object-contain" />
              ) : (
                <div className="text-center px-2">
                  <span className="text-2xl text-gray-300">+</span>
                  <p className="text-[10px] text-gray-400 leading-tight">QR зураг</p>
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadQr}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Хуулж байна...' : form.qr_image_url ? 'Солих' : 'QR оруулах'}
                </button>
                {form.qr_image_url && (
                  <button
                    onClick={() => setForm({ ...form, qr_image_url: '' })}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                  >
                    Хасах
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-3 space-y-1 leading-relaxed">
                <p className="font-medium text-gray-600">QR-аа хаанаас авах вэ?</p>
                <p>Банкны аппаа нээгээд «QR-аар мөнгө хүлээн авах» хэсгээс СӨХ-ийн дансны QR-ыг гаргаж,
                дэлгэцийн зураг аваад энд оруулна. PNG, JPG, WebP. Дээд тал нь 2MB.</p>
                <p className="text-amber-600">QR оруулаагүй ч болно — тэр тохиолдолд оршин суугчид
                дансны дугаар харагдаж, гараар шилжүүлнэ.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Идэвх */}
        <label className="flex items-center gap-2 pt-2 border-t">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">Оршин суугчдад харуулах</span>
          <span className="text-xs text-gray-400">(унтраавал «Төлөх» товч алга болно)</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
          <button
            onClick={() => { setShowForm(false); setError(''); }}
            className="px-4 py-2.5 border rounded-lg text-sm"
          >
            Цуцлах
          </button>
        </div>
      </div>
      )}

      {/* Оршин суугчид яг ингэж харагдана */}
      {showForm && form.account_number && (
        <div className="mt-6">
          <p className="text-xs text-gray-400 mb-2">ОРШИН СУУГЧИД ИНГЭЖ ХАРАГДАНА</p>
          <div className="bg-white border rounded-xl p-4 max-w-xs">
            <p className="text-xs text-gray-500">Төлөх дүн</p>
            <p className="text-2xl font-bold mb-3">85,000₮</p>
            {form.qr_image_url && (
              <Image src={form.qr_image_url} alt="QR" width={160} height={160} className="w-40 h-40 mx-auto mb-3 object-contain" />
            )}
            <div className="text-sm space-y-1">
              <p><span className="text-gray-400">Банк:</span> {form.bank_name}</p>
              <p><span className="text-gray-400">Данс:</span> <b>{form.account_number}</b></p>
              <p><span className="text-gray-400">Хүлээн авагч:</span> {form.account_holder}</p>
              <p><span className="text-gray-400">Гүйлгээний утга:</span> <b>101 тоот</b></p>
            </div>
            {form.note && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-3">{form.note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
