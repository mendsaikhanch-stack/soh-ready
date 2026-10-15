// Хурлын модулийн серверийн туслах функцүүд.
//
// Бүх хүснэгт RLS-ээр бүрэн хаалттай (supabase-meetings-migration.sql), тиймээс
// зөвхөн service role-оор, sokh_id-г ЗӨВХӨН гарын үсэгтэй сешнээс авч хандана.
// /api/admin/db proxy-ийн ROLE_TABLES-д эдгээрийг нэмэхгүй.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import type { AgendaItemInput, MeetingInput, MeetingKind, VoteWeightMode } from './labels';

export interface AdminCtx {
  sokhId: number;
  adminId: number | null;
}

// Даргын сешн. Алдаа бол бэлэн Response буцаана.
export async function requireMeetingAdmin(): Promise<AdminCtx | NextResponse> {
  const auth = await checkAuth('admin');
  const sokhId = Number(auth.sokhId);
  if (!auth.valid || !sokhId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const adminId = Number(auth.userId);
  return { sokhId, adminId: Number.isFinite(adminId) && adminId > 0 ? adminId : null };
}

// Миграц хараахан ажиллаагүй эсэх (хүснэгт/функц байхгүй)
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || error.code === 'PGRST202' || error.code === '42883';
}

export function notMigrated() {
  return NextResponse.json(
    { error: 'Хурлын модулийн өгөгдлийн сан хараахан бэлэн болоогүй байна', migrated: false },
    { status: 503 },
  );
}

// Зөвхөн нэмэх аудит лог. Алдаа гарвал үндсэн үйлдлийг унагахгүй, харин лог руу бичнэ.
export async function logMeetingEvent(
  req: NextRequest,
  ctx: AdminCtx,
  meetingId: number | null,
  action: string,
  payload?: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from('meeting_events').insert({
    meeting_id: meetingId,
    sokh_id: ctx.sokhId,
    actor_type: 'admin',
    actor_id: ctx.adminId != null ? String(ctx.adminId) : null,
    action,
    payload: payload ?? null,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) || null,
  });
  if (error) console.error('[meetings] audit log failed', action, error.message);
}

// ===== Оролтын шалгалт =====

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const pct = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return NaN;
  return Math.round(n * 100) / 100;
};

export function parseMeetingInput(body: Record<string, unknown>): { value?: MeetingInput; error?: string } {
  const title = str(body.title, 200);
  if (!title) return { error: 'Хурлын нэрийг оруулна уу' };

  const scheduled = typeof body.scheduled_at === 'string' ? new Date(body.scheduled_at) : null;
  if (!scheduled || Number.isNaN(scheduled.getTime())) return { error: 'Хурлын огноо, цагийг оруулна уу' };

  const kind: MeetingKind = body.kind === 'extraordinary' ? 'extraordinary' : 'regular';

  const mode = body.vote_weight_mode;
  const vote_weight_mode: VoteWeightMode | null =
    mode === 'per_unit' || mode === 'per_area' ? mode : null;

  const quorum = pct(body.quorum_required_pct);
  if (Number.isNaN(quorum)) return { error: 'Ирцийн хувь 0-ээс их, 100-аас ихгүй байна' };

  let notice: number | null = null;
  if (body.min_notice_days !== null && body.min_notice_days !== undefined && body.min_notice_days !== '') {
    const n = Number(body.min_notice_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) return { error: 'Зар хүргэх хугацаа 0–365 хоног байна' };
    notice = n;
  }

  const prevote = body.prevote_counts_as_attendance;

  return {
    value: {
      kind,
      title,
      description: str(body.description, 4000),
      scheduled_at: scheduled.toISOString(),
      location: str(body.location, 300),
      online_url: str(body.online_url, 500),
      convened_by_name: str(body.convened_by_name, 200),
      convened_basis: str(body.convened_basis, 500),
      vote_weight_mode,
      quorum_required_pct: quorum,
      quorum_strict: body.quorum_strict === true,
      min_notice_days: notice,
      prevote_counts_as_attendance: typeof prevote === 'boolean' ? prevote : null,
    },
  };
}

export function parseAgenda(raw: unknown): { value?: AgendaItemInput[]; error?: string } {
  if (raw === undefined) return { value: undefined };
  if (!Array.isArray(raw)) return { error: 'Хэлэлцэх асуудлын жагсаалт буруу байна' };
  if (raw.length > 50) return { error: 'Хэлэлцэх асуудал 50-аас ихгүй байна' };

  const items: AgendaItemInput[] = [];
  for (const [i, r] of raw.entries()) {
    const o = (r ?? {}) as Record<string, unknown>;
    const title = str(o.title, 300);
    if (!title) return { error: `${i + 1}-р асуудлын гарчгийг оруулна уу` };
    const p = pct(o.pass_threshold_pct);
    if (Number.isNaN(p)) return { error: `${i + 1}-р асуудлын батлагдах босго 0-ээс их, 100-аас ихгүй байна` };
    items.push({
      title,
      description: str(o.description, 4000),
      decision_draft: str(o.decision_draft, 4000),
      pass_threshold_pct: p,
      pass_threshold_strict: o.pass_threshold_strict !== false,
      prevote_enabled: o.prevote_enabled !== false,
    });
  }
  return { value: items };
}

// Ноорог хурлын хэлэлцэх асуудлыг бүтнээр нь солино
export async function replaceAgenda(meetingId: number, sokhId: number, items: AgendaItemInput[]) {
  const del = await supabaseAdmin
    .from('meeting_agenda_items')
    .delete()
    .eq('meeting_id', meetingId)
    .eq('sokh_id', sokhId);
  if (del.error) return del.error;
  if (items.length === 0) return null;

  const ins = await supabaseAdmin.from('meeting_agenda_items').insert(
    items.map((it, idx) => ({ ...it, meeting_id: meetingId, sokh_id: sokhId, position: idx + 1 })),
  );
  return ins.error;
}
