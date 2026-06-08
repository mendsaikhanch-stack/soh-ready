'use client';

import { useState, useEffect, useCallback } from 'react';
import { mkt } from '@/app/lib/marketing-client';
import { LEAD_STATUSES, leadStatusMeta } from '@/app/lib/marketing/constants';
import type { Lead } from '@/app/lib/marketing/constants';

export default function LeadsTab({ onChanged }: { onChanged?: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiBusyId, setAiBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const res = await mkt.leads.list();
    setLeads(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const changeStatus = async (id: number, status: Lead['status']) => {
    await mkt.leads.update(id, { status });
    await load();
    onChanged?.();
  };

  const genFollowUp = async (id: number) => {
    setAiBusyId(id); setErr('');
    const res = await mkt.ai.followUp(id);
    setAiBusyId(null);
    if (res.error) { setErr(res.error); return; }
    await load();
  };

  const copyMsg = async (lead: Lead) => {
    if (!lead.follow_up_message) return;
    try {
      await navigator.clipboard.writeText(lead.follow_up_message);
      setCopiedId(lead.id);
      setTimeout(() => setCopiedId((c) => (c === lead.id ? null : c)), 1500);
    } catch { /* ignore */ }
  };

  const remove = async (id: number) => {
    if (!confirm('Лидийг устгах уу?')) return;
    await mkt.leads.remove(id);
    await load();
    onChanged?.();
  };

  return (
    <div>
      {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-3">{err}</div>}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : leads.length === 0 ? (
        <p className="text-gray-400 text-center py-8">
          Лид байхгүй. Постын дараалал дээр &quot;🎯 Лид ирсэн&quot; дарж бүртгэнэ.
        </p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const s = leadStatusMeta(lead.status);
            return (
              <div key={lead.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{lead.name || 'Нэргүй лид'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </div>
                    {lead.contact && <p className="text-xs text-gray-600 mt-0.5">📞 {lead.contact}</p>}
                    {lead.group?.name && <p className="text-xs text-gray-500 mt-0.5">📍 {lead.group.name}</p>}
                    {lead.note && <p className="text-xs text-gray-500 mt-0.5">📝 {lead.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(lead.created_at).toLocaleDateString('mn-MN')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 whitespace-nowrap">
                    <select value={lead.status} onChange={(e) => changeStatus(lead.id, e.target.value as Lead['status'])}
                      className="border rounded-lg px-2 py-1 text-xs">
                      {LEAD_STATUSES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                    <button onClick={() => remove(lead.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                  </div>
                </div>

                {/* Follow-up */}
                <div className="mt-3 border-t pt-3">
                  {lead.follow_up_message ? (
                    <div className="bg-gray-50 border rounded-lg p-3 text-sm whitespace-pre-wrap text-gray-700">
                      {lead.follow_up_message}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Дагалт мессеж үүсгээгүй байна.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => genFollowUp(lead.id)} disabled={aiBusyId === lead.id}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50">
                      {aiBusyId === lead.id ? '...' : '🧠 Дагалт мессеж санал болгох'}
                    </button>
                    {lead.follow_up_message && (
                      <button onClick={() => copyMsg(lead)} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50">
                        {copiedId === lead.id ? '✓ Хууллаа' : '📋 Хуулах'}
                      </button>
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
