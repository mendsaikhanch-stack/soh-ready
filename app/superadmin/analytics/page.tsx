'use client';

export default function AnalyticsPage() {
  const weeklyData = [
    { day: 'Даваа', logins: 45, payments: 12 },
    { day: 'Мягмар', logins: 52, payments: 8 },
    { day: 'Лхагва', logins: 48, payments: 15 },
    { day: 'Пүрэв', logins: 61, payments: 22 },
    { day: 'Баасан', logins: 55, payments: 18 },
    { day: 'Бямба', logins: 30, payments: 5 },
    { day: 'Ням', logins: 20, payments: 3 },
  ];

  const maxLogins = Math.max(...weeklyData.map(d => d.logins));

  const topFeatures = [
    { name: 'Төлбөр шалгах', usage: 85 },
    { name: 'Зарлал унших', usage: 72 },
    { name: 'Засвар хүсэлт', usage: 45 },
    { name: 'Тайлан харах', usage: 38 },
    { name: 'Санал хураалт', usage: 25 },
    { name: 'Холбоо барих', usage: 18 },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">📈 Аналитик</h1>
      <p className="text-gray-400 text-sm mb-6">Хэрэглээний статистик</p>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Өнөөдрийн нэвтрэлт', value: '61', change: '+12%' },
          { label: 'Идэвхтэй хэрэглэгч', value: '156', change: '+8%' },
          { label: 'Дундаж session', value: '4.2 мин', change: '+15%' },
          { label: 'Bounce rate', value: '12%', change: '-3%' },
        ].map(s => (
          <div key={s.label} className="bg-gray-800/50 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-xl font-bold">{s.value}</p>
              <span className={`text-xs ${s.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{s.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Weekly chart */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Долоо хоногийн нэвтрэлт</h2>
          <div className="flex items-end gap-2 h-40">
            {weeklyData.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-0.5" style={{ height: '120px' }}>
                  <div className="flex-1" />
                  <div className="bg-blue-500/80 rounded-t" style={{ height: `${(d.logins / maxLogins) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500">{d.day.slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature usage */}
        <div className="bg-gray-800/50 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Функцийн хэрэглээ</h2>
          <div className="space-y-3">
            {topFeatures.map(f => (
              <div key={f.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{f.name}</span>
                  <span className="text-gray-500">{f.usage}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${f.usage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
