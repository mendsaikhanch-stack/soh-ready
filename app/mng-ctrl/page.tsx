'use client';

// Суперадмины хянах самбар.
//
// Бүх тоог `/api/superadmin/customers`-аас авна — тэр нэг эх сурвалж нь
// «Хэрэглэгч СӨХ» хуудсыг ч тэжээдэг тул хоёр дэлгэц дээр өөр тоо гарахгүй.
// (Өмнө нь энэ хуудас anon холболтоор 1000+ мөр residents татаад дүнг өөрөө
// бодож, лавлахын хог мөрүүдийг СӨХ-ийн жагсаалтдаа оруулдаг байв.)

import { useState, useEffect } from 'react';
import { adminFrom } from '@/app/lib/admin-db';

interface Customer {
  id: number;
  name: string;
  address: string | null;
  claim_status: string;
  activated_at: string | null;
  created_at: string | null;
  is_demo: boolean;
  apartments: number;
  debt_total: number;
  debtors: number;
  monthly_fee: number;
  setup_fee: number;
  billing_active: boolean;
  free_months: number;
  unpaid_total: number;
  accounts: number;
  signed_in: number;
  active_30d: number;
  last_login_at: string | null;
}

interface Totals {
  customers: number;
  active: number;
  apartments: number;
  residents: number;
  resident_debt: number;
  debtors: number;
  new_residents_this_month: number;
  new_customers_this_month: number;
  monthly_billable: number;
  monthly_when_all_billing: number;
  setup_expected: number;
  paid_total: number;
  unpaid_total: number;
  directory_total: number;
  accounts: number;
  signed_in: number;
  active_7d: number;
  active_30d: number;
  admin_accounts: number;
  admins_signed_in: number;
  admins_active_30d: number;
}

interface RecentResident {
  sokh_id: number;
  name: string | null;
  created_at: string;
}

interface ErrorRow {
  created_at: string;
  level: string;
  message: string;
  source?: string;
  route?: string;
}

const money = (n: number) => `${Math.round(n).toLocaleString()}₮`;

