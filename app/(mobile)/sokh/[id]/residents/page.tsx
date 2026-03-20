'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Resident {
  id: number;
  name: string;
  apartment: string;
  phone: string;
  debt: number;
}

export default function ResidentsPage() {
  const params = useParams();
  const router = useRouter();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('residents')
        .select('*')
        .eq('sokh_id', params.id)
        .order('apartment');

      setResidents(data || []);
      setLoading(false);
    };
    fetch();
  }, [params.id]);

  const filtered = residents.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.apartment.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-purple-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">👥 Оршин суугчид</h1>
      </div>

      <div className="px-4 py-4">
        {/* Search */}
        <input
          placeholder="Нэр эсвэл тоотоор хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 text-sm mb-4 bg-white"
        />

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-white rounded-xl p-3 text-center">
            <p className="text-lg font-bold">{residents.length}</p>
            <p className="text-xs text-gray-500">Нийт айл</p>
          </div>
          <div className="flex-1 bg-white rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-red-500">
              {residents.filter(r => r.debt > 0).length}
            </p>
            <p className="text-xs text-gray-500">Өртэй</p>
          </div>
          <div className="flex-1 bg-white rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-500">
              {residents.filter(r => r.debt === 0).length}
            </p>
            <p className="text-xs text-gray-500">Өргүй</p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-gray-400">{search ? 'Хайлт олдсонгүй' : 'Оршин суугч бүртгэгдээгүй'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="bg-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-gray-500">🏠 {r.apartment} {r.phone && `· 📞 ${r.phone}`}</p>
                </div>
                <span className={`text-sm font-semibold ${r.debt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '✅'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
