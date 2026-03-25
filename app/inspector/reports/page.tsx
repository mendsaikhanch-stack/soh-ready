'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useInspector } from '../layout';

export default function InspectorReports() {
  const inspector = useInspector();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState({ inspections: 0, completed: 0, readings: 0, violations: 0, acts: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inspector?.id) return;
    fetchStats();
  }, [inspector, period]);

  const fetchStats = async () => {
    setLoading(true);
    const now = new Date();
    let fromDate: string;

    if (period === 'today') {
      fromDate = now.toISOString().split('T')[0];
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      fromDate = d.toISOString().split('T')[0];
    } else {
      const d = new Date(now);
      d.setDate(1);
      fromDate = d.toISOString().split('T')[0];
    }

    const { data: inspections } = await supabase
      .from('inspections')
      .select('id, status')
      .eq('inspector_id', inspector!.id)
      .gte('inspection_date', fromDate);

    const all = inspections || [];
    const ids = all.map(i => i.id);
    const safeIds = ids.length > 0 ? ids : [0];

    const [{ count: rCount }, { count: vCount }, { count: aCount }] = await Promise.all([
      supabase.from('inspection_readings').select('*', { count: 'exact', head: true }).in('inspection_id', safeIds),
      supabase.from('inspection_violations').select('*', { count: 'exact', head: true }).in('inspection_id', safeIds),
      supabase.from('inspection_acts').select('*', { count: 'exact', head: true }).in('inspection_id', safeIds),
    ]);

    setStats({
      inspections: all.length,
      completed: all.filter(i => i.status === 'completed').length,
      readings: rCount || 0,
      violations: vCount || 0,
      acts: aCount || 0,
    });
    setLoading(false);
  };

  const rate = stats.inspections > 0 ? Math.round((stats.completed / stats.inspections) * 100) : 0;

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-4">📋 Тайлан</h2>

      {/* Period */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'today' as const, label: 'Өнөөдөр' },
          { value: 'week' as const, label: '7 хоног' },
          { value: 'month' as const, label: 'Энэ сар' },
        ].map(p => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              period === p.value ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' : 'bg-white border'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <>
          {/* Гүйцэтгэлийн хувь */}
          <div className="bg-white rounded-xl border p-4 mb-4 text-center">
            <p className={`text-4xl font-bold ${rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {rate}%
            </p>
            <p className="text-sm text-gray-500 mt-1">Гүйцэтгэл</p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
              <div className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${rate}%` }} />
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            {[
              { label: 'Нийт шалгалт', value: stats.inspections, icon: '🏠' },
              { label: 'Гүйцэтгэсэн', value: stats.completed, icon: '✅' },
              { label: 'Заалт оруулсан', value: stats.readings, icon: '📊' },
              { label: 'Зөрчил илрүүлсэн', value: stats.violations, icon: '⚠️' },
              { label: 'Акт үүсгэсэн', value: stats.acts, icon: '📄' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className="text-sm">{s.label}</span>
                </div>
                <span className="text-lg font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
