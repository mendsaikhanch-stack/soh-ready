'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Org {
  id: number;
  name: string;
  address: string | null;
  created_at: string;
  claim_status: string | null;
  activated_at: string | null;
  unit_count: number | null;
  khoroo_id: number | null;
}

interface Row extends Org {
  location: string;
  residents: number;
  fill: number | null;
}

const DAYS = 14;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('mn-MN') : '—');

export default function OnboardingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [recent, setRecent] = useState<Row[]>([]);
  const [daily, setDaily] = useState<{ day: string; orgs: number; residents: number }[]>([]);
  const [totals, setTotals] = useState({ all: 0, active: 0, withResidents: 0, residents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: orgs }, { data: residents }, { data: khoroos }, { data: districts }] = await Promise.all([
      supabase
        .from('sokh_organizations')
        .select('id, name, address, created_at, claim_status, activated_at, unit_count, khoroo_id')
        .order('created_at', { ascending: false })
        .limit(3000),
      supabase.from('residents').select('sokh_id, created_at').limit(10000),
      supabase.from('khoroos').select('id, name, district_id'),
      supabase.from('districts').select('id, name'),
    ]);

    const districtName = new Map<number, string>();
    (districts || []).forEach((d: { id: number; name: string }) => districtName.set(d.id, d.name));

    const khorooLabel = new Map<number, string>();
    (khoroos || []).forEach((k: { id: number; name: string; district_id: number }) => {
      const dn = districtName.get(k.district_id);
      khorooLabel.set(k.id, dn ? `${dn}, ${k.name}` : k.name);
    });

    const residentCount = new Map<number, number>();
    (residents || []).forEach((r: { sokh_id: number | null }) => {
      if (r.sokh_id == null) return;
      residentCount.set(r.sokh_id, (residentCount.get(r.sokh_id) || 0) + 1);
    });

    const toRow = (o: Org): Row => {
      const res = residentCount.get(o.id) || 0;
      return {
        ...o,
        location: o.khoroo_id ? khorooLabel.get(o.khoroo_id) || '—' : '—',
        residents: res,
        fill: o.unit_count && o.unit_count > 0 ? Math.round((res / o.unit_count) * 100) : null,
      };
    };

    const all = (orgs || []).map(toRow);

    // Жинхэнэ хэрэглэгч = идэвхжсэн ЭСВЭЛ оршин суугчтай.
    // Үлдсэн нь лавлахын бүртгэл (бөөнөөр импортолсон) тул энд харуулахгүй.
    const live = all
      .filter(r => r.claim_status === 'active' || r.activated_at || r.residents > 0)
      .sort((a, b) => b.residents - a.residents);

    setRows(live);
    setRecent(all.slice(0, 15));
    setTotals({
      all: all.length,
      active: all.filter(r => r.claim_status === 'active').length,
      withResidents: all.filter(r => r.residents > 0).length,
      residents: (residents || []).length,
    });

    // Сүүлийн 14 хоногийн өдөр тутмын нэмэгдэл
    const orgByDay = new Map<string, number>();
    all.forEach(o => {
      const k = dayKey(new Date(o.created_at));
      orgByDay.set(k, (orgByDay.get(k) || 0) + 1);
    });
    const resByDay = new Map<string, number>();
    (residents || []).forEach((r: { created_at: string | null }) => {
      if (!r.created_at) return;
      const k = dayKey(new Date(r.created_at));
      resByDay.set(k, (resByDay.get(k) || 0) + 1);
    });

    const today = new Date();
    const series = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      series.push({ day: k, orgs: orgByDay.get(k) || 0, residents: resByDay.get(k) || 0 });
    }
    setDaily(series);

    setLoading(false);
  };

  // Анхаарал шаардсан
  const noResidents = rows.filter(r => r.residents === 0);
  const lowFill = rows.filter(r => r.fill !== null && r.fill < 50 && r.residents > 0);

  const maxDaily = Math.max(1, ...daily.map(d => Math.max(d.orgs, d.residents)));

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-gray-400">Бүртгэл ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">📋 Бүртгэлийн явц</h1>
      <p className="text-gray-400 text-sm mb-6">
        Аль СӨХ хэзээ орсон, хэр бүрдсэнийг нэг дороос. Тоонууд бодит өгөгдлөөс шууд уншигдана.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Идэвхжсэн СӨХ', value: totals.active, hint: 'дарга нь эрхээ авсан' },
          { label: 'Оршин суугчтай СӨХ', value: totals.withResidents, hint: 'хүн бүртгэгдсэн' },
          { label: 'Нийт оршин суугч', value: totals.residents.toLocaleString(), hint: 'бүх СӨХ дүнгээр' },
          { label: 'Лавлахад', value: totals.all.toLocaleString(), hint: 'хэрэглэгч биш, зөвхөн жагсаалт' },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Өдөр тутмын нэмэгдэл */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Сүүлийн {DAYS} хоног</h2>
          <div className="flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> СӨХ</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Оршин суугч</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {daily.map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5 h-24">
                <div className="w-1/2 bg-blue-500/80 rounded-t" style={{ height: `${(d.orgs / maxDaily) * 100}%` }} />
                <div className="w-1/2 bg-emerald-500/80 rounded-t" style={{ height: `${(d.residents / maxDaily) * 100}%` }} />
              </div>
              <span className="text-[10px] text-gray-500">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Идэвхтэй СӨХ-үүд */}
      <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold mb-1">Ашиглаж буй СӨХ ({rows.length})</h2>
        <p className="text-xs text-gray-500 mb-4">Идэвхжсэн эсвэл оршин суугч бүртгэгдсэн СӨХ-үүд</p>
        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Одоогоор алга</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left py-2 font-normal">СӨХ</th>
                  <th className="text-left py-2 font-normal">Байршил</th>
                  <th className="text-left py-2 font-normal">Үүсгэсэн</th>
                  <th className="text-left py-2 font-normal">Идэвхжсэн</th>
                  <th className="text-right py-2 font-normal">Оршин суугч</th>
                  <th className="text-right py-2 font-normal">Тоот</th>
                  <th className="text-right py-2 font-normal">Бүрдэлт</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-800/60">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-gray-600 text-xs ml-2">#{r.id}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-400">{r.location}</td>
                    <td className="py-2 pr-3 text-gray-400">{fmt(r.created_at)}</td>
                    <td className="py-2 pr-3 text-gray-400">{fmt(r.activated_at)}</td>
                    <td className="py-2 text-right">{r.residents}</td>
                    <td className="py-2 text-right text-gray-400">{r.unit_count ?? '—'}</td>
                    <td className="py-2 text-right">
                      {r.fill === null ? (
                        <span className="text-gray-600">—</span>
                      ) : (
                        <span className={r.fill >= 70 ? 'text-emerald-400' : r.fill >= 30 ? 'text-yellow-400' : 'text-red-400'}>
                          {r.fill}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Сүүлд нэмэгдсэн */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-1">Сүүлд нэмэгдсэн бүртгэл</h2>
          <p className="text-xs text-gray-500 mb-4">Хэзээ юу орсныг мөрдөх — лавлахын бүртгэл ч энд орно</p>
          <div className="space-y-2">
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate">{r.name}</p>
                  <p className="text-[11px] text-gray-500">{r.location}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs text-gray-400">{fmt(r.created_at)}</p>
                  <p className="text-[11px] text-gray-600">
                    {r.claim_status === 'active' ? 'идэвхжсэн' : r.residents > 0 ? `${r.residents} хүн` : 'хүлээгдэж буй'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Анхаарал шаардсан */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Анхаарал шаардсан</h2>

          <p className="text-xs text-gray-400 mb-2">Идэвхжсэн ч оршин суугч ороогүй ({noResidents.length})</p>
          {noResidents.length === 0 ? (
            <p className="text-xs text-gray-600 mb-4">Алга ✓</p>
          ) : (
            <div className="space-y-1 mb-4">
              {noResidents.map(r => (
                <p key={r.id} className="text-sm">
                  {r.name} <span className="text-gray-600 text-xs">— {fmt(r.activated_at || r.created_at)}</span>
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mb-2">Бүрдэлт 50%-иас доогуур ({lowFill.length})</p>
          {lowFill.length === 0 ? (
            <p className="text-xs text-gray-600">Алга ✓</p>
          ) : (
            <div className="space-y-1">
              {lowFill.map(r => (
                <p key={r.id} className="text-sm">
                  {r.name} <span className="text-red-400 text-xs">{r.fill}%</span>
                  <span className="text-gray-600 text-xs"> ({r.residents}/{r.unit_count})</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
