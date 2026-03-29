'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Alert {
  id: number;
  type: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

const typeMap: Record<string, { label: string; icon: string }> = {
  fire: { label: 'Галын аюул', icon: '🔥' },
  water_leak: { label: 'Ус алдалт', icon: '💧' },
  power_outage: { label: 'Цахилгаан тасалт', icon: '⚡' },
  gas_leak: { label: 'Хий алдалт', icon: '💨' },
  earthquake: { label: 'Газар хөдлөлт', icon: '🌍' },
  security: { label: 'Аюулгүй байдал', icon: '🚨' },
  other: { label: 'Бусад', icon: '⚠️' },
};

const severityMap: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'ЯАРАЛТАЙ', color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
  high: { label: 'Өндөр', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
  medium: { label: 'Дунд', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
  low: { label: 'Бага', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
};

export default function EmergencyPage() {
  const params = useParams();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();

    // Real-time for new alerts
    const channel = supabase
      .channel(`emergency-${params.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emergency_alerts',
        filter: `sokh_id=eq.${params.id}`,
      }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from('emergency_alerts')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setAlerts(data || []);
    setLoading(false);
  };

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const pastAlerts = alerts.filter(a => a.status !== 'active');

  const getType = (t: string) => typeMap[t] || typeMap.other;
  const getSeverity = (s: string) => severityMap[s] || severityMap.medium;

  const emergencyNumbers = [
    { label: 'Цагдаа', phone: '102', icon: '🚔' },
    { label: 'Түргэн тусламж', phone: '103', icon: '🚑' },
    { label: 'Гал унтраах', phone: '101', icon: '🚒' },
    { label: 'Онцгой байдал', phone: '105', icon: '🆘' },
  ];

  const utilityNumbers = [
    { label: 'Цахилгаан аваар', phone: '107', icon: '⚡' },
    { label: 'Дулааны сүлжээ', phone: '11-343434', icon: '🔥' },
    { label: 'Ус суваг', phone: '11-321032', icon: '💧' },
    { label: 'Лифт аваар', phone: '11-343300', icon: '🛗' },
    { label: 'Хийн аваар', phone: '104', icon: '💨' },
    { label: 'Мэдээллийн лавлах', phone: '108', icon: '📞' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-red-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🚨 Яаралтай мэдэгдэл</h1>
      </div>

      <div className="px-4 py-4">
        {/* Emergency numbers */}
        <h2 className="text-xs font-semibold text-red-300 mb-2">ЯАРАЛТАЙ ДУУДЛАГА</h2>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {emergencyNumbers.map((n) => (
            <a
              key={n.phone}
              href={`tel:${n.phone}`}
              className="bg-white rounded-xl p-2 shadow-sm text-center active:scale-95 transition"
            >
              <p className="text-xl">{n.icon}</p>
              <p className="text-xs font-bold text-red-600">{n.phone}</p>
              <p className="text-[10px] text-gray-500">{n.label}</p>
            </a>
          ))}
        </div>

        {/* Utility numbers */}
        <h2 className="text-xs font-semibold text-gray-500 mb-2">ИНЖЕНЕРИЙН ШУГАМ СҮЛЖЭЭ</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {utilityNumbers.map((n) => (
            <a
              key={n.phone}
              href={`tel:${n.phone}`}
              className="bg-white rounded-xl p-2.5 shadow-sm text-center active:scale-95 transition"
            >
              <p className="text-lg">{n.icon}</p>
              <p className="text-xs font-bold text-blue-600">{n.phone}</p>
              <p className="text-[10px] text-gray-500">{n.label}</p>
            </a>
          ))}
        </div>

        {/* Active alerts */}
        {activeAlerts.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-red-600 mb-2">🔴 ИДЭВХТЭЙ АНХААРУУЛГА</h2>
            <div className="space-y-2 mb-4">
              {activeAlerts.map((a) => {
                const type = getType(a.type);
                const sev = getSeverity(a.severity);
                return (
                  <div key={a.id} className={`rounded-xl p-4 border-2 ${sev.bg} animate-pulse`}>
                    <div className="flex items-start gap-2">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm">{a.title}</h3>
                          <span className={`text-xs font-bold ${sev.color}`}>{sev.label}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{a.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(a.created_at).toLocaleString('mn-MN')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Past alerts */}
        <h2 className="text-sm font-semibold text-gray-500 mb-2">ӨМНӨХ МЭДЭГДЛҮҮД</h2>
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : pastAlerts.length === 0 && activeAlerts.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-gray-400">Яаралтай мэдэгдэл байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pastAlerts.map((a) => {
              const type = getType(a.type);
              const sev = getSeverity(a.severity);
              return (
                <div key={a.id} className="bg-white rounded-xl p-3 shadow-sm opacity-70">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{type.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{a.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${sev.color}`}>{sev.label}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString('mn-MN')}
                        </span>
                        <span className="text-xs text-green-600">Шийдвэрлэсэн</span>
                      </div>
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
