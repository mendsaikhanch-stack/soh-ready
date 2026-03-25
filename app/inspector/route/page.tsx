'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { useInspector } from '../layout';

interface Assignment { id: number; sokh_id: number; status: string; notes: string; sokh_name?: string; }
interface Inspection { id: number; apartment: string; resident_name?: string; status: string; }

export default function InspectorRoute() {
  const router = useRouter();
  const inspector = useInspector();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [inspections, setInspections] = useState<Record<number, Inspection[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!inspector?.id) return;
    fetchData();
  }, [inspector]);

  const fetchData = async () => {
    const { data: assigns } = await supabase
      .from('inspector_assignments')
      .select('*')
      .eq('inspector_id', inspector!.id)
      .eq('assigned_date', today)
      .order('created_at');

    const aList = assigns || [];

    // СӨХ нэрс
    const sokhIds = aList.map(a => a.sokh_id);
    const { data: orgs } = await supabase
      .from('sokh_organizations')
      .select('id, name')
      .in('id', sokhIds.length > 0 ? sokhIds : [0]);

    const orgMap = new Map((orgs || []).map(o => [o.id, o.name]));
    const withNames = aList.map(a => ({ ...a, sokh_name: orgMap.get(a.sokh_id) || `#${a.sokh_id}` }));
    setAssignments(withNames);

    // Шалгалтууд
    const inspMap: Record<number, Inspection[]> = {};
    for (const a of aList) {
      const { data: insp } = await supabase
        .from('inspections')
        .select('id, apartment, status')
        .eq('assignment_id', a.id)
        .order('apartment');
      inspMap[a.id] = insp || [];
    }
    setInspections(inspMap);
    setLoading(false);
  };

  const startInspection = (inspectionId: number) => {
    router.push(`/inspector/inspect/${inspectionId}`);
  };

  // Шалгалт үүсгэх (assignment-д оршин суугчдыг нэмэх)
  const generateInspections = async (assignment: Assignment) => {
    const { data: residents } = await supabase
      .from('residents')
      .select('id, name, apartment')
      .eq('sokh_id', assignment.sokh_id)
      .order('apartment');

    if (!residents || residents.length === 0) return;

    const existing = inspections[assignment.id] || [];
    const existingApts = new Set(existing.map(i => i.apartment));

    const newInspections = residents
      .filter(r => !existingApts.has(r.apartment))
      .map(r => ({
        inspector_id: inspector!.id,
        assignment_id: assignment.id,
        sokh_id: assignment.sokh_id,
        resident_id: r.id,
        apartment: r.apartment,
        status: 'pending',
        inspection_date: today,
      }));

    if (newInspections.length > 0) {
      await adminFrom('inspections').insert(newInspections);
      await fetchData();
    }
  };

  const statusIcon = (s: string) => s === 'completed' ? '✅' : s === 'in_progress' ? '🔄' : s === 'skipped' ? '⏭️' : '⬜';
  const statusColor = (s: string) => s === 'completed' ? 'bg-green-50' : s === 'in_progress' ? 'bg-yellow-50' : '';

  return (
    <div className="px-4 py-4">
      <h2 className="text-lg font-bold mb-1">🗺️ Өнөөдрийн маршрут</h2>
      <p className="text-xs text-gray-500 mb-4">{today}</p>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : assignments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-gray-400">Өнөөдрийн даалгавар байхгүй</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const insp = inspections[a.id] || [];
            const completed = insp.filter(i => i.status === 'completed').length;
            const isExpanded = expandedId === a.id;

            return (
              <div key={a.id} className="bg-white rounded-xl border overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full p-4 flex items-center gap-3 text-left">
                  <span className="text-2xl">🏢</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{a.sokh_name}</p>
                    <p className="text-xs text-gray-500">
                      {insp.length > 0 ? `${completed}/${insp.length} шалгасан` : 'Шалгалт үүсгээгүй'}
                    </p>
                    {insp.length > 0 && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${insp.length > 0 ? (completed / insp.length) * 100 : 0}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    {insp.length === 0 ? (
                      <button onClick={() => generateInspections(a)}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium active:bg-indigo-700">
                        Шалгалт үүсгэх (оршин суугчдаар)
                      </button>
                    ) : (
                      <div className="space-y-1">
                        {insp.map(i => (
                          <button key={i.id} onClick={() => startInspection(i.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm active:scale-[0.98] transition ${statusColor(i.status)}`}>
                            <span>{statusIcon(i.status)}</span>
                            <span className="font-medium">Тоот {i.apartment}</span>
                            <span className="ml-auto text-gray-300">›</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
