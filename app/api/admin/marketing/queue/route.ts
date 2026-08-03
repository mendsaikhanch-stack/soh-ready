import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { generateDailyQueue, ubDateStr } from '@/app/lib/marketing/generate';
import { COOLDOWN_DAYS } from '@/app/lib/marketing/constants';

async function auth() {
  return checkAnyAuth('superadmin');
}

// Asia/Ulaanbaatar бүсийн өнөөдрийн огноо (YYYY-MM-DD)
function todayStr(): string {
  return ubDateStr();
}

// GET /api/admin/marketing/queue?date=YYYY-MM-DD  (default: өнөөдөр)
export async function GET(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = new URL(req.url).searchParams.get('date') || todayStr();
  const { data, error } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('*, group:marketing_fb_groups(*)')
    .eq('queue_date', date)
    .order('id', { ascending: true });

  if (error) {
    console.error('[marketing/queue] GET', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }
  return NextResponse.json({ data: data || [], date });
}

// POST /api/admin/marketing/queue
//   { action: 'generate', campaign_id, limit?, enhance? }
//   { action: 'mark_posted'|'pending'|'rejected'|'requeue', id }
export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body.action || '');

  if (action === 'generate') return generateQueue(body);
  if (['mark_posted', 'pending', 'rejected', 'requeue'].includes(action)) {
    return updateItemStatus(action, Number(body.id));
  }
  return NextResponse.json({ error: 'Тодорхойгүй action' }, { status: 400 });
}

async function generateQueue(body: Record<string, unknown>): Promise<NextResponse> {
  // campaign_id хоосон бол групп бүрийн төрлөөр автоматаар сонгоно
  const campaignId = body.campaign_id ? Number(body.campaign_id) : null;
  const res = await generateDailyQueue({
    campaignId,
    limit: body.limit != null ? Number(body.limit) : undefined,
    enhance: body.enhance === true,
  });

  if (!res.ok) {
    const status = res.error === 'Кампанит ажил олдсонгүй' ? 404 : res.error === 'DB error' ? 500 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  // Дахин уншиж буцаах
  const { data: items } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('*, group:marketing_fb_groups(*)')
    .eq('queue_date', res.date)
    .order('id', { ascending: true });

  return NextResponse.json({
    data: items || [],
    date: res.date,
    added: res.added,
    eligibleCount: res.eligibleCount,
    aiEnhanced: res.aiEnhanced,
    warning: res.warning,
    campaignTitles: res.campaignTitles,
  });
}

async function updateItemStatus(action: string, id: number): Promise<NextResponse> {
  if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });

  // Item-ийг авах
  const { data: item, error: iErr } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('*')
    .eq('id', id)
    .single();
  if (iErr || !item) return NextResponse.json({ error: 'Item олдсонгүй' }, { status: 404 });

  const now = new Date();

  if (action === 'mark_posted') {
    const nextAllowed = new Date(now.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    // 1. Queue item-ийг постолсон болгох
    await supabaseAdmin
      .from('marketing_queue_items')
      .update({ status: 'posted', posted_at: now.toISOString() })
      .eq('id', id);

    // 2. Группийн cooldown + тоолуур шинэчлэх
    const { data: g } = await supabaseAdmin
      .from('marketing_fb_groups')
      .select('posts_count')
      .eq('id', item.group_id)
      .single();
    await supabaseAdmin
      .from('marketing_fb_groups')
      .update({
        last_posted_at: now.toISOString(),
        next_allowed_at: nextAllowed.toISOString(),
        posts_count: (g?.posts_count || 0) + 1,
      })
      .eq('id', item.group_id);

    // 3. Постын лог үүсгэх
    await supabaseAdmin.from('marketing_posting_logs').insert([
      {
        group_id: item.group_id,
        campaign_id: item.campaign_id,
        queue_item_id: item.id,
        caption: item.caption,
        posted_at: now.toISOString(),
      },
    ]);

    return NextResponse.json({ ok: true, status: 'posted' });
  }

  const map: Record<string, string> = {
    pending: 'pending_approval',
    rejected: 'rejected',
    requeue: 'queued',
  };
  const newStatus = map[action];
  await supabaseAdmin.from('marketing_queue_items').update({ status: newStatus }).eq('id', id);
  return NextResponse.json({ ok: true, status: newStatus });
}
