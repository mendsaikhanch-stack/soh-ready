'use client';

import { useState, useEffect, useMemo } from 'react';

type LeadStatus = 'pending' | 'contacted' | 'contracted' | 'declined';

interface Lead {
  id: number;
  sokh_id: number | null;
  sokh_name: string | null;
  khoroo_id: number | null;
  contact_name: string;
  contact_phone: string;
  role: string;
  note: string | null;
  status: LeadStatus;
  handled_at: string | null;
  created_at: string;
  sokh_organizations?: { id: number; name: string; claim_status: string } | null;
  khoroos?: { name: string; districts?: { name: string } } | null;
}

const ROLE_LABELS: Record<string, string> = {
  darga: 'Дарга',
  nyarav: 'Нярав',
  member: 'Зөвлөл',
  other: 'Бусад',
};

const STATUS_OPTIONS: Array<{ value: LeadStatus | 'all'; label: string; cls: string }> = [
  { value: 'all',        label: 'Бүгд',           cls: 'bg-gray-700 text-gray-200' },
  { value: 'pending',    label: 'Шинэ',           cls: 'bg-amber-900/40 text-amber-300' },
  { value: 'contacted',  label: 'Холбогдсон',     cls: 'bg-blue-900/40 text-blue-300' },
  { value: 'contracted', label: 'Гэрээтэй',       cls: 'bg-green-900/40 text-green-300' },
  { value: 'declined',   label: 'Татгалзсан',     cls: 'bg-red-900/40 text-red-300' },
];

const STATUS_BADGE: Record<LeadStatus, string> = {
  pending:    'bg-amber-900/30 text-amber-300 border border-amber-800/50',
  contacted:  'bg-blue-900/30 text-blue-300 border border-blue-800/50',
  contracted: 'bg-green-900/30 text-green-300 border border-green-800/50',
  declined:   'bg-red-900/30 text-red-300 border border-red-800/50',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/leads');
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  };

  const updateStatus = async (id: number, status: LeadStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => l.id === id
          ? { ...l, status, handled_at: new Date().toISOString() }
          : l));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return leads;
    return leads.filter(l => l.status === filter);
  }, [leads, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length, pending: 0, contacted: 0, contracted: 0, declined: 0 };
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📞 Холбоо хүсэлтүүд</h1>
        <p className="text-sm text-gray-500 mt-1">СӨХ-н удирдлагаас ирсэн «Хотол-той холбогдох» хүсэлтүүд</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === opt.value ? opt.cls : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {opt.label} <span className="opacity-70">{counts[opt.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Ачаалж байна...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>Хүсэлт алга</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => {
            const isExisting = !!l.sokh_id;
            const sokhName = l.sokh_organizations?.name || l.sokh_name || '?';
            const sokhStatus = l.sokh_organizations?.claim_status;
            const location = [l.khoroos?.districts?.name, l.khoroos?.name].filter(Boolean).join(' · ');
            return (
              <div key={l.id} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{sokhName}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status]}`}>
                        {STATUS_OPTIONS.find(s => s.value === l.status)?.label}
                      </span>
                      {!isExisting && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/50">
                          🆕 Шинэ нэр
                        </span>
                      )}
                      {isExisting && sokhStatus === 'active' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">
                          Аль хэдийн идэвхтэй
                        </span>
                      )}
                    </div>
                    {location && <p className="text-xs text-gray-500 mt-0.5">📍 {location}</p>}
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{l.contact_name}</span>
                      <span className="text-gray-500 mx-1.5">·</span>
                      <span className="text-gray-400">{ROLE_LABELS[l.role] || l.role}</span>
                      <span className="text-gray-500 mx-1.5">·</span>
                      <a href={`tel:${l.contact_phone}`} className="font-mono text-blue-400 hover:underline">
                        📞 {l.contact_phone}
                      </a>
                    </div>
                    {l.note && (
                      <p className="text-xs text-gray-400 mt-2 bg-gray-900/50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                        {l.note}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-600 mt-2">
                      {new Date(l.created_at).toLocaleString('mn-MN')}
                      {l.handled_at && <span className="ml-3">→ {new Date(l.handled_at).toLocaleString('mn-MN')}</span>}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {l.status !== 'contacted' && (
                      <button
                        onClick={() => updateStatus(l.id, 'contacted')}
                        disabled={updatingId === l.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 disabled:opacity-50"
                      >
                        Холбогдсон
                      </button>
                    )}
                    {l.status !== 'contracted' && (
                      <button
                        onClick={() => updateStatus(l.id, 'contracted')}
                        disabled={updatingId === l.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-900/40 hover:bg-green-800/60 text-green-300 disabled:opacity-50"
                      >
                        Гэрээ хийсэн
                      </button>
                    )}
                    {l.status !== 'declined' && (
                      <button
                        onClick={() => updateStatus(l.id, 'declined')}
                        disabled={updatingId === l.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 disabled:opacity-50"
                      >
                        Татгалзах
                      </button>
                    )}
                    {l.sokh_id && l.sokh_organizations?.claim_status !== 'active' && (
                      <a
                        href={`/mng-ctrl/organizations`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 text-center"
                        title="СӨХ жагсаалтаас идэвхжүүлэх кодыг үүсгэнэ"
                      >
                        🔑 Код илгээх
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
  );
}