export default function SuperAdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [recent, setRecent] = useState<RecentResident[]>([]);
  const [loading, setLoading] = useState(true);
  // Ачаалсан агшин. «N цагийн өмнө» гэдгийг үүнээс тоолно — render бүрд
  // Date.now() дуудвал ижил өгөгдөл дээр өөр үр дүн гарна.
  const [loadedAt, setLoadedAt] = useState(0);
  const [errorStats, setErrorStats] = useState({ today: 0, fatal: 0, recentErrors: [] as ErrorRow[] });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/superadmin/customers');
        const data = await res.json();
        setCustomers(data.customers || []);
        setTotals(data.totals || null);
        setRecent(data.recent_residents || []);
      } catch {
        // сүлжээний алдаа — доор хоосон харагдана
      }

      // Алдааны статистик
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: recentErrors } = await adminFrom('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        const allErrors = (Array.isArray(recentErrors) ? recentErrors : []) as unknown as ErrorRow[];
        setErrorStats({
          today: allErrors.filter(e => new Date(e.created_at) >= todayStart).length,
          fatal: allErrors.filter(e => e.level === 'fatal').length,
          recentErrors: allErrors.slice(0, 5),
        });
      } catch {
        // error_logs хүснэгт үүсээгүй бол алгасах
      }

      setLoadedAt(Date.now());
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Ачаалж байна...</div>;

  const real = customers.filter(c => !c.is_demo);
  const plusLabel = (n: number) => (n > 0 ? `+${n} энэ сард` : 'энэ сард 0');

  const statCards = totals
    ? [
        {
          label: 'Хэрэглэгч СӨХ',
          value: totals.active,
          icon: '🏢',
          change: plusLabel(totals.new_customers_this_month),
          color: 'from-blue-600 to-blue-700',
        },
        {
          label: 'Нийт айл',
          value: totals.apartments.toLocaleString(),
          icon: '👥',
          change: plusLabel(totals.new_residents_this_month),
          color: 'from-purple-600 to-purple-700',
        },
        {
          label: 'Сард орох төлбөр',
          value: money(totals.monthly_billable),
          icon: '💵',
          change:
            totals.monthly_billable < totals.monthly_when_all_billing
              ? `бүрэн: ${money(totals.monthly_when_all_billing)}`
              : 'бүрэн',
          color: 'from-green-600 to-green-700',
        },
        {
          label: 'Лавлахад',
          value: totals.directory_total.toLocaleString(),
          icon: '📇',
          change: 'хэрэглэгч биш',
          color: 'from-yellow-600 to-yellow-700',
        },
      ]
    : [];

  // Сүүлийн үйл ажиллагаа — СӨХ идэвхжсэн + айл бүртгүүлсэн
  const ago = (iso: string) => {
    const mins = Math.floor((loadedAt - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)} мин`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} цаг`;
    return `${Math.floor(hours / 24)} хоног`;
  };

  const orgName = new Map<number, string>(customers.map(c => [c.id, c.name]));

  const activity = [
    ...customers
      .filter(c => c.activated_at)
      .map(c => ({ at: c.activated_at as string, icon: '🏢', text: `${c.name} идэвхжсэн` })),
    ...recent.map(r => ({
      at: r.created_at,
      icon: '👥',
      text: `${orgName.get(r.sokh_id) || 'СӨХ'} — ${r.name || 'оршин суугч'} бүртгүүлсэн`,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Хянах самбар</h1>
          <p className="text-gray-400 text-sm mt-1">Платформын ерөнхий байдал</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs">Сүүлд шинэчлэгдсэн</p>
          <p className="text-gray-300 text-sm">{new Date().toLocaleDateString('mn-MN')}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(c => (
          <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-2xl p-5`}>
            <div className="flex justify-between items-start">
              <span className="text-2xl">{c.icon}</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{c.change}</span>
            </div>
            <p className="text-2xl font-bold mt-3">{c.value}</p>
            <p className="text-white/70 text-sm mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* СӨХ жагсаалт */}
        <div className="col-span-2 bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="font-semibold">Системд орсон СӨХ</h2>
              <p className="text-xs text-gray-500">Айлын тоо ба Хотолд төлөх төлбөр</p>
            </div>
            <a href="/mng-ctrl/customers" className="text-xs text-blue-400 hover:underline">
              Дэлгэрэнгүй →
            </a>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left pb-3">СӨХ</th>
                <th className="text-center pb-3">Айл</th>
                <th className="text-center pb-3">Нэвтэрсэн</th>
                <th className="text-right pb-3">Суурилуулалт</th>
                <th className="text-right pb-3">Сарын төлбөр</th>
                <th className="text-right pb-3">Айлын өр</th>
                <th className="text-center pb-3">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(o => (
                <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3">
                    <p className="text-sm font-medium">
                      {o.name}
                      {o.is_demo && <span className="ml-2 text-[10px] text-gray-600">туршилт</span>}
                    </p>
                    <p className="text-xs text-gray-500">{o.address || '—'}</p>
                  </td>
                  <td className="text-center text-sm">{o.apartments || '—'}</td>
                  <td className="text-center text-sm">
                    {o.accounts ? (
                      <>
                        <span className={o.signed_in ? 'text-white' : 'text-gray-500'}>
                          {o.signed_in}
                        </span>
                        <span className="text-gray-600"> / {o.accounts}</span>
                      </>
                    ) : (
                      <span className="text-gray-600">бүртгэлгүй</span>
                    )}
                  </td>
                  <td className="text-right text-sm">{o.apartments ? money(o.setup_fee) : '—'}</td>
                  <td className="text-right text-sm">{o.apartments ? money(o.monthly_fee) : '—'}</td>
                  <td className="text-right text-sm text-gray-400">
                    {o.debt_total > 0 ? money(o.debt_total) : '0₮'}
                  </td>
                  <td className="text-center">
                    {o.claim_status !== 'active' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">Идэвхжээгүй</span>
                    ) : o.apartments === 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/50 text-red-400">Өгөгдөл алга</span>
                    ) : !o.billing_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-400">
                        Үнэгүй {o.free_months} сар
                      </span>
                    ) : o.unpaid_total > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400">
                        {money(o.unpaid_total)} авах
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400">Төлсөн</span>
                    )}
                  </td>
                </tr>
              ))}
              {totals && (
                <tr className="font-semibold">
                  <td className="py-3 text-sm text-gray-400">Нийт (туршилтыг оруулаагүй)</td>
                  <td className="text-center text-sm">{totals.apartments.toLocaleString()}</td>
                  <td className="text-center text-sm">
                    {totals.signed_in} <span className="text-gray-600 font-normal">/ {totals.accounts}</span>
                  </td>
                  <td className="text-right text-sm">{money(totals.setup_expected)}</td>
                  <td className="text-right text-sm">{money(totals.monthly_when_all_billing)}</td>
                  <td className="text-right text-sm text-gray-400">{money(totals.resident_debt)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          {/* Апп ашиглалт — хэдэн айл жинхэнэ хэрэглэж байна */}
          {totals && (
            <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
              <h2 className="font-semibold mb-1">Апп ашиглалт</h2>
              <p className="text-xs text-gray-500 mb-4">Оршин суугчид үнэхээр нэвтэрч байна уу</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-400">Бүртгэлтэй айл</dt>
                  <dd>{totals.residents.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Нэвтрэх эрхтэй</dt>
                  <dd>{totals.accounts.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Нэвтэрч үзсэн</dt>
                  <dd className={totals.signed_in > 0 ? 'text-green-400 font-semibold' : 'text-amber-400'}>
                    {totals.signed_in.toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Сүүлийн 30 хоногт</dt>
                  <dd>{totals.active_30d.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-400">Сүүлийн 7 хоногт</dt>
                  <dd>{totals.active_7d.toLocaleString()}</dd>
                </div>
              </dl>
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">СӨХ-ийн дарга</span>
                  <span>
                    {totals.admins_signed_in} / {totals.admin_accounts}
                    <span className="text-gray-600"> нэвтэрсэн</span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Дарга — 30 хоногт</span>
                  <span>{totals.admins_active_30d}</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
                Апп нээлттэй хэвээр байгаа хүн дахин нэвтэрдэггүй тул «7 хоногт»
                тоо бодит хэрэглээнээс бага гарч болно.
              </p>
            </div>
          )}

          {/* Төлбөрийн байдал */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Хотолын орлого</h2>
            {totals && (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Төлөгдсөн</dt>
                    <dd className="text-green-400 font-semibold">{money(totals.paid_total)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Төлөгдөөгүй</dt>
                    <dd className={totals.unpaid_total > 0 ? 'text-amber-400 font-semibold' : ''}>
                      {money(totals.unpaid_total)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Сард орох (одоо)</dt>
                    <dd>{money(totals.monthly_billable)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Үнэгүй хугацаа дуусахад</dt>
                    <dd>{money(totals.monthly_when_all_billing)}</dd>
                  </div>
                </dl>
                <div className="mt-4 pt-4 border-t border-gray-700 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Идэвхтэй СӨХ</span>
                    <span>{totals.active} / {totals.customers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Дундаж хэмжээ</span>
                    <span>
                      {totals.active > 0 ? Math.round(totals.apartments / totals.active) : 0} айл/СӨХ
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Өртэй айл</span>
                    <span>{totals.debtors} / {totals.residents}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Анхаарах зүйл */}
          {(() => {
            const noData = real.filter(c => c.claim_status === 'active' && c.apartments === 0);
            const unpaid = real.filter(c => c.unpaid_total > 0);
            if (!noData.length && !unpaid.length) return null;
            return (
              <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
                <h2 className="font-semibold mb-3">Анхаарах</h2>
                <ul className="space-y-2 text-sm">
                  {noData.map(c => (
                    <li key={`n-${c.id}`} className="text-gray-300">
                      <span className="text-red-400">●</span> {c.name} — идэвхжсэн ч айл ороогүй
                    </li>
                  ))}
                  {unpaid.map(c => (
                    <li key={`u-${c.id}`} className="text-gray-300">
                      <span className="text-amber-400">●</span> {c.name} — {money(c.unpaid_total)} төлөгдөөгүй
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* System health — бодит алдааны мэдээлэл */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Системийн байдал</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Өнөөдрийн алдаа</span>
                <span className="flex items-center gap-1">
                  {errorStats.today === 0 ? '🟢' : errorStats.today < 5 ? '🟡' : '🔴'} {errorStats.today}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Ноцтой алдаа (fatal)</span>
                <span className="flex items-center gap-1">
                  {errorStats.fatal === 0 ? '🟢' : '🔴'} {errorStats.fatal}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Database</span>
                <span className="flex items-center gap-1">🟢 Хэвийн</span>
              </div>
            </div>
            {errorStats.recentErrors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Сүүлийн алдаанууд:</p>
                <div className="space-y-2">
                  {errorStats.recentErrors.map((e, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={e.level === 'fatal' ? 'text-red-400' : 'text-yellow-400'}>
                          {e.level === 'fatal' ? '!!!' : '!'}
                        </span>
                        <span className="text-gray-300 truncate flex-1">{e.message}</span>
                      </div>
                      <div className="flex gap-2 text-gray-600 ml-4">
                        <span>{e.source}</span>
                        {e.route && <span>{e.route}</span>}
                        <span>{new Date(e.created_at).toLocaleString('mn-MN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="bg-gray-800/50 rounded-2xl border border-gray-800 p-5">
            <h2 className="font-semibold mb-4">Сүүлийн үйл ажиллагаа</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-gray-500">Одоогоор бүртгэл алга</p>
            ) : (
              <div className="space-y-3">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300">{a.text}</p>
                      <p className="text-xs text-gray-600">{ago(a.at)}-ийн өмнө</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
