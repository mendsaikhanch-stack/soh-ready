import { NextResponse } from 'next/server';
import { isBankSmsEnabled } from '@/app/lib/bank-sms/enabled';
import {
  bankSmsAuthFailLimiter, bankSmsDeviceLimiter, bankSmsIpLimiter,
} from '@/app/lib/rate-limit';
import {
  MAX_REQUEST_BYTES, processIncomingSms, resolveDevice, validatePayload,
} from '@/app/lib/bank-sms/core';
import {
  loadDeviceByTokenHash, supabaseBankSmsStore, toDeviceConfig, touchDevice, type DeviceRow,
} from '@/app/lib/bank-sms/store';

// Android SMS дамжуулагчаас банкны SMS хүлээн авна.
//
//   POST /api/bank-sms   { schemaVersion: 1, messageId, sender, body, receivedAt }
//   POST /api/bank-sms   { schemaVersion: 1, type: 'heartbeat', pending, failed, lastSmsAt, appVersion }
//   GET  /api/bank-sms   — холболт шалгах (төхөөрөмжийн нэрийг буцаана)
//
// Нэвтрэлт: `Authorization: Bearer khsms_...` — төхөөрөмж тус бүрийн токен.
// DB-д зөвхөн SHA-256 нь хадгалагдана. Cookie ашигладаггүй тул CSRF хамааралгүй.
//
// Хариу: 200 { accepted: true } → утас дарааллаас хасна. 4xx (401/403-аас бусад)
// → дахин илгээхгүй. 401/403 → тохиргоо засах хүртэл хүлээнэ. 429/5xx → retry.
//
// ⚠️ SMS-ийн бүтэн текстийг лог руу ХЭЗЭЭ Ч бичихгүй.

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authenticate(request: Request): Promise<{ device: DeviceRow } | { response: NextResponse }> {
  const ip = clientIp(request);
  const rl = bankSmsIpLimiter.check(ip);
  if (!rl.allowed) return { response: json({ error: 'rate_limited', retryAfterSec: rl.retryAfterSec }, 429) };

  const r = await resolveDevice(request.headers.get('authorization'), loadDeviceByTokenHash);
  if (!r.ok) {
    const fail = bankSmsAuthFailLimiter.check(ip);
    if (!fail.allowed) return { response: json({ error: 'rate_limited', retryAfterSec: fail.retryAfterSec }, 429) };
    return { response: json({ error: r.error === 'revoked' ? 'device_revoked' : 'unauthorized' }, r.error === 'revoked' ? 403 : 401) };
  }
  const { device } = r;
  // Функц унтраалттай СӨХ-ийн төхөөрөмж — цуцлагдсантай адил (апп илгээхээ зогсооно)
  if (!isBankSmsEnabled(device.sokh_id)) return { response: json({ error: 'device_revoked' }, 403) };

  const drl = bankSmsDeviceLimiter.check(String(device.id));
  if (!drl.allowed) return { response: json({ error: 'rate_limited', retryAfterSec: drl.retryAfterSec }, 429) };
  return { device };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ('response' in auth) return auth.response;
    await touchDevice(auth.device.id, { last_seen_at: new Date().toISOString() });
    return json({
      ok: true,
      device: auth.device.display_name,
      sendersConfigured: (auth.device.allowed_senders || []).length > 0,
    });
  } catch (e) {
    console.error('[bank-sms] GET', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500);
  }
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof authenticate>>;
  try {
    auth = await authenticate(request);
  } catch (e) {
    console.error('[bank-sms] auth', e instanceof Error ? e.message : e);
    return json({ error: 'internal_error' }, 500);
  }
  if ('response' in auth) return auth.response;
  const { device } = auth;
  const nowIso = new Date().toISOString();

  // Хэмжээний хязгаар — header-т итгэхгүй, бодит уртыг бас шалгана
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_REQUEST_BYTES) return json({ error: 'payload_too_large' }, 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_REQUEST_BYTES) return json({ error: 'payload_too_large' }, 413);

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // Утасны төлөвийн мэдээ (дараалалд хэд хүлээж байгаа г.м.)
  if (input && typeof input === 'object' && (input as Record<string, unknown>).type === 'heartbeat') {
    const o = input as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(v, 1e6)) : null);
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);
    await touchDevice(device.id, {
      last_seen_at: nowIso,
      last_status: {
        pending: num(o.pending),
        failed: num(o.failed),
        lastSmsAt: str(o.lastSmsAt, 40),
        lastDeliveryAt: str(o.lastDeliveryAt, 40),
        appVersion: str(o.appVersion, 40),
        reportedAt: nowIso,
      },
    });
    return json({ accepted: true });
  }

  const v = validatePayload(input);
  if (!v.ok) {
    await touchDevice(device.id, { last_seen_at: nowIso, last_error: `payload:${v.error}`, last_error_at: nowIso });
    return json({ accepted: false, error: v.error }, 422);
  }

  try {
    const outcome = await processIncomingSms(supabaseBankSmsStore, toDeviceConfig(device), v.value);
    const stored = outcome.status !== 'ignored';
    await touchDevice(device.id, {
      last_seen_at: nowIso,
      ...(stored ? { last_sms_received_at: nowIso, last_successful_delivery_at: nowIso } : {}),
      ...(outcome.status === 'failed'
        ? { last_error: 'processing_error', last_error_at: nowIso }
        : outcome.status === 'ignored'
          ? { last_error: `ignored:${outcome.reason}`, last_error_at: nowIso }
          : {}),
    });
    return json({
      accepted: outcome.accepted,
      status: outcome.status,
      eventId: outcome.eventId ?? null,
      duplicate: outcome.duplicate ?? false,
    });
  } catch (e) {
    // Event хадгалж чадаагүй (DB тасарсан г.м.) — утас дахин илгээнэ
    console.error('[bank-sms] POST', device.id, e instanceof Error ? e.message : 'unknown');
    await touchDevice(device.id, { last_seen_at: nowIso, last_error: 'server_error', last_error_at: nowIso });
    return json({ accepted: false, error: 'internal_error' }, 500);
  }
}
