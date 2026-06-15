'use client';

import {
  sokh, residents, recentPayments, announcements, maintenanceRequests,
  incomeData, expenseData, parkingVehicles, guestVehicles, easyBoxStats, easyBoxRecent,
  aiActions, complaints, utilities, utilityReadings, staff, emergencyContacts, emergencyAlerts,
  polls, messageThreads, marketplaceItems, bookableSpaces, bookings, financeSummary, financeLedger,
  packages, shops, cameras, importHistory, directoryStats, directorySample, demandStats, demandFeed,
  elevators, workflowRules, reviewQueue, featureToggles,
} from '@/app/lib/demo/admin-mock';

const fmt = (n: number) => n.toLocaleString();
const debtCount = residents.filter((r) => r.debt > 0).length;
const totalIncome = incomeData.reduce((s, d) => s + d.amount, 0);
const totalExpense = expenseData.reduce((s, d) => s + d.amount, 0);

// ─────────── Shared UI ───────────

export function StatCard({ icon, label, value, cls }: { icon: string; label: string; value: string; cls?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`text-3xl font-bold ${cls || ''}`}>{value}</span>
      </div>
      <p className="text-sm text-gray-500 mt-2">{label}</p>
    </div>
  );
}

function Row({ label, value, valueCls }: { label: string; value: string; valueCls?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${valueCls || ''}`}>{value}</span>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-500 mb-3">{children}</h3>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border shadow-sm ${className}`}>{children}</div>;
}

