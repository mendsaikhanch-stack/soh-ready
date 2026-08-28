'use client';

// «Аль айл аппаа татаж нэвтэрсэн, аль нь ороогүй» — даргын хянах самбар
// болон Оршин суугчид хуудсанд хоёуланд нь хэрэгтэй тул тусдаа хэсэг.
//
// Өгөгдөл нь /api/admin/residents/app-usage-аас ирнэ (нэвтрэлтийн огноо нь
// Supabase-ийн auth хүснэгтэд байдаг тул энгийн хүснэгт уншиж болдоггүй).

export interface AppUsageResident {
  id: number;
  name: string | null;
  apartment: string | null;
  phone: string | null;
  building: string | null;
  pending_claim: boolean;
  unit_kind: string | null;
  has_account: boolean;
  last_sign_in_at: string | null;
}

export interface AppUsageSummary {
  total: number;
  with_account: number;
  signed_in: number;
  active_7d: number;
  active_30d: number;
  never_signed_in: number;
  no_account: number;
  no_phone: number;
}

export interface AppUsage {
  summary: AppUsageSummary;
  residents: AppUsageResident[];
}

export async function fetchAppUsage(): Promise<AppUsage | null> {
  try {
    const res = await fetch('/api/admin/residents/app-usage');
    if (!res.ok) return null;
    return (await res.json()) as AppUsage;
  } catch {
    return null;
  }
}

export const fmtDate = (t: string | null) =>
  t ? new Date(t).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';

function Chips({ rows, tone }: { rows: AppUsageResident[]; tone: 'in' | 'out' }) {
  if (!rows.length) return <p className="text-xs text-gray-400 py-2">Байхгүй</p>;
  return (
    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
      {rows.map(r => (
        <span
          key={r.id}
          title={`${r.name || ''}${r.phone ? ` · ${r.phone}` : ' · утас бүртгээгүй'}${
            r.last_sign_in_at ? ` · сүүлд ${fmtDate(r.last_sign_in_at)}` : ''
          }`}
          className={`text-xs px-2 py-1 rounded-md border ${
            tone === 'in'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}
        >
          {r.apartment || '—'}
        </span>
      ))}
    </div>
  );
}

export default function AppUsagePanel({ usage }: { usage: AppUsage }) {
  const { summary, residents } = usage;
  const pct = summary.total ? Math.round((summary.signed_in / summary.total) * 100) : 0;
  const signedIn = residents.filter(r => r.last_sign_in_at);
  const notYet = residents.filter(r => !r.last_sign_in_at);

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-semibold">📱 Апп татаж нэвтэрсэн айлууд</h2>
        <p className="text-sm text-gray-500">
          {summary.total} тоотоос <b className="text-gray-800">{summary.signed_in}</b> нь нэвтэрсэн ({pct}%)
          {summary.active_30d > 0 && <> &middot; сүүлийн сард {summary.active_30d} идэвхтэй</>}
        </p>
      </div>

      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>

      {summary.no_phone > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          ⚠️ {summary.no_phone} тоотод утасны дугаар бүртгэгдээгүй байна — тэд нэвтэрч чадахгүй.
          Оршин суугчид хэсгээс дугаарыг нь оруулаад «Нууц үг сэргээх» дарна уу.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-green-700 mb-2">
            ✅ Нэвтэрсэн — {signedIn.length}
          </p>
          <Chips rows={signedIn} tone="in" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">
            ⬜ Хараахан нэвтрээгүй — {notYet.length}
          </p>
          <Chips rows={notYet} tone="out" />
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        Тоот дээр хулганаа аваачвал нэр, утас, сүүлд нэвтэрсэн огноо харагдана.
      </p>
    </div>
  );
}
