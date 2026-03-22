'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Message {
  id: number;
  sender_name: string;
  message: string;
  created_at: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`chat-name-${params.id}`);
    if (saved) { setName(saved); setNameSet(true); }
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`chat-${params.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `sokh_id=eq.${params.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages(data || []);
    setLoading(false);
  };

  const saveName = () => {
    if (!name.trim()) return;
    localStorage.setItem(`chat-name-${params.id}`, name.trim());
    setNameSet(true);
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    setSending(true);

    await supabase.from('chat_messages').insert([{
      sokh_id: params.id,
      sender_name: name,
      message: text.trim(),
    }]);

    setText('');
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
    return isToday ? time : `${d.toLocaleDateString('mn-MN')} ${time}`;
  };

  // Name entry screen
  if (!nameSet) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-sky-600 text-white px-4 py-4">
          <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
            ← Буцах
          </button>
          <h1 className="text-lg font-bold">💬 Хөрш чат</h1>
        </div>
        <div className="px-4 py-8">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-3xl mb-3">👋</p>
            <p className="font-semibold mb-1">Чат-д нэвтрэх</p>
            <p className="text-sm text-gray-500 mb-4">Нэрээ оруулна уу</p>
            <input
              placeholder="Жнь: Б.Болд (301 тоот)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm text-center"
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
            />
            <button
              onClick={saveName}
              disabled={!name.trim()}
              className="w-full bg-sky-600 text-white py-2.5 rounded-xl font-medium disabled:opacity-50"
            >
              Нэвтрэх
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-sky-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-0.5">
              ← Буцах
            </button>
            <h1 className="text-lg font-bold">💬 Хөрш чат</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">{name}</p>
            <button
              onClick={() => { setNameSet(false); localStorage.removeItem(`chat-name-${params.id}`); }}
              className="text-xs text-white/50 underline"
            >
              Нэр солих
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-400 text-sm">Эхний мессежээ бичээрэй!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_name === name;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  isMe ? 'bg-sky-600 text-white rounded-br-md' : 'bg-white shadow-sm rounded-bl-md'
                }`}>
                  {!isMe && (
                    <p className="text-xs font-semibold text-sky-600 mb-0.5">{m.sender_name}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-gray-400'} text-right`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white px-3 py-2">
        <div className="flex gap-2 items-end">
          <textarea
            placeholder="Мессеж бичих..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none max-h-20"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            className="bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
