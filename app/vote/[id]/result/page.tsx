'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ProposalFull {
  id: number;
  title: string;
  description: string | null;
  budget_amount: number | null;
  status: string;
  kind: string;
  org_name: string | null;
  pass_threshold_percentage: number;
  auto_approve_on_timeout: boolean;
  created_at: string;
  expires_at: string;
  finalized_at: string | null;
}
interface Tally {
  approve: number;
  disapprove: number;
  abstain: number;
  auto: number;
  voted: number;
  total: number;
}
interface Row {
  full_name: string | null;
  phone: string;
  voted: boolean;
  vote_value: string | null;
  comment: string | null;
  is_auto: boolean;
  voted_at: string | null;
}

// Протоколын тайлбар өгүүлбэр — дүрмийн үр дүнг үгээр илэрхийлнэ
function buildNarrative(p: ProposalFull, t: Tally): string {
  const percentApprove = t.total > 0 ? Math.round((t.approve / t.total) * 100) : 0;
  let s = `Нийт ${t.total} гишүүнээс ${t.approve} нь зөвшөөрсөн (${percentApprove}%)`;
  if (t.auto > 0) {
    s += `, үүний ${t.auto} нь хугацаандаа хариу өгөөгүй тул дүрмийн дагуу автоматаар "Зөвшөөрсөн"-д тооцогдсон`;
  }
  s += '. ';
  if (p.status === 'passed') s += `Босго ${p.pass_threshold_percentage}%-ийг давсан тул шийдвэр хүчин төгөлдөр боллоо.`;
  else if (p.status === 'rejected') s += `Босго ${p.pass_threshold_percentage}%-д хүрээгүй тул шийдвэр батлагдсангүй.`;
  else s += `Санал хураалт үргэлжилж байна (босго ${p.pass_threshold_percentage}%).`;
  return s;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Идэвхтэй',
  passed: 'Батлагдсан',
  rejected: 'Татгалзсан',
  expired: 'Хугацаа дууссан',
  cancelled: 'Цуцлагдсан',
};
const VOTE_LABEL: Record<string, string> = {
  approve: 'Зөвшөөрсөн',
  disapprove: 'Татгалзсан',
  abstain: 'Түдгэлзсэн',
};

