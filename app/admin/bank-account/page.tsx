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
}

const BANKS = [
  'Хаан банк', 'Голомт банк', 'ХХБ', 'Төрийн банк', 'Хас банк',
  'Капитрон банк', 'Богд банк', 'Чингис хаан банк', 'М банк', 'Ард банк',
];

const emptyForm = {
  bank_name: BANKS[0],
  account_number: '',
  account_holder: '',
  qr_image_url: '',
  note: '',
  is_active: true,
};

export default function AdminBankAccount() {
  const [account, setAccount] = useState<BankAccount | null>(null);
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
    const { data } = await adminFrom('sokh_bank_accounts').select('*').eq('sokh_id', id).single();
    const row = data as unknown as BankAccount | null;
    if (row) {
      setAccount(row);
      setForm({
        bank_name: row.bank_name || BANKS[0],
        account_number: row.account_number || '',
        account_holder: row.account_holder || '',
        qr_image_url: row.qr_image_url || '',
        note: row.note || '',
        is_active: row.is_active !== false,
      });
    }
    setLoading(false);
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

    const { error: dbErr } = account
      ? await adminFrom('sokh_bank_accounts').update(payload).eq('id', account.id)
      : await adminFrom('sokh_bank_accounts').insert([{ sokh_id: sokhId, ...payload }]);

    setSaving(false);
    if (dbErr) {
      setError(`Хадгалж чадсангүй: ${dbErr}`);
      return;
    }
    setMessage('Хадгаллаа. Оршин суугчид "Төлбөр" хэсгээсээ шууд харна.');
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

      <div className="bg-white border rounded-xl p-5 space-y-4">
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
        </div>
      </div>

      {/* Оршин суугчид яг ингэж харагдана */}
      {form.account_number && (
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
