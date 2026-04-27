import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole, type AuthRole } from '@/app/lib/session-token';
import { adminDbLimiter } from '@/app/lib/rate-limit';

// Role тус бүрд зөвшөөрөгдсөн хүснэгтүүд
type Role = AuthRole;

const ROLE_TABLES: Record<Role, Set<string>> = {
  superadmin: new Set([
    // Superadmin бүх хүснэгтэд хандах эрхтэй
    'sokh_organizations', 'residents', 'payments', 'announcements',
    'maintenance_requests', 'complaints', 'parking_vehicles', 'parking_events',
    'utility_usage', 'chat_messages', 'polls', 'poll_votes', 'packages',
    'staff', 'emergency_alerts', 'bookings', 'bookable_spaces', 'shops',
    'vending_machines', 'elevator_maintenance', 'cctv_cameras', 'cctv_ai_alerts',
    'cctv_requests', 'marketplace_listings', 'scheduled_notifications',
    'push_subscriptions', 'visitor_passes', 'org_features', 'points_ledger',
    'resident_points', 'finance_entries', 'budget_categories', 'error_logs',
    'platform_plans', 'sokh_subscriptions', 'platform_invoices',
    'platform_bank_accounts', 'platform_transactions', 'sokh_tiers',
    'ebarimt_configs',
  ]),
  admin: new Set([
    // Admin өөрийн СӨХ-д холбогдох хүснэгтүүд
    'sokh_organizations', 'residents', 'payments', 'announcements',
    'maintenance_requests', 'complaints', 'parking_vehicles', 'parking_events',
    'utility_usage', 'chat_messages', 'polls', 'poll_votes', 'packages',
    'staff', 'emergency_alerts', 'bookings', 'bookable_spaces', 'shops',
    'vending_machines', 'elevator_maintenance', 'cctv_cameras', 'cctv_ai_alerts',
    'cctv_requests', 'marketplace_listings', 'scheduled_notifications',
    'push_subscriptions', 'visitor_passes', 'org_features', 'points_ledger',
    'resident_points', 'finance_entries', 'budget_categories',
  ]),
  osnaa: new Set([
    'sokh_organizations', 'residents', 'utility_usage', 'payments', 'announcements',
  ]),
  inspector: new Set([
    'sokh_organizations', 'residents', 'utility_usage',
  ]),
};

const INSPECTOR_WRITE_TABLES = new Set(['utility_usage']);

const BLOCKED_COLUMNS = new Set(['password', 'password_hash', 'secret', 'token']);

// Зөвхөн superadmin-д зөвшөөрөгдсөн хүснэгтүүд (платформын төвшний)
const PLATFORM_ONLY_TABLES = new Set([
  'platform_plans', 'platform_bank_accounts', 'sokh_tiers', 'ebarimt_configs',
  'error_logs', 'audit_logs',
]);

// resident_id-аар хязгаарлагддаг хүснэгтүүд (sokh_id шууд байхгүй)
const VIA_RESIDENT_TABLES = new Set(['payments', 'poll_votes']);

type EnforceResult =
  | { ok: true; params: Record<string, unknown> }
  | { ok: false; error: string; status: number };

/**
 * Олон-түрээслэгчийн (multi-tenant) хязгаарлалтыг тулгах:
 * - superadmin → бүх юу нь
 * - бусад role → зөвхөн өөрийн sokh_id дотор уншиж/бичих боломжтой
 * Ямар ч cross-tenant хүсэлтийг 403-аар буцаана.
 */
