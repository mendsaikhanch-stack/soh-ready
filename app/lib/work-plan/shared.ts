// Ажлын төлөвлөгөө — клиент ба сервер хоёулаа импортлох тогтмол, төрөл, цэвэр функц.
// Энд серверийн модуль (supabaseAdmin) бүү оруул.

// 2026-11-11 ICTown-д туршиж, 2026-11-27-нд БҮХ СӨХ-д нээв. Хэрэглэхгүй СӨХ нь
// «Үйлчилгээ тохиргоо» (disabled_features: 'work-plan')-оос оршин суугчийн цэснээс нууна.
export function isWorkPlanEnabled(sokhId: number | string | null | undefined): boolean {
  const id = Number(sokhId);
  return Number.isSafeInteger(id) && id > 0;
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

type PerfItem = Pick<ItemOut, 'status' | 'budget' | 'actual_cost' | 'progress' | 'quarter'>;

/** Улирлын эцэс өнгөрсөн ч дуусаагүй ажил (хоцорсон). now — шалгах огноо. */
export function isOverdue(item: Pick<ItemOut, 'status' | 'quarter'>, planYear: number, now: Date = new Date()): boolean {
  if (item.status === 'done' || item.status === 'cancelled') return false;
  return now >= new Date(planYear, item.quarter * 3, 1); // дараагийн улирлын 1-нд
}

/** Нэг ажлын төсөв ба бодит зардлын зөрүү (+ хэтэрсэн, − хэмнэсэн). Зардал тайлагнаагүй бол null. */
export function itemVariance(item: Pick<ItemOut, 'budget' | 'actual_cost'>): number | null {
  if (item.actual_cost == null || item.budget == null) return null;
  return Number(item.actual_cost) - Number(item.budget);
}

export interface PerfStats {
  count: number;          // цуцлагдаагүй ажил
  done: number;
  partial: number;
  notDone: number;
  inProgress: number;
  overdue: number;
  /** Хийгдсэн ажлын хувь */
  completionPct: number;
  /** Дундаж явц (хийгдсэн = 100) */
  progressPct: number;
  budget: number;
  actual: number;
  /** Зардал тайлагнасан ажлуудын төсөв — зөрүүг зөвхөн тэдгээр дээр тооцно */
  reportedBudget: number;
  /** Зардал тайлагнасан ажлуудын бодит зардал − төсөв */
  variance: number;
  variancePct: number | null;
}

/**
 * Төлөвлөгөөний биелэлт, төсвийн зөрүү. Зөрүүг ЗӨВХӨН бодит зардал тайлагнасан ажил дээр
 * тооцно — эс бөгөөс хийгдээгүй ажлын төсөв «хэмнэлт» мэт харагдана.
 */
export function planPerformance(items: PerfItem[], planYear: number, now: Date = new Date()): PerfStats {
  const active = items.filter((i) => i.status !== 'cancelled');
  const reported = active.filter((i) => i.actual_cost != null && i.budget != null);
  const reportedBudget = reported.reduce((s, i) => s + Number(i.budget || 0), 0);
  const reportedActual = reported.reduce((s, i) => s + Number(i.actual_cost || 0), 0);
  const count = active.length;
  const done = active.filter((i) => i.status === 'done').length;
  return {
    count,
    done,
    partial: active.filter((i) => i.status === 'partial').length,
    notDone: active.filter((i) => i.status === 'not_done').length,
    inProgress: active.filter((i) => i.status === 'in_progress').length,
    overdue: active.filter((i) => isOverdue(i, planYear, now)).length,
    completionPct: count ? Math.round((done / count) * 100) : 0,
    progressPct: count ? Math.round(active.reduce((s, i) => s + (i.status === 'done' ? 100 : Number(i.progress || 0)), 0) / count) : 0,
    budget: active.reduce((s, i) => s + Number(i.budget || 0), 0),
    actual: active.reduce((s, i) => s + Number(i.actual_cost || 0), 0),
    reportedBudget,
    variance: reportedActual - reportedBudget,
    variancePct: reportedBudget > 0 ? Math.round(((reportedActual - reportedBudget) / reportedBudget) * 100) : null,
  };
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
