'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import ChatPanel, { type ChatMessage } from '@/app/components/council/ChatPanel';

// Дарга ↔ ТУЗ / Хяналтын зөвлөлийн дотоод чат (апп дахь «🏛 Зөвлөл → Чат»-тай нэг).
export default function AdminCouncilChatPage() {
  const load = useCallback(async (after: number): Promise<ChatMessage[] | null> => {
    try {
      const res = await fetch(`/api/admin/council?view=chat${after ? `&after=${after}` : ''}`);
      const data = await res.json();
      return res.ok ? data.messages || [] : null;
    } catch {
      return null;
    }
  }, []);

  const send = useCallback(async (text: string): Promise<ChatMessage | string> => {
    try {
      const res = await fetch('/api/admin/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', body: text }),
      });
      const data = await res.json();
      return res.ok ? data.message : data.error || 'Илгээж чадсангүй';
    } catch {
      return 'Сервертэй холбогдож чадсангүй';
    }
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/admin/board" className="text-sm text-blue-600">← Цахим ТУЗ</Link>
      <h1 className="text-2xl font-bold mt-2">💬 Зөвлөлийн чат</h1>
      <p className="text-sm text-gray-500 mb-4">
        ТУЗ-ийн гишүүд бичиж, Хяналтын зөвлөл уншина. Оршин суугчид харахгүй.
      </p>
      <ChatPanel load={load} send={send} canWrite isMine={(m) => m.author_role === 'admin'} />
    </div>
  );
}