async function enforceTenantScope(
  table: string,
  action: string,
  paramsIn: Record<string, unknown> | undefined,
  authRole: AuthRole,
  authSokhIdRaw: string | undefined,
): Promise<EnforceResult> {
  const params: Record<string, unknown> = { ...(paramsIn || {}) };

  if (authRole === 'superadmin') return { ok: true, params };

  if (PLATFORM_ONLY_TABLES.has(table)) {
    return { ok: false, error: 'Зөвхөн superadmin', status: 403 };
  }

  const sokhId = authSokhIdRaw ? parseInt(authSokhIdRaw, 10) : 0;
  if (!sokhId) return { ok: false, error: 'Session-д sokh_id байхгүй', status: 403 };

  // sokh_organizations: id-ээр scope
  if (table === 'sokh_organizations') {
    if (action === 'insert' || action === 'upsert' || action === 'delete') {
      return { ok: false, error: 'sokh_organizations-г бүтээх/устгах эрхгүй', status: 403 };
    }
    const eq = { ...((params.eq as Record<string, unknown>) || {}) };
    if (eq.id !== undefined && Number(eq.id) !== sokhId) {
      return { ok: false, error: 'Cross-tenant access denied', status: 403 };
    }
    eq.id = sokhId;
    params.eq = eq;
    return { ok: true, params };
  }

  // payments / poll_votes: resident_id-ээр шалгах
  if (VIA_RESIDENT_TABLES.has(table)) {
    const residentIds: number[] = [];
    if (action === 'select' || action === 'update' || action === 'delete') {
      const eqResident = (params.eq as Record<string, unknown> | undefined)?.resident_id;
      const inResident = (params.in as Record<string, unknown[]> | undefined)?.resident_id;
      if (eqResident !== undefined) residentIds.push(Number(eqResident));
      if (Array.isArray(inResident)) for (const v of inResident) residentIds.push(Number(v));
      if (residentIds.length === 0) {
        return { ok: false, error: 'resident_id шаардлагатай', status: 400 };
      }
    } else {
      // insert/upsert
      const dataIn = params.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const dataArr = Array.isArray(dataIn) ? dataIn : dataIn ? [dataIn] : [];
      if (dataArr.length === 0) return { ok: false, error: 'data шаардлагатай', status: 400 };
      for (const d of dataArr) {
        if (!d || d.resident_id === undefined) {
          return { ok: false, error: 'resident_id шаардлагатай', status: 400 };
        }
        residentIds.push(Number(d.resident_id));
      }
    }
    const { data: rows } = await supabaseAdmin
      .from('residents')
      .select('id, sokh_id')
      .in('id', residentIds);
    const found = new Set((rows || []).map(r => Number(r.id)));
    for (const id of residentIds) {
      if (!found.has(id)) return { ok: false, error: 'Resident олдсонгүй', status: 404 };
    }
    for (const r of rows || []) {
      if (Number(r.sokh_id) !== sokhId) {
        return { ok: false, error: 'Cross-tenant resident access denied', status: 403 };
      }
    }
    return { ok: true, params };
  }

  // Үлдсэн бүх хүснэгтэд sokh_id шаардах
  if (action === 'select' || action === 'update' || action === 'delete') {
    const eq = { ...((params.eq as Record<string, unknown>) || {}) };
    if (eq.sokh_id !== undefined && Number(eq.sokh_id) !== sokhId) {
      return { ok: false, error: 'Cross-tenant access denied', status: 403 };
    }
    eq.sokh_id = sokhId;
    params.eq = eq;
  } else if (action === 'insert' || action === 'upsert') {
    const dataIn = params.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
    const dataArr = Array.isArray(dataIn) ? dataIn : dataIn ? [dataIn] : [];
    if (dataArr.length === 0) return { ok: false, error: 'data шаардлагатай', status: 400 };
    const validated: Record<string, unknown>[] = [];
    for (const d of dataArr) {
      if (!d) continue;
      if (d.sokh_id !== undefined && Number(d.sokh_id) !== sokhId) {
        return { ok: false, error: 'Cross-tenant insert denied', status: 403 };
      }
      validated.push({ ...d, sokh_id: sokhId });
    }
    params.data = Array.isArray(dataIn) ? validated : validated[0];
  }

  // Update үед sokh_id-г өөрчлөх оролдлогыг хорих
  if (action === 'update') {
    const updateData = params.data as Record<string, unknown> | undefined;
    if (updateData && Object.prototype.hasOwnProperty.call(updateData, 'sokh_id')) {
      if (Number(updateData.sokh_id) !== sokhId) {
        return { ok: false, error: 'sokh_id-г өөрчлөх боломжгүй', status: 403 };
      }
    }
  }

  return { ok: true, params };
}

