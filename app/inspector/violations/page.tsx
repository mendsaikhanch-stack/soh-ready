'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { useInspector } from '../layout';

interface Violation { id: number; inspection_id: number; violation_type: string; description: string; severity: string; status: string; created_at: string; apartment?: string; }

const typeLabels: Record<string, { label: string; icon: string }> = {
  illegal_connection: { label: 'Хууль бус холболт', icon: '🔌' },
  meter_tamper: { label: 'Тоолуур эвдрэл', icon: '🔧' },
  seal_broken: { label: 'Лац задарсан', icon: '🔓' },
  other: { label: 'Бусад', icon: '⚠️' },
};

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function InspectorViolations() {
  const inspector = useInspector();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!inspector?.id) return;
    fetchViolations();
  }, [inspector]);

  const fetchViolations = async () => {
    // Байцаагчийн шалгалтуудын зөрчлүүд
    const { data: inspections } = await supabase
      .from('inspections')
      .select('id, apartment')
      .eq('inspector_id', inspector!.id);

    if (!inspections || inspections.length === 0) { setLoading(false); return; }

    const inspMap = new Map(inspections.map(i => [i.id, i.apartment]));
    const { data: viols } = await supabase
      .from('inspection_violations')
      .select('*')
      .in('inspection_id', inspections.map(i => i.id))
      .order('created_at', { ascending: false });

    setViolations((viols || []).map(v => ({ ...v, apartment: inspMap.get(v.inspection_id) })));
    setLoading(false);
  };

  const resolveViolation = async (id: number) => {
    await adminFrom('inspection_violations').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    await fetchViolations();
  };

  const filtered = filter === 'all' ? violations : violations.filter(v => v.status === filter);

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-4">⚠️ Зөрчлүүд</h2>

      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: 'Бүгд' },
          { value: 'open', label: 'Нээлттэй' },
          { value: 'resolved', label: 'Шийдсэн' },
        ].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${
              filter === f.value ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' : 'bg-white border'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-gray-400">Зөрчил байхгүй</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(v => {
            const tp = typeLabels[v.violation_type] || typeLabels.other;
            return (
              <div key={v.id} className="bg-white rounded-xl border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{tp.icon}</span>
                  <p className="text-sm font-semibold flex-1">{tp.label}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${severityColors[v.severity] || ''}`}>
                    {v.severity}
                  </span>
                </div>
                {v.apartment && <p className="text-xs text-gray-500 mb-1">Тоот {v.apartment}</p>}
                <p className="text-sm text-gray-600">{v.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-400">{new Date(v.created_at).toLocaleDateString('mn-MN')}</span>
                  {v.status === 'open' && (
                    <button onClick={() => resolveViolation(v.id)}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      Шийдсэн
                    </button>
                  )}
                  {v.status === 'resolved' && <span className="text-xs text-green-600">✅ Шийдсэн</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
