'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Зөвлөлийн дотоод чат — апп (гишүүн) болон админ (дарга) хоёулаа ашиглана.
// Realtime биш: харагдаж байх үед 10 секунд тутам polling (Disk IO-г хэмнэх,
// infra audit 2026-11-01-ийн шийдвэртэй нийцнэ).

export interface ChatMessage {
  id: number;
  resident_id: number | null;
  author_name: string;
  author_role: 'admin' | 'board' | 'audit';
  body: string;
  created_at: string;
}

const ROLE_LABEL: Record<ChatMessage['author_role'], string> = {
  admin: 'Дарга',
  board: 'ТУЗ',
  audit: 'Хяналт',
};

export default function ChatPanel({
  load,
  send,
  canWrite,
  isMine,
  readOnlyNote,
  heightClass = 'h-[60vh]',
}: {
  load: (after: number) => Promise<ChatMessage[] | null>;
  send: (text: string) => Promise<ChatMessage | string>;
  canWrite: boolean;
  isMine: (m: ChatMessage) => boolean;
  readOnlyNote?: string;
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const append = useCallback((rows: ChatMessage[]) => {
    if (rows.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...rows.filter((r) => !seen.has(r.id))];
      lastId.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
    setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let busyPoll = false;
    const poll = async () => {
      if (busyPoll || cancelled || document.visibilityState !== 'visible') return;
      busyPoll = true;
      try {
        const rows = await load(lastId.current);
        if (!cancelled && rows) append(rows);
      } finally {
        busyPoll = false;
        if (!cancelled) setLoaded(true);
      }
    };
    poll();
    const t = setInterval(poll, 10_000);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, append]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setError('');
    const r = await send(t);
    if (typeof r === 'string') setError(r);
    else { setText(''); append([r]); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col bg-white rounded-xl border">
      <div className={`${heightClass} overflow-y-auto p-3 space-y-2`}>
        {!loaded ? (
          <p className="text-center text-xs text-gray-400 py-6">Ачаалж байна...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">Одоогоор мессеж алга.</p>
        ) : (
          messages.map((m) => {
            const mine = isMine(m);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {!mine && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                      {m.author_name} · {ROLE_LABEL[m.author_role]}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[9px] mt-0.5 ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                    {new Date(m.created_at).toLocaleString('mn-MN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      {canWrite ? (
        <div className="border-t p-2 flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder="Мессеж бичих..."
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={submit} disabled={busy || !text.trim()} className="px-4 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            Илгээх
          </button>
        </div>
      ) : (
        <p className="border-t p-3 text-center text-xs text-gray-400">{readOnlyNote || 'Зөвхөн унших эрхтэй'}</p>
      )}
      {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
