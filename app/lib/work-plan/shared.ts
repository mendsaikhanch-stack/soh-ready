// Ажлын төлөвлөгөө — клиент ба сервер хоёулаа импортлох тогтмол, төрөл, цэвэр функц.
// Энд серверийн модуль (supabaseAdmin) бүү оруул.

// Туршилт: зөвхөн эдгээр СӨХ-д цэс харагдаж, API ажиллана (superadmin үл хамаарна).
// Бүх СӨХ-д нээхдээ isWorkPlanEnabled-ийг `true` буцаадаг болгоно.
export const WORK_PLAN_SOKH_IDS: readonly number[] = [
  2694, // АйСиТаун (ICTown) — 2026-11-11 туршилт
];

export function isWorkPlanEnabled(sokhId: number | string | null | undefined): boolean {
  const id = Number(sokhId);
  return Number.isSafeInteger(id) && WORK_PLAN_SOKH_IDS.includes(id);
}

export type PlanStatus = 'draft' | 'review' | 'approved' | 'archived';
export type ItemStatus = 'planned' | 'in_progress' | 'done' | 'partial' | 'not_done' | 'cancelled';
export type Rating = 'done' | 'partial' | 'not_done';
export type Decision = 'approve' | 'changes';

export const PLAN_STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  draft: { label: 'Ноорог', cls: 'bg-gray-100 text-gray-600' },
  review: { label: 'ТУЗ хянаж байна', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Батлагдсан', cls: 'bg-green-100 text-green-700' },
  archived: { label: 'Хаагдсан', cls: 'bg-slate-100 text-slate-600' },
};

export const ITEM_STATUS: Record<ItemStatus, { label: string; cls: string }> = {
  planned: { label: 'Эхлээгүй', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'Хийгдэж байна', cls: 'bg-blue-100 text-blue-700' },
  done: { label: 'Хийгдсэн', cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Дутуу', cls: 'bg-amber-100 text-amber-700' },
  not_done: { label: 'Хийгдээгүй', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Цуцалсан', cls: 'bg-slate-100 text-slate-500' },
};

export const RATING_LABEL: Record<Rating, string> = {
  done: '✅ Хийгдсэн',
  partial: '🟡 Дутуу',
  not_done: '❌ Хийгдээгүй',
};

export const CATEGORIES: Record<string, string> = {
  repair: '🔧 Засвар',
  landscaping: '🌳 Тохижилт',
  finance: '💰 Санхүү',
  safety: '🛡 Аюулгүй байдал',
  cleaning: '🧹 Ариун цэвэр',
  community: '🤝 Олон нийт',
  admin: '📁 Удирдлага',
  other: '📌 Бусад',
};

export const QUARTER_LABEL = ['', 'I улирал (1–3 сар)', 'II улирал (4–6 сар)', 'III улирал (7–9 сар)', 'IV улирал (10–12 сар)'];

export const MAX_ITEM_FILES = 15;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const WORK_PLAN_BUCKET = 'work-plan-files';

// Зураг + PDF + Excel/Word
export const ALLOWED_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

/**
 * ТУЗ-ийн олонх баталсан уу. boardSize — ТУЗ-ийн гишүүдийн тоо (Хяналт ороогүй).
 * Олонх = тэнцүүгээс илүү (5 гишүүнд 3, 4 гишүүнд 3). Гишүүнгүй бол хэзээ ч автоматаар батлагдахгүй.
 */
export function isMajorityApproved(approvals: number, boardSize: number): boolean {
  if (boardSize <= 0) return false;
  return approvals > boardSize / 2;
}

export interface FileOut { id: number; file_name: string; mime_type: string | null; size_bytes: number | null; url: string | null }

export interface ItemOut {
  id: number;
  quarter: number;
  category: string;
  title: string;
  description: string | null;
  owner: string | null;
  budget: number | null;
  sort: number;
  status: ItemStatus;
  progress: number;
  report: string | null;
  actual_cost: number | null;
  reported_at: string | null;
  files: FileOut[];
  ratings: { done: number; partial: number; not_done: number };
  rating_list?: { member_name: string | null; rating: Rating; comment: string | null }[];
  my_rating?: Rating | null;
}

export interface ReviewOut { member_name: string | null; decision: Decision; comment: string | null; created_at: string }

export interface PlanOut {
  id: number;
  year: number;
  title: string;
  intro: string | null;
  status: PlanStatus;
  revision: number;
  submitted_at: string | null;
  approved_at: string | null;
  approved_via: 'app' | 'meeting' | null;
  approved_note: string | null;
  summary: string | null;
  items: ItemOut[];
  reviews?: ReviewOut[];
  my_review?: Decision | null;
  board_size?: number;
}

/** Ажлын дүнгийн товч: хэдэн ажил, хэд нь хийгдсэн, төсөв / бодит зардал. */
export function planTotals(items: Pick<ItemOut, 'status' | 'budget' | 'actual_cost'>[]) {
  const active = items.filter((i) => i.status !== 'cancelled');
  return {
    count: active.length,
    done: active.filter((i) => i.status === 'done').length,
    budget: active.reduce((s, i) => s + Number(i.budget || 0), 0),
    actual: active.reduce((s, i) => s + Number(i.actual_cost || 0), 0),
  };
}
