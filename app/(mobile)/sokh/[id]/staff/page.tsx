'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Staff {
  id: number;
  name: string;
  role: string;
  phone: string;
  schedule: string;
  status: string;
}

const roleMap: Record<string, { label: string; icon: string }> = {
  manager: { label: 'Менежер', icon: '👔' },
  janitor: { label: 'Цэвэрлэгч', icon: '🧹' },
  security: { label: 'Харуул', icon: '💂' },
  plumber: { label: 'Сантехникч', icon: '🔧' },
  electrician: { label: 'Цахилгаанчин', icon: '⚡' },
  other: { label: 'Бусад', icon: '👷' },
};

export default function StaffPage() {
  const params = useParams();
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('sokh_id', params.id)
        .eq('status', 'active')
        .order('role', { ascending: true });

      setStaff(data || []);
      setLoading(false);
    };
    fetchStaff();
  }, [params.id]);

  const getRole = (r: string) => roleMap[r] || roleMap.other;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">👷 Ажилчид</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">👷</p>
            <p className="text-gray-400">Ажилтны мэдээлэл байхгүй</p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((s) => {
              const role = getRole(s.role);
              return (
                <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">
                      {role.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <p className="text-xs text-amber-600 font-medium">{role.label}</p>
                      {s.schedule && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-xs">🕐</span>
                          <p className="text-xs text-gray-500">{s.schedule}</p>
                        </div>
                      )}
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600">
                          <span>📞</span> {s.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
