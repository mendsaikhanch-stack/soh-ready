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

interface SentMessage {
  id: string;
  to: string;
  toName: string;
  content: string;
  type: 'debt' | 'announcement' | 'custom';
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export default function AdminMessages() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'send' | 'history'>('send');

  // Илгээх форм
  const [msgType, setMsgType] = useState<'debt' | 'announcement' | 'custom'>('debt');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('residents').select('*').order('name');
      setResidents(data || []);

      // Илгээсэн мэдэгдлүүдийг localStorage-аас унших
      const stored = localStorage.getItem('sokh-sent-messages');
      if (stored) setSentMessages(JSON.parse(stored));

      setLoading(false);
    };
    fetchData();
  }, []);

  const saveSentMessages = (msgs: SentMessage[]) => {
    setSentMessages(msgs);
    localStorage.setItem('sokh-sent-messages', JSON.stringify(msgs));
  };

  // Автомат текст үүсгэх
  const generateMessage = (resident: Resident): string => {
    if (msgType === 'debt') {
      return `Сайн байна уу, ${resident.name}. Таны ${resident.apartment} тоотын СӨХ хураамжийн үлдэгдэл ${resident.debt.toLocaleString()}₮ байна. Хугацаандаа төлнө үү. Баярлалаа.`;
    } else if (msgType === 'announcement') {
      return customText || 'Шинэ зарлал байна. СӨХ Систем апп-аас шалгана уу.';
    }
    return customText;
  };

  // Өртэй бүгдийг сонгох
  const selectAllDebtors = () => {
    const debtorIds = residents.filter(r => r.debt > 0).map(r => r.id);
    setSelectedIds(debtorIds);
  };

  const selectAll = () => setSelectedIds(residents.map(r => r.id));
  const selectNone = () => setSelectedIds([]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Мсж илгээх
  const sendMessages = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    setSendResult(null);
    let success = 0, failed = 0;

    const newMessages: SentMessage[] = [];

    for (const id of selectedIds) {
      const resident = residents.find(r => r.id === id);
      if (!resident) { failed++; continue; }

      const content = generateMessage(resident);

      // Мэдэгдлийг хадгалах (жинхэнэ SMS/push интеграц хийхэд энд холбоно)
      newMessages.push({
        id: `msg-${Date.now()}-${id}`,
        to: resident.phone || resident.apartment,
        toName: resident.name,
        content,
        type: msgType,
        sentAt: new Date().toISOString(),
        status: resident.phone ? 'sent' : 'delivered', // Утас байхгүй бол апп-д илгээсэн
      });
      success++;
    }

    const updated = [...newMessages, ...sentMessages];
    saveSentMessages(updated);

    setSendResult({ success, failed });
    setSending(false);
    setSelectedIds([]);
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    sent: { text: 'Илгээсэн', color: 'bg-blue-100 text-blue-700' },
    delivered: { text: 'Хүргэсэн', color: 'bg-green-100 text-green-700' },
    read: { text: 'Уншсан', color: 'bg-green-100 text-green-700' },
    failed: { text: 'Алдаатай', color: 'bg-red-100 text-red-700' },
  };

  const typeLabel: Record<string, string> = {
    debt: '💰 Өрийн сануулга',
    announcement: '📢 Зарлал',
    custom: '✉️ Захидал',
  };

  const debtors = residents.filter(r => r.debt > 0);

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
          Илгээх
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'history' ? 'bg-white shadow-sm' : 'text-gray-500'
          }`}
        >
          Илгээсэн ({sentMessages.length})
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
              Өртэй {debtors.length} тоотод автомат сануулга илгээнэ. Мэдэгдэл бүр тухайн тоотын нэр, өрийн дүнг агуулна.
            </div>
          )}

          {/* Чөлөөт/зарлал текст */}
          {(msgType === 'custom' || msgType === 'announcement') && (
            <div className="bg-white border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-2">Мэдэгдлийн текст</h3>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder={msgType === 'announcement' ? 'Зарлалын агуулга...' : 'Мэдэгдлийн текст...'}
                className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
              />
            </div>
          )}

          {/* Хүлээн авагч сонгох */}
          <div className="bg-white border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Хүлээн авагч ({selectedIds.length}/{residents.length})</h3>
              <div className="flex gap-2">
                {msgType === 'debt' && (
                  <button onClick={selectAllDebtors} className="text-xs text-red-600 hover:underline">
                    Өртэй ({debtors.length})
                  </button>
                )}
                <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Бүгд</button>
                <button onClick={selectNone} className="text-xs text-gray-500 hover:underline">Цуцлах</button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {residents.map(r => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition ${
                    selectedIds.includes(r.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.apartment} {r.phone && `· ${r.phone}`}</p>
                  </div>
                  {r.debt > 0 && (
                    <span className="text-xs text-red-500 font-medium">{r.debt.toLocaleString()}₮</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Урьдчилж харах */}
          {selectedIds.length > 0 && (
            <div className="bg-gray-50 border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-2">Жишээ мэдэгдэл</h3>
              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border">
                {generateMessage(residents.find(r => r.id === selectedIds[0])!)}
              </div>
            </div>
          )}

          {/* Амжилтын мэдээ */}
          {sendResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700">
              ✅ {sendResult.success} мэдэгдэл амжилттай илгээлээ
              {sendResult.failed > 0 && ` · ${sendResult.failed} алдаатай`}
            </div>
          )}

          {/* Илгээх товч */}
          <button
            onClick={sendMessages}
            disabled={selectedIds.length === 0 || sending}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
              selectedIds.length > 0 && !sending
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {sending ? 'Илгээж байна...' : `Илгээх (${selectedIds.length} хүн)`}
          </button>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div>
          {sentMessages.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-400">Илгээсэн мэдэгдэл байхгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sentMessages.map(m => (
                <div key={m.id} className="bg-white border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold">{m.toName}</p>
                      <p className="text-xs text-gray-400">{m.to}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusLabel[m.status].color}`}>
                        {statusLabel[m.status].text}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{m.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{typeLabel[m.type]}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(m.sentAt).toLocaleString('mn-MN')}
                    </span>
                  </div>
                </div>
              ))}

              <button
                onClick={() => { saveSentMessages([]); }}
                className="w-full mt-4 py-2 text-sm text-red-500 hover:underline"
              >
                Түүх цэвэрлэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
