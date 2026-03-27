'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/auth-context';
import { QRCodeSVG } from 'qrcode.react';

interface Visitor {
  id: string;
  name: string;
  phone: string;
  purpose: string;
  code: string;
  expiresAt: string;
  createdAt: string;
}

export default function VisitorsPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showQR, setShowQR] = useState<Visitor | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', purpose: 'visit' });

  const storageKey = `visitors_${params.id}_${profile?.id}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed: Visitor[] = JSON.parse(saved);
      // Хугацаа дууссан зочдыг арилгах
      const valid = parsed.filter(v => new Date(v.expiresAt) > new Date());
      setVisitors(valid);
      localStorage.setItem(storageKey, JSON.stringify(valid));
    }
  }, [storageKey]);

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const addVisitor = () => {
    if (!form.name) return;
    const code = generateCode();
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 цагийн дараа

    const visitor: Visitor = {
      id: Date.now().toString(),
      name: form.name,
      phone: form.phone,
      purpose: form.purpose,
      code,
      expiresAt: expires.toISOString(),
      createdAt: now.toISOString(),
    };

    const updated = [visitor, ...visitors];
    setVisitors(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setForm({ name: '', phone: '', purpose: 'visit' });
    setShowForm(false);
    setShowQR(visitor);
  };

  const removeVisitor = (id: string) => {
    const updated = visitors.filter(v => v.id !== id);
    setVisitors(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const shareCode = (v: Visitor) => {
    const text = `🏢 Зочны нэвтрэх код\n\nКод: ${v.code}\nБайр: Тоот ${profile?.apartment}\nХүчинтэй: ${new Date(v.expiresAt).toLocaleString('mn-MN')}\n\nЭнэ кодыг орцны хаалганд үзүүлнэ үү.`;
    if (navigator.share) {
      navigator.share({ title: 'Зочны код', text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Код хуулагдлаа!');
    }
  };

  const purposeLabels: Record<string, string> = {
    visit: 'Зочлох',
    delivery: 'Хүргэлт',
    service: 'Засвар/Үйлчилгээ',
    other: 'Бусад',
  };

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ц ${mins}м`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🚪 Зочны бүртгэл</h1>
        <p className="text-xs text-white/60 mt-0.5">QR код үүсгэж зочдод илгээх</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium active:bg-teal-700 transition"
        >
          + Зочны код үүсгэх
        </button>

        {showForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="space-y-2">
              <input
                placeholder="Зочны нэр"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Утасны дугаар (заавал биш)"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={form.purpose}
                onChange={e => setForm({ ...form, purpose: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="visit">Зочлох</option>
                <option value="delivery">Хүргэлт</option>
                <option value="service">Засвар/Үйлчилгээ</option>
                <option value="other">Бусад</option>
              </select>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">
                Цуцлах
              </button>
              <button
                onClick={addVisitor}
                disabled={!form.name}
                className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50"
              >
                Үүсгэх
              </button>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-500">ИДЭВХТЭЙ КОДУУД</h2>

        {visitors.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">🚪</p>
            <p className="text-gray-400 text-sm">Идэвхтэй зочны код байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visitors.map(v => (
              <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-gray-500">{purposeLabels[v.purpose]}</p>
                  </div>
                  <div className="bg-teal-50 px-3 py-1 rounded-lg">
                    <p className="text-lg font-bold text-teal-700 tracking-widest">{v.code}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-3">
                  Хүчинтэй: {getTimeLeft(v.expiresAt)} үлдсэн
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowQR(v)}
                    className="flex-1 py-2 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium"
                  >
                    QR харах
                  </button>
                  <button
                    onClick={() => shareCode(v)}
                    className="flex-1 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium"
                  >
                    📤 Илгээх
                  </button>
                  <button
                    onClick={() => removeVisitor(v.id)}
                    className="py-2 px-3 rounded-lg bg-red-50 text-red-500 text-xs font-medium"
                  >
                    Устгах
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-[340px] w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">🚪 Зочны QR код</h3>
            <p className="text-sm text-gray-500 mb-4">{showQR.name}</p>

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 inline-block mb-4">
              <QRCodeSVG
                value={JSON.stringify({
                  type: 'visitor',
                  code: showQR.code,
                  name: showQR.name,
                  apartment: profile?.apartment,
                  expires: showQR.expiresAt,
                  sokh_id: params.id,
                })}
                size={200}
                level="M"
              />
            </div>

            <div className="bg-teal-50 rounded-xl p-3 mb-4">
              <p className="text-2xl font-bold text-teal-700 tracking-[0.3em]">{showQR.code}</p>
              <p className="text-xs text-gray-500 mt-1">Тоот: {profile?.apartment}</p>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => shareCode(showQR)}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-teal-600 text-white"
              >
                📤 Зочинд илгээх
              </button>
            </div>

            <button
              onClick={() => setShowQR(null)}
              className="w-full py-3 rounded-xl text-sm font-medium border border-gray-300 text-gray-600"
            >
              Хаах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
