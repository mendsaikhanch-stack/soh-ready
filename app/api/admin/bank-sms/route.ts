import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth, type AuthRole } from '@/app/lib/session-token';
import { adminBankSmsLimiter } from '@/app/lib/rate-limit';
import {
  generateDeviceToken, hashDeviceToken, matchTransaction, normalizeReference, processStoredEvent,
} from '@/app/lib/bank-sms/core';
import { supabaseBankSmsStore, toDeviceConfig, type DeviceRow } from '@/app/lib/bank-sms/store';

// Банкны SMS — даргын хяналт.
//   GET  ?view=overview          — төхөөрөмж, дүрэм, гүйлгээ, SMS лог
//   POST { action, ... }          — доорх ACTIONS
//
// Tenant: admin → session-ий sokh_id (клиентийн утгыг үл тоомсорлоно).
//         superadmin → ?sokhId= / body.sokhId заавал.
// CSRF: admin-session cookie нь SameSite=strict + JSON body шаардана.
// Өөрчлөлт бүр audit_logs-д бичигдэнэ.

export const dynamic = 'force-dynamic';

interface Ctx {
  sokhId: number;
  adminId: number | null;
  role: AuthRole;
  ip: string | null;
  ua: string | null;
}

type Body = Record<string, unknown>;

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function context(request: NextRequest, bodySokhId?: unknown): Promise<Ctx> {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid || !auth.role) throw new HttpError(401, 'Нэвтрээгүй байна');

  const key = `${auth.role}:${auth.userId}`;
  const rl = adminBankSmsLimiter.check(key);
  if (!rl.allowed) throw new HttpError(429, `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү`);

  let sokhId = 0;
  if (auth.role === 'superadmin') {
    sokhId = Number(bodySokhId ?? request.nextUrl.searchParams.get('sokhId'));
  } else {
    sokhId = Number(auth.sokhId);
  }
  if (!Number.isSafeInteger(sokhId) || sokhId <= 0) throw new HttpError(403, 'СӨХ тодорхойгүй');

  return {
    sokhId,
    adminId: auth.userId && /^\d+$/.test(auth.userId) ? Number(auth.userId) : null,
    role: auth.role,
    ip: request.headers.get('x-forwarded-for')?.slice(0, 100) || null,
    ua: request.headers.get('user-agent')?.slice(0, 500) || null,
  };
}

async function audit(ctx: Ctx, action: string, table: string, details: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: ctx.adminId,
    role: ctx.role,
    sokh_id: ctx.sokhId,
    action,
    table_name: table,
    details: JSON.stringify(details).slice(0, 1000),
    ip: ctx.ip,
    user_agent: ctx.ua,
  });
  if (error) console.error('[admin/bank-sms] audit_logs:', error.message);
}

function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[admin/bank-sms]', e instanceof Error ? e.message : e);
  return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
}

// ── Оролтын шалгалт ──────────────────────────────────────────

