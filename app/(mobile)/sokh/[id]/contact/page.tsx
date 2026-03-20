'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface SokhOrg {
  id: number;
  name: string;
  address: string;
  phone: string;
}

export default function ContactPage() {
  const params = useParams();
  const router = useRouter();
  const [sokh, setSokh] = useState<SokhOrg | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('sokh_organizations')
        .select('*')
        .eq('id', params.id)
        .single();

      if (data) setSokh(data);
    };
    fetch();
  }, [params.id]);

  const sendMessage = async () => {
    if (!message) return;
    await supabase.from('messages').insert([{
      sokh_id: params.id,
      content: message,
      type: 'resident_to_sokh',
    }]);
    setMessage('');
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-teal-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📞 Холбоо барих</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* СӨХ мэдээлэл */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm mb-3">СӨХ-ийн мэдээлэл</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">🏢</span>
              <div>
                <p className="text-xs text-gray-500">Нэр</p>
                <p className="text-sm font-medium">{sokh?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">📍</span>
              <div>
                <p className="text-xs text-gray-500">Хаяг</p>
                <p className="text-sm font-medium">{sokh?.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg">📞</span>
              <div>
                <p className="text-xs text-gray-500">Утас</p>
                <p className="text-sm font-medium">{sokh?.phone || 'Бүртгэгдээгүй'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Шууд залгах */}
        {sokh?.phone && (
          <a
            href={`tel:${sokh.phone}`}
            className="block w-full bg-teal-600 text-white py-3 rounded-xl font-medium text-center active:bg-teal-700 transition"
          >
            📞 Залгах
          </a>
        )}

        {/* Мессеж илгээх */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm mb-3">Мессеж илгээх</h2>
          <textarea
            placeholder="Санал хүсэлт, гомдол бичих..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
          />
          <button
            onClick={sendMessage}
            disabled={!message}
            className="w-full bg-teal-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Илгээх
          </button>
          {sent && (
            <p className="text-green-600 text-sm text-center mt-2">✅ Мессеж илгээгдлээ!</p>
          )}
        </div>
      </div>
    </div>
  );
}
