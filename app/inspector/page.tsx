'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useInspector } from './layout';

export default function InspectorDashboard() {
  const router = useRouter();
  const inspector = useInspector();
  const [stats, setStats] = useState({ total: 0, completed: 0, violations: 0, readings: 0 });
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!inspector?.id) { setLoading(false); return; }
    const fetch = async () => {
      const { data: insp } = await supabase
        .from('inspections')
        .select('id, status')
        .eq('inspector_id', inspector.id)
        .eq('inspection_date', today);

      const all = insp || [];
      const { count: vCount } = await supabase
        .from('inspection_violations')
        .select('*', { count: 'exact', head: true })
        .in('inspection_id', all.map(i => i.id).length > 0 ? all.map(i => i.id) : [0]);

      const { count: rCount } = await supabase
        .from('inspection_readings')
        .select('*', { count: 'exact', head: true })
        .in('inspection_id', all.map(i => i.id).length > 0 ? all.map(i => i.id) : [0]);

      setStats({
        total: all.length,
        completed: all.filter(i => i.status === 'completed').length,
        violations: vCount || 0,
        readings: rCount || 0,
      });
      setLoading(false);
    };
    fetch();
  }, [inspector, today]);

  const cards = [
    { label: 'Нийт шалгалт', value: stats.total, icon: '🏠', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Гүйцэтгэсэн', value: stats.completed, icon: '✅', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Зөрчил', value: stats.violations, icon: '⚠️', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Заалт оруулсан', value: stats.readings, icon: '📊', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  ];

  const actions = [
    { icon: '🗺️', label: 'Маршрут эхлэх', desc: 'Өнөөдрийн даалгавар', href: '/inspector/route', color: 'bg-indigo-600 text-white' },
    { icon: '📊', label: 'Заалт оруулах', desc: 'Тоолуур бүртгэх', href: '/inspector/readings', color: 'bg-emerald-600 text-white' },
    { icon: '⚠️', label: 'Зөрчил бүртгэх', desc: 'Шинэ зөрчил', href: '/inspector/violations', color: 'bg-red-600 text-white' },
    { icon: '📷', label: 'QR скан', desc: 'Тоолуур уншуулах', href: '/inspector/scan', color: 'bg-amber-600 text-white' },
  ];

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-1">Өнөөдөр</h2>
      <p className="text-xs text-gray-500 mb-4">{new Date().toLocaleDateString('mn-MN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {cards.map(c => (
              <div key={c.label} className={`rounded-xl border p-3 ${c.color}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-2xl font-bold">{c.value}</span>
                </div>
                <p className="text-xs mt-1 opacity-80">{c.label}</p>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-gray-500 mb-3">ҮЙЛДЭЛ</h3>
          <div className="space-y-2">
            {actions.map(a => (
              <button key={a.href} onClick={() => router.push(a.href)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl ${a.color} text-left active:scale-[0.98] transition`}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="font-medium text-sm">{a.label}</p>
                  <p className="text-xs opacity-70">{a.desc}</p>
                </div>
                <span className="ml-auto opacity-50">›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