function str(v: unknown, max: number, field: string, required = true): string | null {
  if (v == null || v === '') {
    if (required) throw new HttpError(400, `${field} хоосон байна`);
    return null;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} буруу`);
  const s = v.trim();
  if (s.length === 0 && required) throw new HttpError(400, `${field} хоосон байна`);
  if (s.length > max) throw new HttpError(400, `${field} хэт урт`);
  return s || null;
}

function id(v: unknown, field = 'id'): number {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `${field} буруу`);
  return n;
}

const UNIT_RE = /^[0-9A-Za-zА-Яа-яЁёӨөҮү]{1,10}$/u;

function unitPart(v: unknown, field: string, required = true): string | null {
  const s = str(v, 10, field, required);
  if (s && !UNIT_RE.test(s)) throw new HttpError(400, `${field} зөвхөн үсэг, тоо байна`);
  return s;
}

function senders(v: unknown): string[] {
  if (!Array.isArray(v)) throw new HttpError(400, 'Илгээгчийн жагсаалт буруу');
  const list = v.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  if (list.length > 5 || list.some((s) => !/^[+0-9A-Za-z ]{2,32}$/.test(s))) {
    throw new HttpError(400, 'Илгээгчийн дугаар буруу (жишээ: 131888)');
  }
  return list;
}

function accountMask(v: unknown): string | null {
  const s = str(v, 30, 'Дансны маск', false);
  if (s && !/^\d{2,8}\*{2,}\d{2,8}$/.test(s.replace(/\s/g, ''))) {
    throw new HttpError(400, 'Дансны маск SMS дээрхтэй ижил байна (жишээ: 5006***029)');
  }
  return s ? s.replace(/\s/g, '') : null;
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request);
    const [devices, mappings, txs, events] = await Promise.all([
      supabaseAdmin.from('bank_sms_devices')
        .select('id, display_name, bank, allowed_senders, account_mask, auto_apply, token_prefix, status, last_seen_at, last_sms_received_at, last_successful_delivery_at, last_error, last_error_at, last_status, created_at, revoked_at')
        .eq('sokh_id', ctx.sokhId).order('id'),
      supabaseAdmin.from('payment_reference_mappings')
        .select('id, source_pattern, normalized_pattern, building_number, entrance_number, apartment_number, mapping_type, note, is_active, created_at, updated_at')
        .eq('sokh_id', ctx.sokhId).order('is_active', { ascending: false }).order('id'),
      supabaseAdmin.from('bank_transactions')
        .select('id, account_reference, transaction_reference, payment_channel, amount_mnt, balance_after_mnt, transaction_date, transaction_description, payer_reference, normalized_reference, building_number, entrance_number, apartment_number, resident_id, suggested_invoice_id, matching_status, reconciliation_status, review_reason, payment_id, reviewed_at, review_note, created_at, resident:residents(id, name, building, apartment)')
        .eq('sokh_id', ctx.sokhId).order('id', { ascending: false }).limit(300),
      supabaseAdmin.from('bank_sms_events')
        .select('id, device_id, sender, received_at, server_received_at, processing_status, processing_error, transaction_id, retry_count, raw_body, raw_purged_at')
        .eq('sokh_id', ctx.sokhId).order('id', { ascending: false }).limit(200),
    ]);
    const err = devices.error || mappings.error || txs.error || events.error;
    if (err) throw new Error(err.message);
    return NextResponse.json({
      sokhId: ctx.sokhId,
      devices: devices.data,
      mappings: mappings.data,
      transactions: txs.data,
      events: events.data,
    });
  } catch (e) {
    return fail(e);
  }
}

// ── POST ─────────────────────────────────────────────────────

type Handler = (ctx: Ctx, b: Body) => Promise<Record<string, unknown>>;

async function loadDevice(ctx: Ctx, deviceId: number): Promise<DeviceRow> {
  const { data, error } = await supabaseAdmin.from('bank_sms_devices')
    .select('id, sokh_id, display_name, bank, allowed_senders, account_mask, auto_apply, status')
    .eq('id', deviceId).eq('sokh_id', ctx.sokhId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(404, 'Төхөөрөмж олдсонгүй');
  return data as DeviceRow;
}

async function autoApplyFor(ctx: Ctx, deviceId: number | null): Promise<boolean> {
  if (!deviceId) return false;
  const { data } = await supabaseAdmin.from('bank_sms_devices')
    .select('auto_apply, status').eq('id', deviceId).eq('sokh_id', ctx.sokhId).maybeSingle();
  return !!data && data.status === 'active' && data.auto_apply === true;
}

/** Шинэ/өөрчилсөн дүрэмд таарах, шийдэгдээгүй гүйлгээнүүдийг дахин тааруулна */
async function rematchByReference(ctx: Ctx, normalized: string): Promise<number> {
  const { data } = await supabaseAdmin.from('bank_transactions')
    .select('id, sokh_id, device_id, amount_mnt, normalized_reference, payer_reference, reconciliation_status, payment_id')
    .eq('sokh_id', ctx.sokhId).eq('normalized_reference', normalized)
    .eq('reconciliation_status', 'needs_review').is('payment_id', null).limit(100);
  let n = 0;
  for (const tx of data || []) {
    await matchTransaction(supabaseBankSmsStore, tx, await autoApplyFor(ctx, tx.device_id));
    n++;
  }
  return n;
}

const APPLY_ERRORS: Record<string, [number, string]> = {
  already_resolved: [409, 'Энэ гүйлгээ аль хэдийн шийдэгдсэн'],
  resident_not_in_sokh: [400, 'Оршин суугч энэ СӨХ-д харьяалагдахгүй'],
  invoice_not_for_resident: [400, 'Нэхэмжлэх энэ айлынх биш'],
  invoice_closed: [409, 'Нэхэмжлэх аль хэдийн төлөгдсөн/цуцлагдсан'],
};

const ACTIONS: Record<string, Handler> = {
  async 'device.create'(ctx, b) {
    const token = generateDeviceToken();
    const row = {
      sokh_id: ctx.sokhId,
      display_name: str(b.displayName, 60, 'Нэр')!,
      bank: 'xacbank',
      allowed_senders: senders(b.allowedSenders ?? []),
      account_mask: accountMask(b.accountMask),
      auto_apply: false,
      token_hash: hashDeviceToken(token),
      token_prefix: token.slice(0, 12),
      created_by_admin_id: ctx.adminId,
    };
    const { data, error } = await supabaseAdmin.from('bank_sms_devices').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    await audit(ctx, 'bank_sms.device.create', 'bank_sms_devices', { id: data.id, name: row.display_name });
    // Токеныг ЗӨВХӨН энд нэг удаа буцаана
    return { id: data.id, token };
  },

  async 'device.update'(ctx, b) {
    const dev = await loadDevice(ctx, id(b.id));
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (b.displayName !== undefined) patch.display_name = str(b.displayName, 60, 'Нэр');
    if (b.allowedSenders !== undefined) patch.allowed_senders = senders(b.allowedSenders);
    if (b.accountMask !== undefined) patch.account_mask = accountMask(b.accountMask);
    if (b.autoApply !== undefined) {
      if (typeof b.autoApply !== 'boolean') throw new HttpError(400, 'autoApply буруу');
      patch.auto_apply = b.autoApply;
    }
    const { error } = await supabaseAdmin.from('bank_sms_devices').update(patch).eq('id', dev.id).eq('sokh_id', ctx.sokhId);
    if (error) throw new Error(error.message);
    await audit(ctx, 'bank_sms.device.update', 'bank_sms_devices', { id: dev.id, ...patch });
    return { ok: true };
  },

  async 'device.revoke'(ctx, b) {
    const dev = await loadDevice(ctx, id(b.id));
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('bank_sms_devices')
      .update({ status: 'revoked', revoked_at: now, updated_at: now }).eq('id', dev.id).eq('sokh_id', ctx.sokhId);
    if (error) throw new Error(error.message);
    await audit(ctx, 'bank_sms.device.revoke', 'bank_sms_devices', { id: dev.id });
    return { ok: true };
  },

  async 'device.rotate'(ctx, b) {
    const dev = await loadDevice(ctx, id(b.id));
    const token = generateDeviceToken();
    const { error } = await supabaseAdmin.from('bank_sms_devices').update({
      token_hash: hashDeviceToken(token), token_prefix: token.slice(0, 12),
      status: 'active', revoked_at: null, updated_at: new Date().toISOString(),
    }).eq('id', dev.id).eq('sokh_id', ctx.sokhId);
    if (error) throw new Error(error.message);
    await audit(ctx, 'bank_sms.device.rotate', 'bank_sms_devices', { id: dev.id });
    return { id: dev.id, token };
  },

  async 'mapping.create'(ctx, b) {
    const source = str(b.sourcePattern, 100, 'Гүйлгээний утга')!;
    const normalized = normalizeReference(source);
    // «403» гэх мэт дан дугаар олон байранд давтагдана — сохроор тааруулахгүй
    if (normalized.length < 3 || /^\d{1,4}$/.test(normalized)) {
      throw new HttpError(400, 'Дан тоот хэт ерөнхий — гүйлгээний утгыг бүтнээр нь оруулна уу (жишээ: «613тоот»)');
    }
    const row = {
      sokh_id: ctx.sokhId,
      source_pattern: source,
      normalized_pattern: normalized,
      building_number: unitPart(b.building, 'Байр')!,
      entrance_number: unitPart(b.entrance, 'Орц', false),
      apartment_number: unitPart(b.apartment, 'Тоот')!,
      note: str(b.note, 200, 'Тэмдэглэл', false),
      created_by_admin_id: ctx.adminId,
    };
    const { data, error } = await supabaseAdmin.from('payment_reference_mappings').insert(row).select('id').single();
    if (error?.code === '23505') throw new HttpError(409, `«${normalized}» утгатай идэвхтэй дүрэм аль хэдийн байна`);
    if (error) throw new Error(error.message);
    await audit(ctx, 'bank_sms.mapping.create', 'payment_reference_mappings', { id: data.id, ...row });
    const rematched = await rematchByReference(ctx, normalized);
    return { id: data.id, normalized, rematched };
  },

  async 'mapping.update'(ctx, b) {
    const mid = id(b.id);
    const source = str(b.sourcePattern, 100, 'Гүйлгээний утга')!;
    const normalized = normalizeReference(source);
    if (normalized.length < 3 || /^\d{1,4}$/.test(normalized)) {
      throw new HttpError(400, 'Дан тоот хэт ерөнхий — гүйлгээний утгыг бүтнээр нь оруулна уу');
    }
    const patch = {
      source_pattern: source,
      normalized_pattern: normalized,
      building_number: unitPart(b.building, 'Байр')!,
      entrance_number: unitPart(b.entrance, 'Орц', false),
      apartment_number: unitPart(b.apartment, 'Тоот')!,
      note: str(b.note, 200, 'Тэмдэглэл', false),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from('payment_reference_mappings')
      .update(patch).eq('id', mid).eq('sokh_id', ctx.sokhId).select('id');
    if (error?.code === '23505') throw new HttpError(409, `«${normalized}» утгатай идэвхтэй дүрэм аль хэдийн байна`);
    if (error) throw new Error(error.message);
    if (!data?.length) throw new HttpError(404, 'Дүрэм олдсонгүй');
    await audit(ctx, 'bank_sms.mapping.update', 'payment_reference_mappings', { id: mid, ...patch });
    // Аль хэдийн шийдэгдсэн гүйлгээнд нөлөөлөхгүй — зөвхөн хүлээгдэж буйг тааруулна
    const rematched = await rematchByReference(ctx, normalized);
    return { ok: true, rematched };
  },

  async 'mapping.setActive'(ctx, b) {
    const mid = id(b.id);
    if (typeof b.active !== 'boolean') throw new HttpError(400, 'active буруу');
    const { data, error } = await supabaseAdmin.from('payment_reference_mappings')
      .update({ is_active: b.active, updated_at: new Date().toISOString() })
      .eq('id', mid).eq('sokh_id', ctx.sokhId).select('id, normalized_pattern');
    if (error?.code === '23505') throw new HttpError(409, 'Ижил утгатай өөр идэвхтэй дүрэм байна');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new HttpError(404, 'Дүрэм олдсонгүй');
    await audit(ctx, 'bank_sms.mapping.setActive', 'payment_reference_mappings', { id: mid, active: b.active });
    const rematched = b.active ? await rematchByReference(ctx, data[0].normalized_pattern) : 0;
    return { ok: true, rematched };
  },

  async 'txn.confirm'(ctx, b) {
    const tid = id(b.id);
    const residentId = id(b.residentId, 'residentId');
    const invoiceId = b.invoiceId == null || b.invoiceId === '' ? null : id(b.invoiceId, 'invoiceId');
    const note = str(b.note, 300, 'Тэмдэглэл', false);
    const { data: tx } = await supabaseAdmin.from('bank_transactions')
      .select('id, amount_mnt').eq('id', tid).eq('sokh_id', ctx.sokhId).maybeSingle();
    if (!tx) throw new HttpError(404, 'Гүйлгээ олдсонгүй');
    try {
      const paymentId = await supabaseBankSmsStore.applyPayment({
        transactionId: tid, residentId, invoiceId, adminId: ctx.adminId, mode: 'manual', note,
      });
      await audit(ctx, 'bank_sms.txn.confirm', 'bank_transactions', {
        id: tid, residentId, invoiceId, paymentId, amount: tx.amount_mnt,
      });
      return { ok: true, paymentId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const known = Object.keys(APPLY_ERRORS).find((k) => msg.includes(k));
      if (known) throw new HttpError(APPLY_ERRORS[known][0], APPLY_ERRORS[known][1]);
      throw e;
    }
  },

  async 'txn.ignore'(ctx, b) {
    const tid = id(b.id);
    const note = str(b.note, 300, 'Шалтгаан')!;
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('bank_transactions').update({
      reconciliation_status: 'ignored', review_note: note, reviewed_by_admin_id: ctx.adminId,
      reviewed_at: now, updated_at: now,
    }).eq('id', tid).eq('sokh_id', ctx.sokhId).eq('reconciliation_status', 'needs_review').is('payment_id', null).select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new HttpError(409, 'Зөвхөн шийдэгдээгүй гүйлгээг хасна');
    await audit(ctx, 'bank_sms.txn.ignore', 'bank_transactions', { id: tid, note });
    return { ok: true };
  },

  async 'txn.reopen'(ctx, b) {
    const tid = id(b.id);
    const { data, error } = await supabaseAdmin.from('bank_transactions').update({
      reconciliation_status: 'needs_review', updated_at: new Date().toISOString(),
    }).eq('id', tid).eq('sokh_id', ctx.sokhId).eq('reconciliation_status', 'ignored').is('payment_id', null).select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) throw new HttpError(409, 'Зөвхөн хасагдсан гүйлгээг сэргээнэ');
    await audit(ctx, 'bank_sms.txn.reopen', 'bank_transactions', { id: tid });
    return { ok: true };
  },

  async 'txn.rematch'(ctx, b) {
    const tid = id(b.id);
    const { data: tx } = await supabaseAdmin.from('bank_transactions')
      .select('id, sokh_id, device_id, amount_mnt, normalized_reference, payer_reference, reconciliation_status, payment_id')
      .eq('id', tid).eq('sokh_id', ctx.sokhId).maybeSingle();
    if (!tx) throw new HttpError(404, 'Гүйлгээ олдсонгүй');
    const r = await matchTransaction(supabaseBankSmsStore, tx, await autoApplyFor(ctx, tx.device_id));
    await audit(ctx, 'bank_sms.txn.rematch', 'bank_transactions', { id: tid, ...r });
    return { ok: true, ...r };
  },

  async 'event.reprocess'(ctx, b) {
    const eid = id(b.id);
    const { data: ev } = await supabaseAdmin.from('bank_sms_events')
      .select('id, device_id, processing_status, raw_body')
      .eq('id', eid).eq('sokh_id', ctx.sokhId).maybeSingle();
    if (!ev) throw new HttpError(404, 'SMS олдсонгүй');
    if (!['needs_review', 'failed', 'received'].includes(ev.processing_status)) {
      throw new HttpError(409, 'Энэ SMS аль хэдийн боловсруулагдсан');
    }
    if (!ev.raw_body) throw new HttpError(409, 'Эх текст хадгалагдаагүй (хугацаа дууссан)');
    const dev = await loadDevice(ctx, ev.device_id);
    const r = await processStoredEvent(supabaseBankSmsStore, toDeviceConfig(dev), ev.id, ev.raw_body);
    await audit(ctx, 'bank_sms.event.reprocess', 'bank_sms_events', { id: eid, status: r.status, reason: r.reason });
    return { ok: true, status: r.status, reason: r.reason ?? null };
  },
};

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('content-type')?.includes('application/json')) {
      throw new HttpError(415, 'JSON шаардлагатай');
    }
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || typeof body.action !== 'string') throw new HttpError(400, 'action шаардлагатай');
    const handler = Object.prototype.hasOwnProperty.call(ACTIONS, body.action) ? ACTIONS[body.action] : null;
    if (!handler) throw new HttpError(400, 'Танигдаагүй үйлдэл');
    const ctx = await context(request, body.sokhId);
    return NextResponse.json(await handler(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
