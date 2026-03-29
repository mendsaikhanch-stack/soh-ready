import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function isSuperAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('superadmin-session')?.value;
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length < 2) return false;
  const timestamp = parseInt(parts[0]);
  return Date.now() - timestamp <= 12 * 60 * 60 * 1000;
}

// GET — бүх админ хэрэглэгчид
export async function GET() {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await sb
    .from('admin_users')
    .select('id, username, sokh_id, role, display_name, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // СӨХ нэрийг нэмэх
  const sokhIds = [...new Set((data || []).filter(u => u.sokh_id).map(u => u.sokh_id))];
  let sokhMap: Record<number, string> = {};
  if (sokhIds.length > 0) {
    const { data: sokhs } = await sb.from('sokh_organizations').select('id, name').in('id', sokhIds);
    sokhMap = Object.fromEntries((sokhs || []).map(s => [s.id, s.name]));
  }

  const users = (data || []).map(u => ({
    ...u,
    sokh_name: u.sokh_id ? sokhMap[u.sokh_id] || '?' : null,
  }));

  return NextResponse.json({ users });
}

// POST — шинэ админ үүсгэх
export async function POST(request: Request) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username, password, sokh_id, role, display_name } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username, password шаардлагатай' }, { status: 400 });
  }

  // Давхардал шалгах
  const { data: existing } = await sb.from('admin_users').select('id').eq('username', username).single();
  if (existing) {
    return NextResponse.json({ error: 'Энэ нэр бүртгэлтэй байна' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await sb.from('admin_users').insert([{
    username,
    password_hash,
    sokh_id: sokh_id || null,
    role: role || 'admin',
    display_name: display_name || username,
    status: 'active',
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, user: data });
}

// PATCH — админ засах (status, password reset)
export async function PATCH(request: Request) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, status, password, display_name, sokh_id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (display_name) updates.display_name = display_name;
  if (sokh_id !== undefined) updates.sokh_id = sokh_id || null;

  const passwordChanged = !!password;
  if (password) updates.password_hash = await bcrypt.hash(password, 12);

  const { error } = await sb.from('admin_users').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Нууц үг солигдсон бол хуучин session-уудыг хүчингүй болгох
  if (passwordChanged || status === 'inactive') {
    await sb.from('admin_sessions').delete().eq('user_id', id);
  }

  return NextResponse.json({ success: true, passwordChanged });
}

// DELETE — админ устгах
export async function DELETE(request: Request) {
  if (!await isSuperAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  const { error } = await sb.from('admin_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
