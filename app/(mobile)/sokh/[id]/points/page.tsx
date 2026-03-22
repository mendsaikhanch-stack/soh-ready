'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface PointActivity {
  id: number;
  resident_name: string;
  action: string;
  points: number;
  created_at: string;
}

interface LeaderEntry {
  resident_name: string;
  total: number;
}

const actionMap: Record<string, { label: string; icon: string }> = {
  on_time_payment: { label: 'Цагтаа төлбөр төлсөн', icon: '💰' },
  meeting_attend: { label: 'Хурал оролцсон', icon: '🏛' },
  maintenance_report: { label: 'Засвар мэдэгдсэн', icon: '🔧' },
  recycling: { label: 'Хог ангилсан', icon: '♻️' },
  community_help: { label: 'Хөршдөө тусалсан', icon: '🤝' },
  event_attend: { label: 'Арга хэмжээнд оролцсон', icon: '🎉' },
  suggestion: { label: 'Санал өгсөн', icon: '💡' },
  welcome_neighbor: { label: 'Шинэ хөршөө угтсан', icon: '👋' },
  bonus: { label: 'Урамшуулал', icon: '🎁' },
};

const rewards = [
  { points: 100, label: 'Зогсоолын 1 өдрийн үнэгүй', icon: '🅿️' },
  { points: 250, label: 'Хурлын өрөө 2 цаг үнэгүй', icon: '🏢' },
  { points: 500, label: 'Дараа сарын төлбөрөөс 10% хөнгөлөлт', icon: '💸' },
  { points: 1000, label: 'Дараа сарын төлбөрөөс 25% хөнгөлөлт', icon: '🏆' },
];

export default function PointsPage() {
  const params = useParams();
  const router = useRouter();
  const [activities, setActivities] = useState<PointActivity[]>([]);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`points-name-${params.id}`);
    if (saved) setName(saved);
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    const { data: acts } = await supabase
      .from('point_activities')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setActivities(acts || []);

    // Calculate leaderboard
    const map = new Map<string, number>();
    (acts || []).forEach(a => map.set(a.resident_name, (map.get(a.resident_name) || 0) + a.points));
    const sorted = Array.from(map.entries()).map(([n, t]) => ({ resident_name: n, total: t })).sort((a, b) => b.total - a.total);
    setLeaders(sorted);
    setLoading(false);
  };

  const myPoints = activities.filter(a => a.resident_name === name).reduce((s, a) => s + a.points, 0);
  const myActivities = activities.filter(a => a.resident_name === name);
  const myRank = leaders.findIndex(l => l.resident_name === name) + 1;
  const getAction = (a: string) => actionMap[a] || { label: a, icon: '⭐' };

  if (!name) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-amber-500 text-white px-4 py-4">
          <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
          <h1 className="text-lg font-bold">🏆 Оноо & Шагнал</h1>
        </div>
        <div className="px-4 py-8">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-3xl mb-3">🏆</p>
            <p className="font-semibold mb-1">Нэрээ оруулна уу</p>
            <input placeholder="Жнь: Б.Болд" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name) localStorage.setItem(`points-name-${params.id}`, name); }}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm text-center" autoFocus />
            <button onClick={() => { if (name) localStorage.setItem(`points-name-${params.id}`, name); }}
              disabled={!name} className="w-full bg-amber-500 text-white py-2.5 rounded-xl font-medium disabled:opacity-50">
              Нэвтрэх
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-500 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">🏆 Оноо & Шагнал</h1>
      </div>

      <div className="px-4 py-4">
        {/* My score */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-4 text-white text-center mb-4">
          <p className="text-sm opacity-80">{name}</p>
          <p className="text-4xl font-bold mt-1">{myPoints}</p>
          <p className="text-sm opacity-80">оноо</p>
          {myRank > 0 && <p className="text-xs mt-1 opacity-70">🏅 #{myRank} байр</p>}
        </div>

        {/* Rewards */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">ШАГНАЛ</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {rewards.map(r => (
            <div key={r.points} className={`rounded-xl p-3 border text-center ${myPoints >= r.points ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
              <p className="text-xl">{r.icon}</p>
              <p className="text-xs font-medium mt-1">{r.label}</p>
              <p className="text-xs text-amber-600 mt-0.5">{r.points} оноо</p>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">🏅 ШИЛДЭГ ОРШИН СУУГЧИД</h2>
        <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden">
          {loading ? (
            <p className="text-gray-400 text-center py-4">Ачаалж байна...</p>
          ) : leaders.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Мэдээлэл байхгүй</p>
          ) : (
            leaders.slice(0, 10).map((l, i) => (
              <div key={l.resident_name} className={`flex items-center gap-3 px-4 py-2.5 border-b last:border-0 ${l.resident_name === name ? 'bg-amber-50' : ''}`}>
                <span className="text-lg w-6 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span className="flex-1 text-sm font-medium">{l.resident_name}</span>
                <span className="text-sm font-bold text-amber-600">{l.total}</span>
              </div>
            ))
          )}
        </div>

        {/* My activities */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">МИНИЙ ҮЙЛДЛҮҮД</h2>
        {myActivities.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-gray-400 text-sm">Одоогоор үйлдэл байхгүй</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {myActivities.map(a => {
              const act = getAction(a.action);
              return (
                <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <span className="text-lg">{act.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm">{act.label}</p>
                    <p className="text-[10px] text-gray-400">{new Date(a.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">+{a.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
