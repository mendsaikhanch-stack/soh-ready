'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Usage {
  id: number;
  type: string;
  amount: number;
  cost: number;
  month: number;
  year: number;
}

const typeMap: Record<string, { label: string; icon: string; color: string; unit: string }> = {
  electricity: { label: 'Цахилгаан', icon: '⚡', color: 'text-yellow-600', unit: 'кВт/ц' },
  water: { label: 'Ус', icon: '💧', color: 'text-blue-600', unit: 'м³' },
  heating: { label: 'Дулаан', icon: '🔥', color: 'text-red-600', unit: 'Гкал' },
};

const months = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];

export default function UtilitiesPage() {
  const params = useParams();
  const router = useRouter();
  const [usages, setUsages] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('electricity');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchUsages();
  }, [params.id, selectedYear]);

  const fetchUsages = async () => {
    const { data } = await supabase
      .from('utility_usage')
      .select('*')
      .eq('sokh_id', params.id)
      .eq('year', selectedYear)
      .order('month', { ascending: true });

    setUsages(data || []);
    setLoading(false);
  };

  const filtered = usages.filter(u => u.type === selectedType);
  const maxAmount = Math.max(...filtered.map(u => u.amount), 1);
  const totalCost = filtered.reduce((sum, u) => sum + u.cost, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📊 Ашиглалтын түүх</h1>
      </div>

      <div className="px-4 py-4">
        {/* Type selector */}
        <div className="flex gap-2 mb-4">
          {Object.entries(typeMap).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setSelectedType(key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                selectedType === key
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400'
                  : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              {val.icon} {val.label}
            </button>
          ))}
        </div>

        {/* Year selector */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setSelectedYear(y => y - 1)} className="px-3 py-1.5 bg-white rounded-lg border text-sm">
            ← {selectedYear - 1}
          </button>
          <span className="font-bold text-lg">{selectedYear}</span>
          <button onClick={() => setSelectedYear(y => y + 1)} className="px-3 py-1.5 bg-white rounded-lg border text-sm"
            disabled={selectedYear >= new Date().getFullYear()}>
            {selectedYear + 1} →
          </button>
        </div>

        {/* Total */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-4 text-center">
          <p className="text-sm text-gray-500">Нийт зардал ({selectedYear})</p>
          <p className={`text-2xl font-bold ${typeMap[selectedType].color}`}>
            {totalCost.toLocaleString()}₮
          </p>
        </div>

        {/* Chart */}
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400">Мэдээлэл байхгүй</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">САРЫН ХЭРЭГЛЭЭ ({typeMap[selectedType].unit})</h3>
            <div className="space-y-2">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16">{months[u.month - 1]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        selectedType === 'electricity' ? 'bg-yellow-400' :
                        selectedType === 'water' ? 'bg-blue-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${(u.amount / maxAmount) * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {u.amount}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right">{u.cost.toLocaleString()}₮</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