export default function ResultPage() {
  const params = useParams();
  const proposalId = parseInt(String(params.id), 10);

  const [proposal, setProposal] = useState<ProposalFull | null>(null);
  const [tally, setTally] = useState<Tally | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const k = new URLSearchParams(window.location.search).get('k') || '';
    try {
      const res = await fetch(`/api/vote/${proposalId}/protocol?k=${encodeURIComponent(k)}`);
      const data = await res.json();
      if (res.ok) {
        setProposal(data.proposal);
        setTally(data.tally);
        setRows(data.rows);
      } else {
        setError(data.error || 'Уншиж чадсангүй');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const printProtocol = () => {
    if (!proposal || !tally) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const pct = (n: number) => Math.round((n / (tally.total || 1)) * 100);
    const narrative = buildNarrative(proposal, tally);
    win.document.write(`
      <html><head><title>Хурлын протокол — ${proposal.title}</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .muted { color: #666; font-size: 12px; }
        .badge { display:inline-block; padding:4px 10px; border-radius:6px; background:#f3f4f6; font-size:12px; font-weight:600; margin-top:8px; }
        .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; margin:16px 0; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th, td { border:1px solid #ddd; padding:8px; font-size:12px; text-align:left; }
        th { background:#f5f5f5; }
        .stats { display:flex; gap:12px; margin:16px 0; }
        .stat { flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:10px; text-align:center; }
        .stat b { font-size:20px; display:block; }
        .sign { margin-top:48px; display:flex; justify-content:space-between; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>ЦАХИМ ТУЗ-ИЙН ХУРЛЫН ПРОТОКОЛ</h1>
      <div class="muted">${proposal.org_name || 'Хотол'} · ${new Date(proposal.created_at).toLocaleDateString('mn-MN')}</div>
      <div class="badge">Шийдвэр: ${STATUS_LABEL[proposal.status] || proposal.status}</div>

      <div class="box">
        <strong>Асуудал:</strong> ${escapeHtml(proposal.title)}<br/>
        ${proposal.description ? `<span class="muted">${escapeHtml(proposal.description)}</span><br/>` : ''}
        ${proposal.budget_amount != null ? `<strong>Төсөв:</strong> ${Number(proposal.budget_amount).toLocaleString()}₮<br/>` : ''}
        <span class="muted">Батлах босго: зөвшөөрөл ≥ ${proposal.pass_threshold_percentage}%${proposal.auto_approve_on_timeout ? ' · Хугацаа хэтэрвэл хариу өгөөгүйг зөвшөөрсөнд тооцно' : ''}</span>
      </div>

      <div class="stats">
        <div class="stat"><b>${tally.approve}</b>Зөвшөөрсөн (${pct(tally.approve)}%)</div>
        <div class="stat"><b>${tally.disapprove}</b>Татгалзсан (${pct(tally.disapprove)}%)</div>
        <div class="stat"><b>${tally.abstain}</b>Түдгэлзсэн (${pct(tally.abstain)}%)</div>
        <div class="stat"><b>${tally.voted}/${tally.total}</b>Оролцоо</div>
      </div>

      <div class="box" style="background:#f9fafb">
        <strong>Дүгнэлт:</strong> ${escapeHtml(narrative)}
      </div>

      <table>
        <thead><tr><th>№</th><th>Гишүүн</th><th>Утас</th><th>Санал</th><th>Сэтгэгдэл</th><th>Огноо</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r, i) => `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.full_name || '-')}</td>
            <td>${r.phone}</td>
            <td>${r.voted ? (VOTE_LABEL[r.vote_value || ''] || r.vote_value) + (r.is_auto ? ' (авто)' : '') : '— (өгөөгүй)'}</td>
            <td>${escapeHtml(r.comment || '')}</td>
            <td>${r.voted_at ? new Date(r.voted_at).toLocaleString('mn-MN') : ''}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <div class="sign">
        <div>Хурал даргалагч: _______________</div>
        <div>Нарийн бичиг: _______________</div>
      </div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Ачаалж байна...</div>;
  if (!proposal || !tally) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-500">{error || 'Мэдээлэл олдсонгүй'}</p>
      </div>
    );
  }

  const pct = (n: number) => Math.round((n / (tally.total || 1)) * 100);
  const bars = [
    { label: 'Зөвшөөрсөн', n: tally.approve, cls: 'bg-green-500' },
    { label: 'Татгалзсан', n: tally.disapprove, cls: 'bg-red-500' },
    { label: 'Түдгэлзсэн', n: tally.abstain, cls: 'bg-gray-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xl font-bold text-blue-600">Хотол</div>
            <p className="text-xs text-gray-400">Санал хураалтын үр дүн</p>
          </div>
          <button
            onClick={printProtocol}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            📄 Протокол хэвлэх (PDF)
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {proposal.org_name && <p className="text-xs text-gray-400 mb-1">{proposal.org_name}</p>}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold text-gray-900">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
          {proposal.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{proposal.description}</p>}
          {proposal.budget_amount != null && (
            <p className="mt-3 text-sm font-semibold text-amber-700">Төсөв: {Number(proposal.budget_amount).toLocaleString()}₮</p>
          )}

          <div className="my-5 border-t border-gray-100" />

          {/* График */}
          <p className="text-xs text-gray-400 mb-3">{tally.voted}/{tally.total} гишүүн санал өгсөн</p>
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>{b.label}</span>
                  <span className="font-semibold">{b.n} ({pct(b.n)}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${b.cls} rounded-full`} style={{ width: `${pct(b.n)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Дүрмийн дагуух дүгнэлт */}
          <div className="mt-5 bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-sm text-gray-700 leading-relaxed">
            {buildNarrative(proposal, tally)}
          </div>
        </div>

        {/* Протокол хүснэгт */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
          <h2 className="font-semibold text-gray-800 mb-3">Гишүүдийн санал</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-2">Гишүүн</th>
                  <th className="py-2 pr-2">Санал</th>
                  <th className="py-2">Сэтгэгдэл</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 pr-2">
                      <div className="text-gray-800">{r.full_name || '-'}</div>
                      <div className="text-xs text-gray-400">{r.phone}</div>
                    </td>
                    <td className="py-2 pr-2">
                      {r.voted ? (
                        <span className="inline-flex items-center gap-1.5">
                          <VoteTag value={r.vote_value!} />
                          {r.is_auto && <span className="text-[10px] font-medium text-amber-600">авто</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">Өгөөгүй</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500 text-xs">{r.comment || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'passed'
      ? 'bg-green-100 text-green-700'
      : status === 'rejected'
      ? 'bg-red-100 text-red-700'
      : status === 'active'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

function VoteTag({ value }: { value: string }) {
  const cls =
    value === 'approve'
      ? 'bg-green-50 text-green-700'
      : value === 'disapprove'
      ? 'bg-red-50 text-red-700'
      : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{VOTE_LABEL[value] || value}</span>;
}
