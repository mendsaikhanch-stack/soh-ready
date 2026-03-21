'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Resident {
  id: number;
  name: string;
  apartment: string;
  phone: string;
  debt: number;
}

interface ScheduledNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  scheduled_at: string;
  created_at: string;
  status: string;
  target: string;
}

export default function AdminMessages() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'send' | 'scheduled'>('send');

  // Илгээх форм
  const [msgType, setMsgType] = useState<'debt' | 'announcement' | 'custom'>('debt');
  const [title, setTitle] = useState('');
  const [customText, setCustomText] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [target, setTarget] = useState<'all' | 'debtors'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: res }, { data: notifs }] = await Promise.all([
      supabase.from('residents').select('*').order('name'),
      supabase.from('scheduled_notifications').select('*').order('scheduled_at', { ascending: false }),
    ]);
    setResidents(res || []);
    setScheduled(notifs || []);
    setLoading(false);
  };

  const debtors = residents.filter(r => r.debt > 0);
  const totalDebt = debtors.reduce((s, r) => s + Number(r.debt), 0);

  // Автомат гарчиг + текст
  const getDefaults = () => {
    if (msgType === 'debt') {
      return {
        title: 'Төлбөрийн сануулга',
        message: `Нийт ${debtors.length} тоот ${totalDebt.toLocaleString()}₮ өртэй байна. Хугацаандаа төлнө үү.`,
      };
    }
    return { title, message: customText };
  };

  // Мэдэгдэл товлох
  const scheduleNotification = async () => {
    if (!scheduledDate) return;

    const defaults = getDefaults();
    if (!defaults.title || !defaults.message) {
      setSendResult('Гарчиг болон текст бөглөнө үү');
      return;
    }

    setSending(true);
    setSendResult(null);

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

    // sokh_id = 7 (одоогоор hardcoded, дараа dynamic болгоно)
    const { error } = await supabase.from('scheduled_notifications').insert({
      sokh_id: 7,
      title: defaults.title,
      message: defaults.message,
      type: msgType,
      scheduled_at: scheduledAt,
      status: 'pending',
      target: msgType === 'debt' ? 'debtors' : target,
    });

    if (error) {
      setSendResult('Алдаа: ' + error.message);
    } else {
      setSendResult('Мэдэгдэл амжилттай товлогдлоо!');
      setTitle('');
      setCustomText('');
      setScheduledDate('');
      setScheduledTime('09:00');
      fetchData();
    }

    setSending(false);
  };

  // Шууд илгээх (одоо)
  const sendNow = async () => {
    const defaults = getDefaults();
    if (!defaults.title || !defaults.message) {
      setSendResult('Гарчиг болон текст бөглөнө үү');
      return;
    }

    setSending(true);
    setSendResult(null);

    const { error } = await supabase.from('scheduled_notifications').insert({
      sokh_id: 7,
      title: defaults.title,
      message: defaults.message,
      type: msgType,
      scheduled_at: new Date().toISOString(),
      status: 'sent',
      target: msgType === 'debt' ? 'debtors' : target,
    });

    if (error) {
      setSendResult('Алдаа: ' + error.message);
    } else {
      setSendResult('Мэдэгдэл амжилттай илгээгдлээ!');
      setTitle('');
      setCustomText('');
      fetchData();
    }

    setSending(false);
  };

  // Мэдэгдэл цуцлах
  const cancelNotification = async (id: number) => {
    await supabase.from('scheduled_notifications').update({ status: 'cancelled' }).eq('id', id);
    fetchData();
  };

  // Мэдэгдэл устгах
  const deleteNotification = async (id: number) => {
    await supabase.from('scheduled_notifications').delete().eq('id', id);
    fetchData();
  };

  const statusColors: Record<string, { text: string; color: string }> = {
    pending: { text: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
    sent: { text: 'Илгээсэн', color: 'bg-green-100 text-green-700' },
    cancelled: { text: 'Цуцалсан', color: 'bg-gray-100 text-gray-500' },
  };

  const typeIcons: Record<string, string> = {
    debt: '💰',
    announcement: '📢',
    custom: '✉️',
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Өнөөдрийн огноо (min date-д хэрэглэнэ)
  const today = new Date().toISOString().split('T')[0];

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">💬 Мэдэгдэл илгээх</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab('send')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'send' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Мэдэгдэл үүсгэх
        </button>
        <button
          onClick={() => setTab('scheduled')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'scheduled' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Товлосон ({scheduled.filter(s => s.status === 'pending').length})
        </button>
      </div>

      {/* Send tab */}
      {tab === 'send' && (
        <div>
          {/* Төрөл сонгох */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">Мэдэгдлийн төрөл</h3>
            <div className="flex gap-2">
              {[
                { value: 'debt' as const, label: '💰 Өрийн сануулга' },
                { value: 'announcement' as const, label: '📢 Зарлал' },
                { value: 'custom' as const, label: '✉️ Чөлөөт' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setMsgType(t.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                    msgType === t.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Өрийн мэдэгдлийн тайлбар */}
          {msgType === 'debt' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-700">
              Өртэй {debtors.length} тоотод автомат сануулга илгээнэ. Нийт өр: {totalDebt.toLocaleString()}₮
            </div>
          )}

          {/* Гарчиг + текст (зарлал / чөлөөт) */}
          {(msgType === 'custom' || msgType === 'announcement') && (
            <div className="bg-white border rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Гарчиг</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Мэдэгдлийн гарчиг..."
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Агуулга</label>
                <textarea
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  placeholder="Мэдэгдлийн текст..."
                  className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
                />
              </div>
            </div>
          )}

          {/* Хүлээн авагч */}
          {msgType !== 'debt' && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Хүлээн авагч</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTarget('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    target === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  👥 Бүх оршин суугч ({residents.length})
                </button>
                <button
                  onClick={() => setTarget('debtors')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    target === 'debtors' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  💰 Өртэй ({debtors.length})
                </button>
              </div>
            </div>
          )}

          {/* Огноо товлох */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3">📅 Илгээх хугацаа</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Огноо</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  min={today}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Цаг</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Огноо сонговол тухайн өдөр автомат илгээнэ. Хоосон үлдээвэл шууд илгээнэ.
            </p>
          </div>

          {/* Амжилтын / алдааны мэдээ */}
          {sendResult && (
            <div className={`rounded-xl p-3 mb-4 text-sm border ${
              sendResult.startsWith('Алдаа')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {sendResult.startsWith('Алдаа') ? '❌' : '✅'} {sendResult}
            </div>
          )}

          {/* Товчнууд */}
          <div className="flex gap-3">
            {scheduledDate ? (
              <button
                onClick={scheduleNotification}
                disabled={sending}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                  !sending ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {sending ? 'Хадгалж байна...' : `📅 ${scheduledDate} өдөр товлох`}
              </button>
            ) : (
              <button
                onClick={sendNow}
                disabled={sending}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                  !sending ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {sending ? 'Илгээж байна...' : 'Одоо илгээх'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scheduled tab */}
      {tab === 'scheduled' && (
        <div>
          {scheduled.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-400">Товлосон мэдэгдэл байхгүй</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(n => (
                <div key={n.id} className="bg-white border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeIcons[n.type] || '📢'}</span>
                      <div>
                        <h3 className="text-sm font-bold">{n.title}</h3>
                        <p className="text-xs text-gray-400">
                          {n.target === 'all' ? '👥 Бүгд' : '💰 Өртэй'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[n.status]?.color || 'bg-gray-100'}`}>
                      {statusColors[n.status]?.text || n.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{n.message}</p>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      <span className="font-medium text-gray-600">📅 {formatDate(n.scheduled_at)}</span>
                      <span className="mx-2">·</span>
                      <span>Үүсгэсэн: {formatDate(n.created_at)}</span>
                    </div>

                    {n.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => cancelNotification(n.id)}
                          className="text-xs text-orange-500 hover:underline"
                        >
                          Цуцлах
                        </button>
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Устгах
                        </button>
                      </div>
                    )}

                    {n.status === 'cancelled' && (
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Устгах
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
