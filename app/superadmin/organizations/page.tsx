'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function OrganizationsPage() {
  const [sokhs, setSokhs] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: s } = await supabase.from('sokh_organizations').select('*, khoroos(name, districts(name, cities(name)))');
      setSokhs(s || []);
      const { data: r } = await supabase.from('residents').select('sokh_id, debt');
      setResidents(r || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const getOrgStats = (id: number) => {
    const org = residents.filter(r => r.sokh_id === id);
    return { count: org.length, debt: org.reduce((s, r) => s + Number(r.debt || 0), 0) };
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">🏢 СӨХ-үүд</h1>
          <p className="text-gray-400 text-sm">{sokhs.length} бүртгэлтэй</p>
        </div>
      </div>

      {loading ? <p className="text-gray-500">Ачаалж байна...</p> : (
        <div className="space-y-3">
          {sokhs.map(s => {
            const stats = getOrgStats(s.id);
            const plan = stats.count > 0 ? 'Стандарт' : 'Үнэгүй';
            const fee = stats.count > 0 ? 50000 : 0;
            return (
              <div key={s.id} className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{s.name}</h3>
                    <p className="text-gray-400 text-sm">{s.address}</p>
                    <p className="text-gray-500 text-xs mt-1">📞 {s.phone || 'Утасгүй'}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${plan === 'Стандарт' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
                    {plan} {fee > 0 && `· ${fee.toLocaleString()}₮/сар`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-800">
                  <div>
                    <p className="text-lg font-bold">{stats.count}</p>
                    <p className="text-xs text-gray-500">Айл</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-400">{residents.filter(r => r.sokh_id === s.id && Number(r.debt) > 0).length}</p>
                    <p className="text-xs text-gray-500">Өртэй</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stats.debt > 0 ? `${(stats.debt/1000).toFixed(0)}к₮` : '0₮'}</p>
                    <p className="text-xs text-gray-500">Нийт өр</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-400">{stats.count > 0 ? 'Идэвхтэй' : '—'}</p>
                    <p className="text-xs text-gray-500">Төлөв</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
