import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

// Хэрэглэгчийн "СӨХ олдсонгүй" хүсэлтүүдийг жагсаах + статус шинэчлэх
export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  let q = supabaseAdmin
    .from('user_signup_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'Хүсэлт татаж чадсангүй' }, { status: 500 });
  }
  return NextResponse.json({ requests: data || [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status, matched_directory_id } = body;
    if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
    if (status && !['PENDING', 'MATCHED', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Статус буруу' }, { status: 400 });
    }
    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (matched_directory_id !== undefined) update.matched_directory_id = matched_directory_id;

    const { error } = await supabaseAdmin.from('user_signup_requests').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
