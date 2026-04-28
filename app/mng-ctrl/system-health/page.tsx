'use client';

import { useState, useEffect } from 'react';

interface Health {
  jobs: { pending: number; running: number; failed: number; dead: number; succeeded24h: number };
  deadJobs: Array<{
    id: number; job_type: string; attempts: number; max_attempts: number;
    last_error: string | null; created_at: string; updated_at: string;
    payload: Record<string, unknown>; idempotency_key: string | null;
  }>;
  pendingRetries: Array<{
    id: number; job_type: string; attempts: number; available_at: string; last_error: string | null;
  }>;
  alerts: Array<{
    id: number; severity: 'info' | 'warning' | 'critical';
    source: string; message: string; payload: Record<string, unknown>; created_at: string;
  }>;
  drift: {
    activationSummaryMismatches: number;
    unclaimedMemberships: number;
    pendingProvisionals: number;
  };
}

export default function SystemHealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [acking, setAcking] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/system-health');
      if (!res.ok) {
        setError(res.status === 401 ? 'Зөвхөн супер админ' : 'Алдаа');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Сүлжээний алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, []);

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await fetch('/api/admin/system-health', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'retry' }),
      });
      await load();
    } finally {
      setRetrying(null);
    }
  };

  const ack = async (id: number) => {
    setAcking(id);
    try {
      await fetch('/api/admin/system-health', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'ack' }),
      });
      await load();
    } finally {
      setAcking(null);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🩺 Системийн эрүүл мэнд</h1>
        <p className="text-sm text-gray-500 mt-1">Background job, reconciliation, drift тоонууд</p>
      </div>

      {data.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.alerts.map(a => {
            const cls = a.severity === 'critical'
              ? 'border-red-700 bg-red-900/30 text-red-100'
              : a.severity === 'warning'
                ? 'border-amber-700 bg-amber-900/30 text-amber-100'
                : 'border-blue-700 bg-blue-900/30 text-blue-100';
            const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : 'ℹ️';
            return (
              <div key={a.id} className={`rounded-xl border p-3 ${cls}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span>{icon}</span>
                      <span className="font-mono opacity-70">{a.source}</span>
                      <span className="opacity-60">·</span>
                      <span className="opacity-60">{new Date(a.created_at).toLocaleString('mn-MN')}</span>
                    </div>
                    <p className="text-sm mt-1.5 break-words">{a.message}</p>
                  </div>
                  <button
                    onClick={() => ack(a.id)}
                    disabled={acking === a.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-white disabled:opacity-50 shrink-0"
                  >
                    {acking === a.id ? '...' : '✓ Ack'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Pending" value={data.jobs.pending} cls="border-amber-800/50 bg-amber-900/20 text-amber-400" />
        <Stat label="Running" value={data.jobs.running} cls="border-blue-800/50 bg-blue-900/20 text-blue-400" />
        <Stat label="Failed (retry)" value={data.jobs.failed} cls="border-orange-800/50 bg-orange-900/20 text-orange-400" />
        <Stat label="Dead" value={data.jobs.dead} cls="border-red-800/50 bg-red-900/20 text-red-400" />
        <Stat label="Done (24h)" value={data.jobs.succeeded24h} cls="border-green-800/50 bg-green-900/20 text-green-400" />
      </div>

      <h2 className="text-sm font-semibold text-gray-300 mb-2">Өгөгдлийн зөрөө (drift)</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Summary mismatch" value={data.drift.activationSummaryMismatches} cls="border-gray-700 bg-gray-800/50 text-gray-300" />
        <Stat label="Unclaimed members" value={data.drift.unclaimedMemberships} cls="border-gray-700 bg-gray-800/50 text-gray-300" />
        <Stat label="Pending provisionals" value={data.drift.pendingProvisionals} cls="border-gray-700 bg-gray-800/50 text-gray-300" />
      </div>

      {data.deadJobs.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-red-300 mb-2">💀 Dead jobs ({data.deadJobs.length})</h2>
          <div className="space-y-2 mb-6">
            {data.deadJobs.map(j => (
              <div key={j.id} className="bg-red-900/10 border border-red-800/40 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-500">#{j.id}</span>
                      <span className="text-sm font-semibold text-red-300">{j.job_type}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {j.attempts}/{j.max_attempts} оролдлого
                      </span>
                    </div>
                    {j.last_error && (
                      <p className="text-xs text-red-200/70 mt-1.5 font-mono break-all">{j.last_error}</p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1">
                      {new Date(j.updated_at).toLocaleString('mn-MN')} ·
                      payload={JSON.stringify(j.payload).slice(0, 80)}{JSON.stringify(j.payload).length > 80 ? '…' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => retry(j.id)}
                    disabled={retrying === j.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-50 shrink-0"
                  >
                    {retrying === j.id ? '...' : '🔁 Retry'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.pendingRetries.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-amber-300 mb-2">⏳ Хүлээж буй retry ({data.pendingRetries.length})</h2>
          <div className="space-y-1.5 mb-6">
            {data.pendingRetries.map(j => (
              <div key={j.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-500">#{j.id}</span>
                  <span className="font-medium">{j.job_type}</span>
                  <span className="text-gray-500">attempt {j.attempts}</span>
                  <span className="text-gray-500 ml-auto">
                    {new Date(j.available_at).toLocaleString('mn-MN')}
                  </span>
                </div>
                {j.last_error && <p className="text-gray-500 mt-1 font-mono break-all">{j.last_error}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-[11px] text-gray-500 text-center pt-4 border-t border-gray-800">
        30 секунд тутамд auto-refresh ·
        Cron: <code className="text-gray-400">/api/cron/jobs-runner</code> · 1 минут тутам
      </p>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80 mt-0.5">{label}</p>
    </div>
  );
}
