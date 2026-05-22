'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';
import { QRCodeSVG } from 'qrcode.react';

interface ElevatorCall {
  id: number;
  elevator_name: string;
  from_floor: number | null;
  to_floor: number | null;
  status: 'requested' | 'arrived' | 'cancelled';
  created_at: string;
}

const ELEVATORS = ['Лифт #1', 'Лифт #2'];
const FLOORS = Array.from({ length: 16 }, (_, i) => i + 1);

export default function MobileElevatorPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const sokhId = params.id as string;

  const [calls, setCalls] = useState<ElevatorCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedElevator, setSelectedElevator] = useState(ELEVATORS[0]);
  const [targetFloor, setTargetFloor] = useState<number>(1);

  // Davhar-aas apartment гарга (A-301 → 3)
  const myFloor = (() => {
    if (!profile?.apartment) return 1;
    const m = String(profile.apartment).match(/(\d+)/g);
    if (!m) return 1;
    const num = Number(m[m.length - 1]);
    if (num >= 100) return Math.floor(num / 100);
    return num;
  })();

  const fetchData = async () => {
    const { data } = await supabase
      .from('elevator_calls')
      .select('*')
      .eq('sokh_id', sokhId)
      .order('created_at', { ascending: false })
      .limit(10);
    setCalls((data as ElevatorCall[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    setTargetFloor(myFloor);
  }, [sokhId, myFloor]);

  const callElevator = async (toFloor: number) => {
    if (!profile) {
      alert('Нэвтэрнэ үү');
      return;
    }
    setCalling(true);
    const { error } = await supabase.from('elevator_calls').insert([{
      sokh_id: Number(sokhId),
      elevator_name: selectedElevator,
      from_floor: 1,
      to_floor: toFloor,
      caller_name: profile.name,
      caller_apartment: profile.apartment,
      status: 'requested',
    }]);
    setCalling(false);
    if (!error) {
      alert(`🛗 ${selectedElevator} → ${toFloor}-р давхар дуудлаа.`);
      await fetchData();
    } else {
      alert(`Алдаа: ${error.message}`);
    }
  };

  const myToken = profile
    ? `elevator:${sokhId}:${profile.id}:${profile.apartment}:${myFloor}`
    : `elevator:${sokhId}:guest`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-32 bg-gray-200 rounded-2xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-indigo-700 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-2xl">‹</button>
        <div>
          <h1 className="text-lg font-bold">🛗 Лифт</h1>
          <p className="text-xs text-white/70">Дуудах, QR харуулах</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* My QR */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-4 py-3 text-white">
            <p className="text-xs opacity-80">Миний QR</p>
            <p className="font-semibold text-sm">{profile?.name || 'Зочин'} · {profile?.apartment || '-'} · {myFloor}-р давхар</p>
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
                Лифтний скэннерт ойртуулахад автоматаар {myFloor}-р давхрыг сонгоно.
              </p>
            </div>
          )}
        </div>

        {/* Quick call to my floor */}
        <button
          onClick={() => callElevator(myFloor)}
          disabled={calling}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:bg-indigo-700 disabled:opacity-50"
        >
          <span>🛗</span>
          <span>{calling ? 'Дуудаж байна...' : `${myFloor}-р давхар руу дуудах`}</span>
        </button>

        {/* Elevator selector */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2">ЛИФТ СОНГОХ</p>
          <div className="flex gap-2">
            {ELEVATORS.map(name => (
              <button
                key={name}
                onClick={() => setSelectedElevator(name)}
                className={`flex-1 py-2 rounded-lg border text-sm ${
                  selectedElevator === name ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Floor picker */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2">ДАВХАР СОНГОХ</p>
          <div className="grid grid-cols-4 gap-2">
            {FLOORS.map(f => (
              <button
                key={f}
                onClick={() => setTargetFloor(f)}
                className={`aspect-square rounded-lg border text-sm font-medium ${
                  targetFloor === f ? 'bg-indigo-600 text-white border-indigo-600' :
                  f === myFloor ? 'bg-blue-50 border-blue-300 text-blue-700' :
                  'border-gray-200 text-gray-700'
                }`}
              >
                {f}
                {f === myFloor && <span className="block text-[8px] opacity-70">миний</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => callElevator(targetFloor)}
            disabled={calling}
            className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium active:bg-green-700 disabled:opacity-50"
          >
            {targetFloor}-р давхар руу дуудах
          </button>
        </div>

        {/* Recent calls */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">СҮҮЛИЙН ДУУДЛАГА</h3>
          {calls.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center border">
              <p className="text-gray-400 text-xs">Дуудлага бүртгэгдээгүй</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {calls.map(c => (
                <div key={c.id} className="px-3 py-2.5 flex items-center gap-3">
                  <span className="text-xl">
                    {c.status === 'arrived' ? '✅' : c.status === 'cancelled' ? '❌' : '🕐'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {c.elevator_name} · {c.from_floor ?? '?'} → {c.to_floor ?? '?'}-р давхар
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(c.created_at).toLocaleString('mn-MN')}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    c.status === 'arrived' ? 'bg-green-100 text-green-700' :
                    c.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {c.status === 'arrived' ? 'Ирсэн' : c.status === 'cancelled' ? 'Цуцалсан' : 'Хүлээгдэж буй'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
