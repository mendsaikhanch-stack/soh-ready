// Өдрийн постын дараалал — групп сонголтын алгоритм (Layer 1, deterministic).
//
// Дүрэм:
//   1. Зөвхөн status='active' группүүд
//   2. Cooldown дотор байгаа группийг алгасах (next_allowed_at > now)
//   3. Сүүлийн 7 хоногт постолсон группийг алгасах (last_posted_at)
//   4. A priority группүүдийг түрүүлж сонгох
//   5. Группийн төрлүүдийг хольж сонгох (hoa_mgmt / resident / apartment / general)

import { COOLDOWN_DAYS, QUEUE_DEFAULT, QUEUE_MIN, QUEUE_MAX } from './constants';
import type { FbGroup, GroupType } from './constants';

const TYPE_ORDER: GroupType[] = ['hoa_mgmt', 'resident', 'apartment', 'general'];

const PRIORITY_WEIGHT: Record<string, number> = { A: 3, B: 2, C: 1 };

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/** Групп өнөөдөр постлоход тэнцэх эсэх */
export function isEligible(g: FbGroup, now: Date): boolean {
  if (g.status !== 'active') return false;
  // Cooldown — next_allowed_at ирээгүй байвал тэнцэхгүй
  if (g.next_allowed_at && new Date(g.next_allowed_at) > now) return false;
  // Сүүлийн 7 хоногт постолсон бол алгасах
  if (g.last_posted_at && daysBetween(now, new Date(g.last_posted_at)) < COOLDOWN_DAYS) return false;
  return true;
}

/** Эрэмбэлэх оноо — priority эхэнд, дараа нь хамгийн удаан постлоогүй */
function score(g: FbGroup, now: Date): number {
  const pw = PRIORITY_WEIGHT[g.priority] ?? 1;
  // Хэдэн хоног постлоогүй вэ (хуучирсан нь түрүүлнэ)
  const idleDays = g.last_posted_at ? daysBetween(now, new Date(g.last_posted_at)) : 999;
  const idleBonus = Math.min(idleDays, 60) / 60; // 0..1
  return pw * 10 + idleBonus;
}

export interface SelectionResult {
  selected: FbGroup[];
  eligibleCount: number;
  reason?: string;
}

/**
 * Өдрийн дараалалд орох группүүдийг сонгох.
 * Төрөл тус бүрийн bucket-ийг оноогоор эрэмбэлж, дараа нь bucket-уудаар
 * round-robin хийж сонгоно — ингэснээр priority хадгалагдаж, төрлүүд холилдоно.
 */
export function selectQueueGroups(
  groups: FbGroup[],
  opts: { now: Date; limit?: number },
): SelectionResult {
  const now = opts.now;
  const limit = Math.max(QUEUE_MIN, Math.min(QUEUE_MAX, opts.limit ?? QUEUE_DEFAULT));

  const eligible = groups.filter((g) => isEligible(g, now));

  // Төрөл бүрийн bucket үүсгэж оноогоор эрэмбэлэх
  const buckets: Record<GroupType, FbGroup[]> = {
    hoa_mgmt: [],
    resident: [],
    apartment: [],
    general: [],
  };
  for (const g of eligible) {
    (buckets[g.group_type] || buckets.general).push(g);
  }
  for (const t of TYPE_ORDER) {
    buckets[t].sort((a, b) => score(b, now) - score(a, now));
  }

  // Round-robin: давталт бүрд төрөл тус бүрээс хамгийн өндөр оноотойг авна
  const selected: FbGroup[] = [];
  let added = true;
  while (selected.length < limit && added) {
    added = false;
    for (const t of TYPE_ORDER) {
      if (selected.length >= limit) break;
      const next = buckets[t].shift();
      if (next) {
        selected.push(next);
        added = true;
      }
    }
  }

  let reason: string | undefined;
  if (eligible.length === 0) {
    reason = 'Тэнцэх групп алга — бүгд cooldown-д байна эсвэл идэвхгүй байна.';
  } else if (selected.length < QUEUE_MIN) {
    reason = `Зөвхөн ${selected.length} групп тэнцлээ (10-аас бага). Шинэ групп нэмэх эсвэл cooldown дуусахыг хүлээнэ үү.`;
  }

  return { selected, eligibleCount: eligible.length, reason };
}
