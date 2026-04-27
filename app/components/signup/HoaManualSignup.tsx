'use client';

import { useState } from 'react';

interface HoaManualSignupProps {
  defaultCity?: string;
  defaultDistrict?: string;
  defaultKhoroo?: string;
  defaultName?: string;
  onCancel?: () => void;
  onSuccess?: (info: { provisionalId: number }) => void;
}

// Хэрэглэгч master directory-д өөрийн СӨХ-ийг олоогүй үед
// "гар оролтоор үргэлжлүүлэх" замыг олгох form.
// Тус хэрэгсэл нь:
//  - hoa_provisional үүсгэнэ (эсвэл нөхөнө)
//  - hoa_activation_requests дотор "Khotol-ийг идэвхжүүлэх" дохио бүртгэнэ
//  - hoa_activation_summaries-д тухайн СӨХ-ийн эрэлтийн тоог нэмнэ
export default function HoaManualSignup({
  defaultCity = '',
  defaultDistrict = '',
  defaultKhoroo = '',
  defaultName = '',
  onCancel,
  onSuccess,
}: HoaManualSignupProps) {
  const [city, setCity] = useState(defaultCity);
  const [district, setDistrict] = useState(defaultDistrict);
  const [khoroo, setKhoroo] = useState(defaultKhoroo);
  const [sohName, setSohName] = useState(defaultName);
  const [townName, setTownName] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ message: string; provisionalId: number } | null>(null);

  const submit = async () => {
    setError('');
    if (!sohName.trim() || sohName.trim().length < 2) {
      setError('СӨХ-ийн нэрээ оруулна уу');
      return;
    }
    if (!building.trim() && !unitNumber.trim()) {
      setError('Байр эсвэл тоотоо оруулна уу');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signup/manual-hoa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sohName: sohName.trim(),
          city: city.trim() || undefined,
          district: district.trim() || undefined,
          khoroo: khoroo.trim() || undefined,
          townName: townName.trim() || undefined,
          building: building.trim() || undefined,
          unitNumber: unitNumber.trim() || undefined,
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
      setSuccess({ message: data.message, provisionalId: data.provisionalId });
      onSuccess?.({ provisionalId: data.provisionalId });
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <p className="font-semibold text-green-800 mb-1">Бүртгэл хадгалагдлаа</p>
            <p className="text-sm text-green-800 leading-relaxed whitespace-pre-line">
              {success.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        💡 Хэрэв та өөрийн СӨХ-ийг үндсэн жагсаалтаас олоогүй бол доор гараар оруулна уу.
        Таны бүртгэл албан ёсны "Khotol-ийг идэвхжүүлэх" хүсэлт болж тоологдоно.
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">СӨХ-ийн нэр *</label>
        <input
          value={sohName}
          onChange={(e) => setSohName(e.target.value)}
          placeholder="Жишээ: Од СӨХ"
          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Хот</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Дүүрэг</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Хороо</label>
          <input value={khoroo} onChange={(e) => setKhoroo(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm bg-white" />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Хороолол / town</label>
        <input
          value={townName}
          onChange={(e) => setTownName(e.target.value)}
          placeholder="Жишээ: Цайз town"
          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Байр *</label>
          <input
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            placeholder="Жишээ: 12-р байр"
            className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Тоот</label>
          <input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="Жишээ: 304"
            className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
          />
        </div>
      </div>

      <div className="border-t pt-3 mt-2">
        <p className="text-xs text-gray-500 mb-2">Холбогдох мэдээлэл (заавал биш)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Таны нэр"
            className="border rounded-xl px-3 py-2 text-sm bg-white"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Утас"
            className="border rounded-xl px-3 py-2 text-sm bg-white"
          />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Нэмэлт тайлбар"
          className="w-full border rounded-xl px-3 py-2 text-sm bg-white mt-2"
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
          {loading ? 'Илгээж байна...' : 'Гараар үргэлжлүүлэх →'}
        </button>
      </div>
    </div>
  );
}
