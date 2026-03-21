'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

export default function UsersPage() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('residents').select('*, sokh_organizations(name)');
      setResidents(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = residents.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.phone?.includes(search) ||
    r.apartment?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">👥 Хэрэглэгчид</h1>
          <p className="text-gray-400 text-sm">{residents.length} нийт бүртгэлтэй</p>
        </div>
      </div>

      <input
        placeholder="Нэр, утас, тоотоор хайх..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white mb-4 placeholder-gray-500"
      />

      {loading ? <p className="text-gray-500">Ачаалж байна...</p> : (
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-4 py-3">№</th>
                <th className="text-left px-4 py-3">Нэр</th>
                <th className="text-left px-4 py-3">Тоот</th>
                <th className="text-left px-4 py-3">Утас</th>
                <th className="text-left px-4 py-3">СӨХ</th>
                <th className="text-right px-4 py-3">Өр</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-xs text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{r.apartment}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{r.sokh_organizations?.name || '—'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${Number(r.debt) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {Number(r.debt) > 0 ? `${Number(r.debt).toLocaleString()}₮` : '0₮'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Хэрэглэгч олдсонгүй</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
