'use client';

import { useState } from 'react';

interface HoaRequestFormProps {
  defaultName?: string;
  defaultDistrict?: string;
  defaultKhoroo?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// "СӨХ олдсонгүй" хэлбэр — хэрэглэгчийн хүсэлтийг бүртгэхэд
export default function HoaRequestForm({
  defaultName = '',
  defaultDistrict = '',
  defaultKhoroo = '',
  onSuccess,
  onCancel,
}: HoaRequestFormProps) {
  const [requestedName, setRequestedName] = useState(defaultName);
  const [district, setDistrict] = useState(defaultDistrict);
  const [khoroo, setKhoroo] = useState(defaultKhoroo);
  const [address, setAddress] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError('');
    if (!requestedName.trim() || requestedName.trim().length < 2) {
      setError('СӨХ-ийн нэрээ оруулна уу');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/signup/request-hoa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedName: requestedName.trim(),
          district: district.trim() || undefined,
          khoroo: khoroo.trim() || undefined,
          address: address.trim() || undefined,
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Илгээж чадсангүй');
        setLoading(false);
        return;
      }
      setDone(true);
      onSuccess?.();
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-sm font-medium text-green-800">Хүсэлт илгээгдлээ</p>
        <p className="text-xs text-green-700 mt-1">Бид удахгүй танилцана.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">СӨХ-ийн нэр *</label>
        <input
          value={requestedName}
          onChange={(e) => setRequestedName(e.target.value)}
          placeholder="Жишээ: Од СӨХ"
          className="w-full border rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Дүүрэг</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Хороо</label>
          <input value={khoroo} onChange={(e) => setKhoroo(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Хаяг</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Таны нэр</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Утас</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="99001122"
            className="w-full border rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Тайлбар</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full border rounded-xl px-3 py-2 text-sm"
          placeholder="Нэмэлт мэдээлэл..."
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 py-2.5 border rounded-xl text-sm hover:bg-gray-50">
            Болих
          </button>
        )}
        <button
          onClick={submit}
          disabled={loading}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Илгээж байна...' : 'Хүсэлт илгээх'}
        </button>
      </div>
    </div>
  );
}