// Admin DB proxy — service_role key ашиглан зөвшөөрөгдсөн хүснэгт дээр DB операц хийнэ
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
  const rl = adminDbLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await getAuthRole();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { table, action, params: rawParams } = body;

    if (!table || !action) {
      return NextResponse.json({ error: 'table and action required' }, { status: 400 });
    }

    const role = auth.role;
    const allowedTables = ROLE_TABLES[role];
    if (!allowedTables.has(table)) {
      return NextResponse.json({ error: 'Table not allowed for your role' }, { status: 403 });
    }

    if (role === 'inspector' && action !== 'select' && !INSPECTOR_WRITE_TABLES.has(table)) {
      return NextResponse.json({ error: 'Write access denied for your role' }, { status: 403 });
    }

    // Multi-tenant enforcement
    const enforced = await enforceTenantScope(table, action, rawParams, role, auth.sokhId);
    if (!enforced.ok) {
      return NextResponse.json({ error: enforced.error }, { status: enforced.status });
    }
    const params = enforced.params;

    let query;

    switch (action) {
      case 'select': {
        const selectStr: string = (params?.select as string) || '*';
        if (selectStr !== '*') {
          const cols = selectStr.split(',').map((c: string) => c.trim().split('(')[0].trim());
          if (cols.some((c: string) => BLOCKED_COLUMNS.has(c))) {
            return NextResponse.json({ error: 'Access to sensitive columns denied' }, { status: 403 });
          }
        }

        if (params?.count) {
          // Count хүсэлтэд бүх eq/in filter мөн хэрэгжинэ
          query = supabaseAdmin.from(table).select(selectStr, { count: 'exact', head: true });
        } else {
          query = supabaseAdmin.from(table).select(selectStr);
        }

        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq as Record<string, unknown>)) {
            query = query.eq(key, value);
          }
        }
        if (params?.in) {
          for (const [key, value] of Object.entries(params.in as Record<string, unknown[]>)) {
            query = query.in(key, value);
          }
        }
        if (params?.not) {
          for (const [key, value] of Object.entries(params.not as Record<string, unknown>)) {
            query = query.not(key, 'is', value);
          }
        }
        if (!params?.count) {
          if (params?.order) {
            const ord = params.order as { column: string; ascending?: boolean };
            query = query.order(ord.column, { ascending: ord.ascending ?? false });
          }
          if (params?.limit) {
            query = query.limit(params.limit as number);
          }
          if (params?.single) {
            query = query.single();
          }
        }
        break;
      }
      case 'insert': {
        query = supabaseAdmin.from(table).insert(params.data as Record<string, unknown> | Record<string, unknown>[]);
        break;
      }
      case 'upsert': {
        query = supabaseAdmin.from(table).upsert(params.data as Record<string, unknown> | Record<string, unknown>[]);
        break;
      }
      case 'update': {
        query = supabaseAdmin.from(table).update(params.data as Record<string, unknown>);
        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq as Record<string, unknown>)) {
            query = query.eq(key, value);
          }
        }
        break;
      }
      case 'delete': {
        query = supabaseAdmin.from(table).delete();
        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq as Record<string, unknown>)) {
            query = query.eq(key, value);
          }
        }
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[admin/db]', table, action, error.message);
      return NextResponse.json({ error: 'Database operation failed' }, { status: 500 });
    }

    if (action !== 'select') {
      Promise.resolve(
        supabaseAdmin.from('audit_logs').insert({
          user_id: auth.userId ? parseInt(auth.userId) : null,
          role,
          action,
          table_name: table,
          details: params?.eq || params?.data ? JSON.stringify(params.eq || params.data).slice(0, 1000) : null,
        })
      ).catch(() => {});
    }

    return NextResponse.json({ data, count });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[admin/db] unexpected:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
