import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

// Admin session шалгах
async function isAdminAuthenticated(type: 'admin' | 'superadmin' | 'osnaa' | 'inspector' = 'admin'): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(`${type}-session`)?.value;
  if (!token) return false;

  const parts = token.split(':');
  if (parts.length < 2) return false;

  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return false;

  const maxAge = type === 'admin' ? 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  return Date.now() - timestamp < maxAge;
}

// Admin DB proxy — service_role key ашиглан бүх DB операц хийнэ
export async function POST(request: NextRequest) {
  // Admin session шалгах
  const isAdmin = await isAdminAuthenticated('admin');
  const isSuperAdmin = await isAdminAuthenticated('superadmin');
  const isOsnaa = await isAdminAuthenticated('osnaa');
  const isInspector = await isAdminAuthenticated('inspector');

  if (!isAdmin && !isSuperAdmin && !isOsnaa && !isInspector) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { table, action, params } = body;

    if (!table || !action) {
      return NextResponse.json({ error: 'table and action required' }, { status: 400 });
    }

    let query;

    switch (action) {
      case 'select': {
        query = supabaseAdmin.from(table).select(params?.select || '*');
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
