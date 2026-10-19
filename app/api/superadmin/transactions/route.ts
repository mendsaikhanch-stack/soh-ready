import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';

// QPay callback-аас бичигдсэн платформын комиссын гүйлгээнүүд
export async function GET() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data || []);
}
