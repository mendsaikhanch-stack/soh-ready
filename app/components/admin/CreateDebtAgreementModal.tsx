'use client';

// Өр барагдуулах гэрээ байгуулах цонх (дарга талд).
//
// Хадгалахдаа /api/admin/db proxy руу table: 'debt_agreements' гэж илгээнэ
// (adminFrom нь яг тэр fetch-ийг хийдэг). sokh_id-г proxy өөрөө сешнээс
// тавьдаг тул энд ХАРУУЛАХГҮЙ, ИЛГЭЭХГҮЙ.

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';

export interface AgreementResident {
  id: number;
  name: string;
  apartment: string;
  debt: number;
}

interface Props {
  /** Сонгох боломжтой оршин суугчид */
  residents: AgreementResident[];
  /** Хүснэгтийн мөрнөөс нээхэд урьдчилж сонгогдох айл */
  initialResidentId?: number | null;
  onClose: () => void;
  /** Амжилттай хадгалсны дараа — жагсаалтаа шинэчлэхэд */
  onCreated?: () => void;
}

/** Сарын тоогоор тэнцүү хуваана. Бөөрөнхийлөлтийн үлдэгдлийг СҮҮЛИЙН сард нэмнэ —
 *  эс бөгөөс хуваарийн нийлбэр нийт өртэй таарахгүй, айл дутуу төлчихөөд
 *  "би гэрээгээ биелүүлсэн" гэж маргах үндэс үүснэ. */
function buildInstallments(total: number, months: number, startDate: string) {
  if (!total || !months || months < 1) return [];
  const base = Math.floor(total / months);
  const rows = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    rows.push({
      no: i + 1,
      due_date: d.toISOString().slice(0, 10),
      amount: i === months - 1 ? total - base * (months - 1) : base,
    });
  }
  return rows;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function CreateDebtAgreementModal({
  residents,
  initialResidentId = null,
  onClose,
  onCreated,
}: Props) {
  const [residentId, setResidentId] = useState<string>(initialResidentId ? String(initialResidentId) : '');
  const [totalDebt, setTotalDebt] = useState('');
  const [months, setMonths] = useState('3');
  const [startDate, setStartDate] = useState(today());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = residents.find(r => r.id === Number(residentId)) || null;

  // Айл сонгоход түүний одоогийн өрийг санал болгоно (дарга гараар засаж болно)
  useEffect(() => {
    if (selected && totalDebt === '') setTotalDebt(String(selected.debt || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId]);

  const total = Number(totalDebt) || 0;
  const monthCount = Number(months) || 0;
  const installments = buildInstallments(total, monthCount, startDate);
  const monthly = installments.length ? installments[0].amount : 0;

  const save = async () => {
    setError('');
    if (!residentId) return setError('Айлаа сонгоно уу.');
    if (total <= 0) return setError('Нийт өр 0-ээс их байх ёстой.');
    if (monthCount < 1 || monthCount > 60) return setError('Хуваах сар 1-60 хооронд байна.');

    setSaving(true);
    const { error: err } = await adminFrom('debt_agreements').insert([{
      resident_id: Number(residentId),
      total_debt: total,
      status: 'pending',
      agreed_payment_plan: {
        months: monthCount,
        monthly_amount: monthly,
        start_date: startDate,
        installments,
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      // sokh_id болон created_by_admin_id-г proxy сешнээс өөрөө тавина —
      // эндээс илгээхгүй (илгээсэн ч proxy дарж бичнэ).
    }]);
    setSaving(false);

    if (err) {
      setError(
        err.includes('duplicate') || err.includes('uniq_debt_agreements')
          ? 'Энэ айлд хүчинтэй гэрээ аль хэдийн байна. Эхлээд хуучныг нь хаана уу.'
          : `Хадгалж чадсангүй: ${err}`
      );
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold">🤝 Өр төлөх гэрээ байгуулах</h2>
          <p className="text-xs text-gray-500 mt-1">
            Өрөө нэг дор төлж чадахгүй байгаа айлтай хуваан төлөх хуваарь тохирно.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Айл */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Айл <span className="text-red-500">*</span></label>
            <select
              value={residentId}
              onChange={e => { setResidentId(e.target.value); setTotalDebt(''); }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">— Сонгоно уу —</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>
                  {r.apartment} тоот · {r.name}{r.debt > 0 ? ` · ${r.debt.toLocaleString()}₮ өртэй` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Нийт өр */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Гэрээнд оруулах нийт өр (₮) <span className="text-red-500">*</span></label>
            <input
              type="number"
              value={totalDebt}
              onChange={e => setTotalDebt(e.target.value)}
              placeholder="0"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {selected && selected.debt > 0 && total !== selected.debt && (
              <p className="text-[11px] text-amber-600 mt-1">
                Энэ айлын бүртгэлтэй өр {selected.debt.toLocaleString()}₮ — өөр дүн оруулж байна.
              </p>
            )}
          </div>

          {/* Хуваарь */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Хэдэн сард хуваах</label>
              <input
                type="number" min={1} max={60}
                value={months}
                onChange={e => setMonths(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Эхлэх сар</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Урьдчилан харах */}
          {installments.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">
                Сар бүр {monthly.toLocaleString()}₮ · нийт {monthCount} удаа
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {installments.map(it => (
                  <div key={it.no} className="flex justify-between text-xs text-blue-900/80">
                    <span>{it.no}. {new Date(it.due_date).toLocaleDateString('mn-MN', { year: 'numeric', month: 'long' })}</span>
                    <span className="font-medium">{it.amount.toLocaleString()}₮</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs font-bold text-blue-900 border-t border-blue-200 mt-2 pt-2">
                <span>Нийт</span>
                <span>{installments.reduce((s, i) => s + i.amount, 0).toLocaleString()}₮</span>
              </div>
            </div>
          )}

          {/* Тэмдэглэл */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Тэмдэглэл</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Жишээ: 2 сарын дараа дахин ярилцахаар тохиров"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <p className="text-[11px] text-gray-500 bg-gray-50 rounded-lg p-2.5">
            ⚠️ Гэрээ байгуулснаар өр нь хасагдахгүй. Айл жинхэнэ төлбөрөө хийхэд л
            өр буурна. Гэрээ нь зөвхөн тохиролцсон хуваарийг бүртгэнэ.
          </p>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2.5">{error}</p>}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Хадгалж байна...' : 'Гэрээ байгуулах'}
          </button>
        </div>
      </div>
    </div>
  );
}
