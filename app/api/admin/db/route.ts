import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole, type AuthRole } from '@/app/lib/session-token';
import { adminDbLimiter } from '@/app/lib/rate-limit';

// Role тус бүрд зөвшөөрөгдсөн хүснэгтүүд
type Role = AuthRole;

// Бүх role-д нийтлэг хүснэгтүүд
const COMMON_TABLES = new Set([
  'sokh_organizations', 'announcements',
]);

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
    // ОСНАА зөвхөн utility, residents, payments
    'sokh_organizations', 'residents', 'utility_usage', 'payments', 'announcements',
  ]),
  inspector: new Set([
    // Inspector зөвхөн уншиж utility_usage бичих эрхтэй
    'sokh_organizations', 'residents', 'utility_usage',
  ]),
};

// Inspector зөвхөн select + utility_usage-д update хийж болно
const INSPECTOR_WRITE_TABLES = new Set(['utility_usage']);

// Мэдрэмтгий column-уудыг select-ээс хориглох
const BLOCKED_COLUMNS = new Set(['password', 'password_hash', 'secret', 'token']);

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
    const { table, action, params } = body;

    if (!table || !action) {
      return NextResponse.json({ error: 'table and action required' }, { status: 400 });
    }

    // Role-д зөвшөөрөгдсөн хүснэгт шалгах
    const role = auth.role;
    const allowedTables = ROLE_TABLES[role];
    if (!allowedTables.has(table)) {
      return NextResponse.json({ error: 'Table not allowed for your role' }, { status: 403 });
    }

    // Inspector-д бичих эрх хязгаарлах
    if (role === 'inspector' && action !== 'select' && !INSPECTOR_WRITE_TABLES.has(table)) {
      return NextResponse.json({ error: 'Write access denied for your role' }, { status: 403 });
    }

    let query;

    switch (action) {
      case 'select': {
        // Мэдрэмтгий column шалгах
        const selectStr: string = params?.select || '*';
        if (selectStr !== '*') {
          const cols = selectStr.split(',').map((c: string) => c.trim().split('(')[0].trim());
          if (cols.some((c: string) => BLOCKED_COLUMNS.has(c))) {
            return NextResponse.json({ error: 'Access to sensitive columns denied' }, { status: 403 });
          }
        }
        query = supabaseAdmin.from(table).select(selectStr);
        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq)) {
            query = query.eq(key, value);
          }
        }
        if (params?.in) {
          for (const [key, value] of Object.entries(params.in)) {
            query = query.in(key, value as any[]);
          }
        }
        if (params?.not) {
          for (const [key, value] of Object.entries(params.not)) {
            query = query.not(key, 'is', value);
          }
        }
        if (params?.order) {
          query = query.order(params.order.column, { ascending: params.order.ascending ?? false });
        }
        if (params?.limit) {
          query = query.limit(params.limit);
        }
        if (params?.single) {
          query = query.single();
        }
        if (params?.count) {
          query = supabaseAdmin.from(table).select(params?.select || '*', { count: 'exact', head: true });
          if (params?.eq) {
            for (const [key, value] of Object.entries(params.eq)) {
              query = query.eq(key, value);
            }
          }
        }
        break;
      }
      case 'insert': {
        query = supabaseAdmin.from(table).insert(params.data);
        break;
      }
      case 'upsert': {
        query = supabaseAdmin.from(table).upsert(params.data);
        break;
      }
      case 'update': {
        query = supabaseAdmin.from(table).update(params.data);
        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq)) {
            query = query.eq(key, value);
          }
        }
        break;
      }
      case 'delete': {
        query = supabaseAdmin.from(table).delete();
        if (params?.eq) {
          for (const [key, value] of Object.entries(params.eq)) {
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

    // Write операцуудыг audit log-д бичих
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
