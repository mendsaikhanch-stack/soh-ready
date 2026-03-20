'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface Message { id: number; content: string; type: string; created_at: string; }

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
      setMessages(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const deleteMsg = async (id: number) => {
    await supabase.from('messages').delete().eq('id', id);
    setMessages(messages.filter(m => m.id !== id));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">💬 Мессеж ({messages.length})</h1>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : messages.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-gray-400">Мессеж байхгүй</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="bg-white border rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm">{m.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(m.created_at).toLocaleString('mn-MN')}
                  </p>
                </div>
                <button onClick={() => deleteMsg(m.id)} className="text-red-400 text-xs hover:underline ml-4">
                  Устгах
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
