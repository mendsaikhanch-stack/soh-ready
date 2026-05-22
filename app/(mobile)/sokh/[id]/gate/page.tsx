'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';
import { QRCodeSVG } from 'qrcode.react';

interface GateEvent {
  id: number;
  action: 'opened' | 'requested' | 'denied';
  source: 'qr' | 'manual' | 'guest';
  guest_name: string | null;
  created_at: string;
}

export default function MobileGatePage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const sokhId = params.id as string;

  const [events, setEvents] = useState<GateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showGuestQR, setShowGuestQR] = useState(false);
  const [guestForm, setGuestForm] = useState({ name: '', minutes: 60 });

  const fetchData = async () => {
    const { data } = await supabase
      .from('gate_events')
      .select('*')
      .eq('sokh_id', sokhId)
      .order('created_at', { ascending: false })
      .limit(15);
    setEvents((data as GateEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [sokhId]);

  const requestOpen = async () => {
    if (!profile) {
      alert('Нэвтэрнэ үү');
      return;
    }
    setRequesting(true);
    const { error } = await supabase.from('gate_events').insert([{
      sokh_id: Number(sokhId),
      action: 'requested',
      source: 'manual',
      requester_name: profile.name,
      requester_apartment: profile.apartment,
    }]);
    setRequesting(false);
    if (!error) {
      alert('🚧 Хаалт нээх хүсэлт илгээгдлээ. Хамгаалагч/автомат систем хүлээн авна.');
      await fetchData();
    } else {
      alert(`Алдаа: ${error.message}`);
    }
  };

  const myToken = profile
    ? `gate:${sokhId}:${profile.id}:${profile.apartment}`
    : `gate:${sokhId}:guest`;

  const guestToken = guestForm.name
    ? `gate-guest:${sokhId}:${encodeURIComponent(guestForm.name)}:${guestForm.minutes}:${Date.now()}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
          <div className="h-16 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-slate-800 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-2xl">‹</button>
        <div>
          <h1 className="text-lg font-bold">🚧 Хотхоны хаалга</h1>
          <p className="text-xs text-white/70">QR-аар нээх, хүсэлт илгээх</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* My QR card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-white">
            <p className="text-xs opacity-80">Миний QR</p>
            <p className="font-semibold text-sm">{profile?.name || 'Зочин'} · {profile?.apartment || '-'}</p>
          </div>
          <button
            onClick={() => setShowQR(s => !s)}
            className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50 transition"
          >
            <span className="text-sm font-medium">{showQR ? 'QR хаах' : 'QR харуулах'}</span>
            <span className="text-2xl">{showQR ? '🔒' : '📱'}</span>
          </button>
          {showQR && (
            <div className="px-4 pb-4 flex flex-col items-center gap-2">
              <div className="bg-white p-3 rounded-xl border">
                <QRCodeSVG value={myToken} size={180} />
              </div>
              <p className="text-[11px] text-gray-500 text-center">
                Хаалганы скэннерт ойртуулна уу. Зөвхөн та өөрөө ашиглах боломжтой.
              </p>
            </div>
          )}
        </div>

        {/* Manual open button */}
        <button
          onClick={requestOpen}
          disabled={requesting}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:bg-green-700 disabled:opacity-50"
        >
          <span>🚧</span>
          <span>{requesting ? 'Илгээж байна...' : 'Хаалт нээх хүсэлт илгээх'}</span>
        </button>

        {/* Guest QR */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowGuestQR(s => !s)}
            className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50 transition"
          >
            <div className="text-left">
              <p className="text-sm font-medium">🎫 Зочинд QR илгээх</p>
              <p className="text-xs text-gray-500">Тогтоосон хугацаатай нэг удаагийн зөвшөөрөл</p>
            </div>
            <span className="text-gray-300 text-xl">{showGuestQR ? '×' : '+'}</span>
          </button>
          {showGuestQR && (
            <div className="border-t px-4 py-4 space-y-3">
              <input
                type="text"
                placeholder="Зочны нэр"
                value={guestForm.name}
                onChange={e => setGuestForm({ ...guestForm, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                {[30, 60, 120, 240].map(m => (
                  <button
                    key={m}
                    onClick={() => setGuestForm({ ...guestForm, minutes: m })}
                    className={`flex-1 text-xs py-2 rounded-lg border ${
                      guestForm.minutes === m ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m} мин
                  </button>
                ))}
              </div>
              {guestToken && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <div className="bg-white p-3 rounded-xl border">
                    <QRCodeSVG value={guestToken} size={160} />
                  </div>
                  <p className="text-[11px] text-gray-500 text-center">
                    Энэ QR-ийг зочиндоо илгээнэ. {guestForm.minutes} минутын дотор хүчинтэй.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event log */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">СҮҮЛИЙН ҮЙЛДЭЛ</h3>
          {events.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border">
              <p className="text-gray-400 text-xs">Үйлдэл бүртгэгдээгүй</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {events.map(e => (
                <div key={e.id} className="px-3 py-2.5 flex items-center gap-3">
                  <span className="text-xl">
                    {e.action === 'opened' ? '✅' : e.action === 'denied' ? '❌' : '🕐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {e.action === 'opened' ? 'Нээгдсэн' : e.action === 'denied' ? 'Татгалзсан' : 'Хүсэлт илгээсэн'}
                      {e.guest_name && <span className="text-gray-500"> · {e.guest_name}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(e.created_at).toLocaleString('mn-MN')} · {e.source === 'qr' ? 'QR' : e.source === 'guest' ? 'Зочин' : 'Гар'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
