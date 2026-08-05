'use client';

import { supabase } from '@/app/lib/supabase';

// "Хамгийн их уншсан" эрэмбэ — advice_card_views хүснэгтээс уншина.
// Хүснэгт үүсээгүй байсан ч модуль ажиллана: алдааг залгиж, хоосон буцаана
// (тэр үед жагсаалт нь ердийн дараалалаараа харагдана).

export type ViewCounts = Record<string, number>;

/**
 * null буцаах нь "хүснэгт байхгүй / уншиж чадсангүй" гэсэн үг — хоосон объекттой
 * ялгаатай. UI үүнийг ялгаж, "тоо бүртгэгдээгүй байна" гэж үнэн зөвөөр хэлнэ.
 */
export async function fetchViewCounts(): Promise<ViewCounts | null> {
  try {
    const { data, error } = await supabase
      .from('advice_card_views')
      .select('card_id, views');
    if (error || !data) return null;
    const counts: ViewCounts = {};
    for (const row of data as { card_id: string; views: number }[]) {
      counts[row.card_id] = Number(row.views) || 0;
    }
    return counts;
  } catch {
    return null;
  }
}

export async function recordView(cardId: string): Promise<void> {
  try {
    await supabase.rpc('increment_advice_view', { p_card_id: cardId });
  } catch {
    // Тоолуур ажиллахгүй байх нь уншихад саад болохгүй.
  }
}