function Btn({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
      primary ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border text-gray-700 hover:bg-gray-50'
    }`}>{children}</button>
  );
}

// ─────────── Screens ───────────

export function Dashboard({ onOpenAi }: { onOpenAi: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="👥" label="Нийт айл" value={String(sokh.totalResidents)} />
        <StatCard icon="⚠️" label="Өртэй айл" value={String(debtCount)} cls="text-red-500" />
        <StatCard icon="💰" label="Энэ сард цугласан" value={`${(sokh.totalPaid / 1e6).toFixed(1)}M₮`} cls="text-green-600" />
        <StatCard icon="📉" label="Үлдсэн өр" value={`${(sokh.totalDebt / 1e6).toFixed(1)}M₮`} cls="text-red-500" />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2 p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">Цуглуулалтын явц (4-р сар)</h3>
            <span className="text-2xl font-bold text-blue-600">{sokh.collectionRate}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full" style={{ width: `${sokh.collectionRate}%` }} />
          </div>
          <div className="flex justify-between mt-3 text-sm">
            <span className="text-green-600 font-semibold">+{fmt(sokh.totalPaid)}₮ цугласан</span>
            <span className="text-red-500 font-semibold">-{fmt(sokh.totalDebt)}₮ өр</span>
          </div>
        </Card>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 shadow-sm text-white flex flex-col justify-between">
          <div>
            <p className="text-2xl">🧠</p>
            <h3 className="font-semibold mt-1">AI туслах</h3>
            <p className="text-xs text-white/80 mt-1">Сануулга, тайлан, дүгнэлтийг нэг товчоор бэлдэнэ.</p>
          </div>
          <button onClick={onOpenAi} className="mt-4 bg-white/15 hover:bg-white/25 transition rounded-lg py-2 text-sm font-semibold">
            AI туслах нээх →
          </button>
        </div>
      </div>
      <div>
        <Title>АНХААРАЛ ШААРДЛАГАТАЙ</Title>
        <div className="grid grid-cols-3 gap-4">
          <Attention icon="🔧" title="Хүлээгдэж буй засвар" sub={`${sokh.pendingMaintenance} хүсэлт хариу хүлээж байна`} cls="bg-orange-50 border-orange-200 text-orange-700" />
          <Attention icon="📝" title="Гомдол / Санал" sub={`${sokh.pendingComplaints} шинэ хүсэлт`} cls="bg-purple-50 border-purple-200 text-purple-700" />
          <Attention icon="💸" title="Их өртэй айл" sub="2 айл 200,000₮-аас дээш өртэй" cls="bg-red-50 border-red-200 text-red-700" />
        </div>
      </div>
    </div>
  );
}

function Attention({ icon, title, sub, cls }: { icon: string; title: string; sub: string; cls: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs opacity-80">{sub}</p></div>
      <span className="text-xl opacity-50">›</span>
    </div>
  );
}

export function Residents() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2"><Btn primary>+ Шинэ айл</Btn><Btn>📥 Excel оруулах</Btn></div>
        <div className="flex gap-3 text-sm">
          <span className="text-gray-500">Нийт: <b className="text-gray-900">{residents.length}</b></span>
          <span className="text-gray-500">Өртэй: <b className="text-red-500">{debtCount}</b></span>
          <span className="text-gray-500">Төлсөн: <b className="text-green-600">{residents.length - debtCount}</b></span>
        </div>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr><th className="text-left font-medium px-5 py-3">Оршин суугч</th><th className="text-left font-medium px-5 py-3">Тоот</th><th className="text-left font-medium px-5 py-3">Утас</th><th className="text-right font-medium px-5 py-3">Төлбөрийн байдал</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {residents.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">{r.name.charAt(0)}</div><span className="font-medium">{r.name}</span></div></td>
                <td className="px-5 py-3 text-gray-600">🏠 {r.apt}</td>
                <td className="px-5 py-3 text-gray-600">📞 {r.phone}</td>
                <td className="px-5 py-3 text-right">{r.debt > 0 ? <span className="text-red-500 font-bold">{fmt(r.debt)}₮ өртэй</span> : <span className="text-green-600 font-medium">✅ Төлсөн</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function Payments() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-sm">
          <p className="text-sm opacity-90">Энэ сард цугласан</p>
          <p className="text-3xl font-bold mt-1">{fmt(sokh.totalPaid)}₮</p>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between">
            <div><p className="text-xs opacity-80">Цуглуулалт</p><p className="text-lg font-bold">{sokh.collectionRate}%</p></div>
            <div className="text-right"><p className="text-xs opacity-80">Үлдсэн өр</p><p className="text-lg font-bold">{fmt(sokh.totalDebt)}₮</p></div>
          </div>
        </div>
        <Card className="col-span-2 p-6 flex flex-col justify-center gap-3">
          <h3 className="font-semibold text-gray-700">Үйлдэл</h3>
          <div className="flex gap-3"><Btn>📤 Тайлан татах</Btn><Btn>🔔 Өртэй айлд сануулах</Btn><Btn primary>+ Гар төлбөр бүртгэх</Btn></div>
        </Card>
      </div>
      <div>
        <Title>СҮҮЛИЙН ОРЛОГО</Title>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="text-left font-medium px-5 py-3">Оршин суугч</th><th className="text-left font-medium px-5 py-3">Тоот</th><th className="text-left font-medium px-5 py-3">Хэлбэр</th><th className="text-left font-medium px-5 py-3">Огноо</th><th className="text-right font-medium px-5 py-3">Дүн</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {recentPayments.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50"><td className="px-5 py-3 font-medium">{p.name}</td><td className="px-5 py-3 text-gray-600">{p.apt}</td><td className="px-5 py-3"><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{p.method}</span></td><td className="px-5 py-3 text-gray-400 text-xs">{p.date}</td><td className="px-5 py-3 text-right text-green-600 font-bold">+{fmt(p.amount)}₮</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function Finance() {
  const f = financeSummary;
  const reservePct = Math.round((f.reserveFund / f.reserveTarget) * 100);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="📊" label="Сарын төсөв" value={`${(f.budget / 1e6).toFixed(1)}M₮`} />
        <StatCard icon="💸" label="Зарцуулсан" value={`${(f.spent / 1e6).toFixed(1)}M₮`} cls="text-red-500" />
        <StatCard icon="🏦" label="Нөөц сан" value={`${(f.reserveFund / 1e6).toFixed(1)}M₮`} cls="text-blue-600" />
      </div>
      <Card className="p-6">
        <div className="flex justify-between items-center mb-2"><h3 className="font-semibold text-gray-700">Нөөц сангийн зорилт</h3><span className="text-sm text-gray-500">{reservePct}% ({fmt(f.reserveFund)}/{fmt(f.reserveTarget)}₮)</span></div>
        <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-blue-500 h-3 rounded-full" style={{ width: `${reservePct}%` }} /></div>
      </Card>
      <div>
        <Title>ГҮЙЛГЭЭНИЙ ТҮҮХ</Title>
        <Card className="divide-y">
          {financeLedger.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-5 py-3">
              <div><p className="text-sm font-medium">{l.label}</p><p className="text-xs text-gray-400">{l.date}</p></div>
              <span className={`font-bold text-sm ${l.type === 'in' ? 'text-green-600' : 'text-red-500'}`}>{l.type === 'in' ? '+' : '-'}{fmt(l.amount)}₮</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function Announcements() {
  return (
    <div className="space-y-4">
      <Btn primary>+ Шинэ зарлал илгээх</Btn>
      <div className="grid grid-cols-3 gap-4">
        {announcements.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-2 mb-3"><span className="text-2xl">{a.type}</span><div className="flex-1"><h3 className="font-semibold text-sm">{a.title}</h3><p className="text-xs text-gray-400">Хүлээн авагч: {a.target} · {a.date}</p></div></div>
            <div className="flex justify-between items-center pt-3 border-t"><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ {a.status}</span><span className="text-xs text-gray-500">👁 {a.views} харсан</span></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Messages() {
  return (
    <div className="space-y-4">
      <Title>ХАРИЛЦАН ЯРИА</Title>
      <Card className="divide-y max-w-2xl">
        {messageThreads.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">{t.name.charAt(0)}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-gray-500 truncate">{t.last}</p></div>
            <div className="text-right"><p className="text-xs text-gray-400">{t.time}</p>{t.unread > 0 && <span className="inline-block mt-1 text-[10px] bg-blue-600 text-white px-1.5 rounded-full">{t.unread}</span>}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function Complaints() {
  const meta = (s: string) => s === 'new' ? { cls: 'bg-yellow-100 text-yellow-700', l: 'Шинэ' } : s === 'review' ? { cls: 'bg-blue-100 text-blue-700', l: 'Хянаж буй' } : { cls: 'bg-green-100 text-green-700', l: 'Шийдсэн' };
  return (
    <div className="space-y-4">
      <Title>ГОМДОЛ / САНАЛ</Title>
      <Card className="divide-y">
        {complaints.map((c) => {
          const m = meta(c.status);
          return (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'Гомдол' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{c.type}</span>
              <div className="flex-1"><p className="text-sm font-medium">{c.title}</p><p className="text-xs text-gray-400">{c.resident} · {c.date}</p></div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${m.cls}`}>{m.l}</span>
              <Btn primary>Хариу өгөх</Btn>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export function Polls() {
  return (
    <div className="space-y-4">
      <Btn primary>+ Шинэ санал хураалт</Btn>
      <div className="grid grid-cols-2 gap-6">
        {polls.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{p.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.status === 'active' ? 'Идэвхтэй' : 'Хаагдсан'}</span>
            </div>
            <div className="space-y-2">
              {p.options.map((o) => {
                const pct = Math.round((o.votes / p.total) * 100);
                return (
                  <div key={o.label}>
                    <div className="flex justify-between text-xs mb-0.5"><span>{o.label}</span><span className="font-semibold">{pct}% ({o.votes})</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">Нийт {p.total} санал</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Maintenance() {
  const pending = maintenanceRequests.filter((r) => r.status === 'pending').length;
  const inProgress = maintenanceRequests.filter((r) => r.status === 'in_progress').length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🕐" label="Хүлээгдэж буй" value={String(pending)} cls="text-yellow-600" />
        <StatCard icon="🔧" label="Хийгдэж буй" value={String(inProgress)} cls="text-blue-600" />
        <StatCard icon="✅" label="Дууссан (сар)" value="15" cls="text-green-600" />
      </div>
      <div>
        <Title>ИДЭВХТЭЙ ХҮСЭЛТҮҮД</Title>
        <div className="space-y-3">
          {maintenanceRequests.map((r) => {
            const statusCls = r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700';
            const statusLbl = r.status === 'pending' ? 'Хүлээгдэж буй' : 'Хийгдэж байна';
            const prCls = r.priority === 'high' ? 'bg-red-100 text-red-700' : r.priority === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600';
            const prLbl = r.priority === 'high' ? '🔴 Яаралтай' : r.priority === 'medium' ? '🟠 Дунд' : '⚪ Бага';
            return (
              <Card key={r.id} className="p-4 flex items-center gap-4">
                <div className="flex-1"><h3 className="font-medium text-sm">{r.title}</h3><p className="text-xs text-gray-500 mt-0.5">{r.resident} · {r.date}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${prCls}`}>{prLbl}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusCls}`}>{statusLbl}</span>
                <Btn primary>Хариу өгөх</Btn>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Elevator() {
  return (
    <div className="space-y-4">
      <Title>ЛИФТНИЙ ТӨЛӨВ</Title>
      <div className="grid grid-cols-3 gap-4">
        {elevators.map((e) => (
          <Card key={e.id} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">🛗 {e.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{e.status === 'ok' ? '● Хэвийн' : '🔧 Засвартай'}</span>
            </div>
            <p className="text-xs text-gray-500">Сүүлд үйлчилсэн: {e.lastService}</p>
            <p className="text-xs text-gray-500 mt-1">{e.note}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Utilities() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {utilities.map((u) => (
          <Card key={u.id} className="p-5">
            <div className="flex items-center justify-between"><span className="text-2xl">{u.icon}</span><span className={`text-sm font-semibold ${u.cls}`}>{u.change}</span></div>
            <p className="text-xl font-bold mt-2">{u.total}</p>
            <p className="text-sm text-gray-500">{u.label}</p>
          </Card>
        ))}
      </div>
      <div>
        <Title>ТООЛУУРЫН ЗААЛТ (4-р сар)</Title>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="text-left font-medium px-5 py-3">Тоот</th><th className="text-left font-medium px-5 py-3">Ус</th><th className="text-left font-medium px-5 py-3">Цахилгаан</th><th className="text-right font-medium px-5 py-3">Төлөв</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {utilityReadings.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50"><td className="px-5 py-3 font-medium">{r.apt}</td><td className="px-5 py-3 text-gray-600">{r.water}</td><td className="px-5 py-3 text-gray-600">{r.elec}</td><td className="px-5 py-3 text-right">{r.submitted ? <span className="text-green-600 text-xs">✓ Илгээсэн</span> : <span className="text-amber-600 text-xs">⏳ Хүлээгдэж буй</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function Packages() {
  return (
    <div className="space-y-4">
      <Title>ИЛГЭЭМЖИЙН БҮРТГЭЛ</Title>
      <Card className="divide-y">
        {packages.map((p) => (
          <div key={p.id} className="flex items-center gap-4 px-5 py-3">
            <span className="text-2xl">📦</span>
            <div className="flex-1"><p className="text-sm font-medium">{p.apt} <span className="text-gray-400 font-normal">· {p.from}</span></p><p className="text-xs text-gray-400">Ирсэн: {p.arrived}</p></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{p.status === 'waiting' ? 'Хүлээж буй' : 'Авсан'}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function Parking() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="🚗" label="Бүртгэлтэй машин" value={String(parkingVehicles.length)} cls="text-indigo-700" />
        <StatCard icon="🎫" label="Зочин хэтэрсэн" value={String(guestVehicles.filter((g) => g.overdue).length)} cls="text-amber-600" />
        <StatCard icon="🚙" label="Эзэлсэн зогсоол" value="12/30" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Title>🚙 МАШИНУУД</Title>
          <Card className="divide-y">
            {parkingVehicles.map((v) => (
              <div key={v.id} className="px-4 py-3 flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-lg">🚗</div><div className="flex-1 min-w-0"><p className="text-sm font-bold text-indigo-700">{v.plate}</p><p className="text-xs text-gray-500 truncate">{v.owner} ({v.apt}) · {v.model}</p></div><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{v.spot}</span></div>
            ))}
          </Card>
        </div>
        <div>
          <Title>🎫 ЗОЧНЫ МАШИН</Title>
          <Card className="divide-y">
            {guestVehicles.map((g) => (
              <div key={g.id} className="px-4 py-3 flex items-center justify-between"><div className="flex-1 min-w-0"><p className="text-sm font-bold">{g.plate}</p><p className="text-xs text-gray-500">→ {g.host} ({g.apt}) · {g.entered}-аас, {g.allowed} мин</p></div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g.overdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{g.overdue ? 'Хэтэрсэн' : 'Идэвхтэй'}</span></div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function Booking() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {bookableSpaces.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-center justify-between"><span className="text-2xl">{s.emoji}</span><span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'Чөлөөтэй' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span></div>
            <p className="font-semibold mt-2">{s.name}</p>
            <p className="text-xs text-gray-500">Өнөөдөр {s.today} захиалга</p>
          </Card>
        ))}
      </div>
      <div>
        <Title>ХУВААРЬ</Title>
        <Card className="divide-y">
          {bookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-medium">{b.space}</p><p className="text-xs text-gray-400">{b.who}</p></div><span className="text-xs text-gray-600">{b.when}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function EasyBox() {
  const occ = Math.round((easyBoxStats.occupied / easyBoxStats.totalBoxes) * 100);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="📦" label="Нийт хайрцаг" value={String(easyBoxStats.totalBoxes)} />
        <StatCard icon="🔒" label="Эзлэгдсэн" value={String(easyBoxStats.occupied)} cls="text-orange-600" />
        <StatCard icon="🔓" label="Чөлөөтэй" value={String(easyBoxStats.free)} cls="text-emerald-600" />
        <StatCard icon="📈" label="Эзэлгээ" value={`${occ}%`} />
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Title>📜 ӨНӨӨДРИЙН ЯВЦ</Title>
          <Card className="divide-y">
            {easyBoxRecent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3"><div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-700">{r.apt.charAt(0)}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium">{r.apt}</p><p className="text-xs text-gray-500 truncate">{r.sender}</p></div><span className="text-xs text-gray-400">{r.time}</span><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.state === 'waiting' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{r.state === 'waiting' ? 'Хүлээж буй' : 'Авсан'}</span></div>
            ))}
          </Card>
        </div>
        <div>
          <Title>📊 САРЫН ХУРААНГУЙ</Title>
          <Card className="p-4 space-y-3">
            <Row label="Нийт илгээмж" value={String(easyBoxStats.monthTotal)} />
            <Row label="Дундаж авах хугацаа" value={`${easyBoxStats.avgPickupHours} цаг`} />
            <Row label="Үйлчилгээний тогтвортой" value={`${easyBoxStats.uptime}%`} valueCls="text-green-600" />
          </Card>
        </div>
      </div>
    </div>
  );
}

export function Emergency() {
  return (
    <div className="space-y-6">
      <div>
        <Title>🆘 ЯАРАЛТАЙ ДУГААР</Title>
        <div className="grid grid-cols-4 gap-4">
          {emergencyContacts.map((c) => (
            <Card key={c.number} className="p-5 text-center"><div className="text-3xl">{c.icon}</div><p className="text-2xl font-bold mt-1">{c.number}</p><p className="text-xs text-gray-500">{c.label}</p></Card>
          ))}
        </div>
      </div>
      <div>
        <Title>МЭДЭГДЭЛ</Title>
        <Card className="divide-y">
          {emergencyAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-gray-400">{a.date}</p></div><span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'Идэвхтэй' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function Cctv() {
  return (
    <div className="space-y-4">
      <Title>📹 КАМЕРУУД ({cameras.filter((c) => c.status === 'online').length}/{cameras.length} онлайн)</Title>
      <div className="grid grid-cols-3 gap-4">
        {cameras.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
              <span className="text-4xl opacity-30">📹</span>
              <span className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.status === 'online' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{c.status === 'online' ? '● LIVE' : '✕ OFFLINE'}</span>
            </div>
            <div className="px-3 py-2"><p className="text-sm font-medium">{c.name}</p></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Staff() {
  return (
    <div className="space-y-4">
      <Btn primary>+ Ажилтан нэмэх</Btn>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="text-left font-medium px-5 py-3">Нэр</th><th className="text-left font-medium px-5 py-3">Үүрэг</th><th className="text-left font-medium px-5 py-3">Утас</th><th className="text-right font-medium px-5 py-3">Төлөв</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50"><td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">{s.name.charAt(0)}</div><span className="font-medium">{s.name}</span></div></td><td className="px-5 py-3 text-gray-600">{s.role}</td><td className="px-5 py-3 text-gray-600">📞 {s.phone}</td><td className="px-5 py-3 text-right"><span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'Идэвхтэй' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function Marketplace() {
  return (
    <div className="space-y-4">
      <Title>🏪 ХӨРШ МАРКЕТ — оршин суугчдын зар</Title>
      <div className="grid grid-cols-4 gap-4">
        {marketplaceItems.map((m) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="aspect-square bg-gray-50 flex items-center justify-center text-5xl">{m.emoji}</div>
            <div className="p-3"><p className="text-sm font-medium truncate">{m.title}</p><div className="flex justify-between items-center mt-1"><span className="text-sm font-bold text-blue-600">{m.price}</span><span className="text-xs text-gray-400">{m.seller}</span></div></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Shops() {
  return (
    <div className="space-y-4">
      <Title>🏪 ДЭЛГҮҮР & АВТОМАТ МАШИН</Title>
      <Card className="divide-y">
        {shops.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3"><span className="text-2xl">{s.type === 'Дэлгүүр' ? '🏪' : '🥤'}</span><div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-gray-400">{s.type} · {s.floor}</p></div></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'Идэвхтэй' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function AiCenter({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-700 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2"><h2 className="text-lg font-bold">🧠 AI туслах</h2><span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold">ШИНЭ</span></div>
        <p className="text-sm text-white/80 mt-1">Өгөгдлөө шалгаад → AI бичиж өгнө → админ хянана → зөвшөөрөөд ашиглана. Автомат илгээдэггүй.</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Title>⚡ AI ҮЙЛДЭЛ <span className="font-normal text-gray-400">— дарж жишээг үзнэ үү</span></Title>
          <div className="grid grid-cols-2 gap-3">
            {aiActions.map((a) => (
              <button key={a.id} onClick={() => onOpen(a.id)} className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3 hover:border-purple-300 hover:shadow transition text-left">
                <span className="text-2xl shrink-0">{a.emoji}</span><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{a.title}</p><p className="text-xs text-gray-500 truncate">{a.sub}</p></div><span className="text-purple-500">→</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Title>🗂️ ӨГӨГДЛИЙН БЭЛЭН БАЙДАЛ</Title>
          <Card className="p-4 space-y-2">
            {[{ label: 'Нэхэмжлэл (4-р сар)', count: 124, ready: true }, { label: 'Төлөөгүй нэхэмжлэл', count: 35, ready: true }, { label: 'Гомдол (4-р сар)', count: 3, ready: true }, { label: 'Засварын хүсэлт', count: 8, ready: true }, { label: 'Reserve fund бичилт', count: 0, ready: false }].map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-xs"><span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${r.ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{r.ready ? '✓ Бэлэн' : '∅ Хоосон'}</span><span className="flex-1">{r.label}</span><span className="text-gray-400 font-mono">{r.count}</span></div>
            ))}
          </Card>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mt-4">⚠️ AI зөвхөн санал гаргана. Тоог хүснэгтээс авна, өөрөө зохиохгүй. Илгээх эсэхийг та хариуцна.</div>
        </div>
      </div>
    </div>
  );
}

export function Workflows() {
  return (
    <div className="space-y-4">
      <Title>⚙️ АВТОМАТ ДҮРЭМ</Title>
      <Card className="divide-y">
        {workflowRules.map((w) => (
          <div key={w.id} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1"><p className="text-sm font-medium">{w.name}</p><p className="text-xs text-gray-400">Хэрэв: {w.trigger} → {w.action}</p></div>
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${w.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${w.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ReviewQueue() {
  return (
    <div className="space-y-4">
      <Title>📥 ХЯНАЛТЫН ДАРААЛАЛ — AI бэлдсэн, зөвшөөрөл хүлээж буй</Title>
      <Card className="divide-y">
        {reviewQueue.map((q) => (
          <div key={q.id} className="flex items-center gap-4 px-5 py-4">
            <span className="text-2xl">🧠</span>
            <div className="flex-1"><p className="text-sm font-medium">{q.title}</p><p className="text-xs text-gray-400">Дүрэм: {q.rule} · {q.date}</p></div>
            <Btn>👁 Үзэх</Btn><Btn primary>✓ Зөвшөөрөх</Btn>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function Reports() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="📥" label="Орлого" value={`${(totalIncome / 1e6).toFixed(1)}M₮`} cls="text-green-600" />
        <StatCard icon="📤" label="Зарлага" value={`${(totalExpense / 1e6).toFixed(1)}M₮`} cls="text-red-500" />
        <StatCard icon="💵" label="Үлдэгдэл" value={`${((totalIncome - totalExpense) / 1e6).toFixed(1)}M₮`} cls="text-blue-600" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-green-700 mb-4">📥 ОРЛОГО</h3>
          <div className="space-y-3">{incomeData.map((d) => (<div key={d.label}><div className="flex justify-between text-sm mb-1"><span>{d.label}</span><span className="font-semibold">{fmt(d.amount)}₮</span></div><div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${d.percent}%` }} /></div></div>))}</div>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-red-700 mb-4">📤 ЗАРЛАГА</h3>
          <div className="space-y-3">{expenseData.map((d) => (<div key={d.label}><div className="flex justify-between text-sm mb-1"><span>{d.label}</span><span className="font-semibold">{fmt(d.amount)}₮</span></div><div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-red-400 h-2 rounded-full" style={{ width: `${d.percent}%` }} /></div></div>))}</div>
        </Card>
      </div>
    </div>
  );
}

export function Demand() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="📈" label="Сонирхсон айл" value={String(demandStats.interested)} cls="text-blue-600" />
        <StatCard icon="👥" label="Нийт айл" value={String(demandStats.residents)} />
        <StatCard icon="✅" label="Хамрагдалт" value={`${demandStats.percent}%`} cls="text-green-600" />
      </div>
      <div>
        <Title>СҮҮЛИЙН ИДЭВХ</Title>
        <Card className="divide-y">
          {demandFeed.map((f) => (
            <div key={f.id} className="flex items-center justify-between px-5 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">{f.who.charAt(0)}</div><p className="text-sm">{f.who} — <span className="text-gray-500">{f.action}</span></p></div><span className="text-xs text-gray-400">{f.date}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function Directory() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="📚" label="Нийт СӨХ (сан)" value={fmt(directoryStats.total)} />
        <StatCard icon="✅" label="Бүртгүүлсэн" value={String(directoryStats.claimed)} cls="text-green-600" />
        <StatCard icon="📍" label="Энэ хороонд" value={String(directoryStats.thisKhoroo)} cls="text-blue-600" />
      </div>
      <div>
        <Title>СӨХ-ҮҮД</Title>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="text-left font-medium px-5 py-3">Нэр</th><th className="text-left font-medium px-5 py-3">Дүүрэг</th><th className="text-left font-medium px-5 py-3">Хороо</th><th className="text-right font-medium px-5 py-3">Төлөв</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {directorySample.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50"><td className="px-5 py-3 font-medium">{d.name}</td><td className="px-5 py-3 text-gray-600">{d.district}</td><td className="px-5 py-3 text-gray-600">{d.khoroo}</td><td className="px-5 py-3 text-right">{d.claimed ? <span className="text-green-600 text-xs">✓ Бүртгэлтэй</span> : <span className="text-gray-400 text-xs">— Чөлөөтэй</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

export function ImportScreen() {
  return (
    <div className="space-y-4">
      <Card className="p-8 border-2 border-dashed flex flex-col items-center justify-center text-center">
        <span className="text-4xl">📤</span>
        <p className="font-medium mt-2">Excel / CSV файл оруулах</p>
        <p className="text-xs text-gray-400 mt-1">Оршин суугч, төлбөр, тоолуурын мэдээллийг масс оруулна</p>
        <div className="mt-3"><Btn primary>Файл сонгох</Btn></div>
      </Card>
      <div>
        <Title>ИМПОРТЫН ТҮҮХ</Title>
        <Card className="divide-y">
          {importHistory.map((h) => (
            <div key={h.id} className="flex items-center justify-between px-5 py-3"><div><p className="text-sm font-medium font-mono">{h.file}</p><p className="text-xs text-gray-400">{h.rows} мөр · {h.date}</p></div><span className={`text-xs px-2 py-0.5 rounded-full ${h.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{h.status === 'done' ? '✓ Амжилттай' : '✕ Алдаа'}</span></div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function Branding() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6">
        <Title>🎨 ЛОГО</Title>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">Н</div>
          <Btn>Лого солих</Btn>
        </div>
      </Card>
      <Card className="p-6">
        <Title>ҮНДСЭН ӨНГӨ</Title>
        <div className="flex gap-3">
          {['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c'].map((c) => (
            <div key={c} className="w-12 h-12 rounded-lg border-2 border-white shadow ring-1 ring-gray-200" style={{ background: c }} />
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <Title>НЭР</Title>
        <input defaultValue={sokh.name} className="w-full border rounded-lg px-3 py-2 text-sm" readOnly />
      </Card>
    </div>
  );
}

export function Features() {
  return (
    <div className="space-y-4 max-w-2xl">
      <Title>🎛 ҮЙЛЧИЛГЭЭ ИДЭВХЖҮҮЛЭХ</Title>
      <Card className="divide-y">
        {featureToggles.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium">{f.label}</span>
            <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${f.on ? 'bg-blue-600' : 'bg-gray-300'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${f.on ? 'translate-x-4' : 'translate-x-0.5'}`} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}
