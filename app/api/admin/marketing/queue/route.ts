import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getProviderByName } from '@/app/lib/ai/core';
import { selectQueueGroups } from '@/app/lib/marketing/selection';
import { varyCaption, buildRewritePrompt } from '@/app/lib/marketing/captions';
import { COOLDOWN_DAYS } from '@/app/lib/marketing/constants';
import type { FbGroup } from '@/app/lib/marketing/constants';

async function auth() {
  return checkAnyAuth('admin', 'superadmin');
}

// Asia/Ulaanbaatar бүсийн өнөөдрийн огноо (YYYY-MM-DD)
function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  const campaignId = Number(body.campaign_id);
  if (!campaignId) return NextResponse.json({ error: 'campaign_id шаардлагатай' }, { status: 400 });

  const limit = body.limit != null ? Number(body.limit) : undefined;
  const enhance = body.enhance === true;
  const date = todayStr();
  const now = new Date();

  // Кампанит ажил
  const { data: campaign, error: cErr } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (cErr || !campaign) {
    return NextResponse.json({ error: 'Кампанит ажил олдсонгүй' }, { status: 404 });
  }

  // Бүх групп
  const { data: groups, error: gErr } = await supabaseAdmin.from('marketing_fb_groups').select('*');
  if (gErr) {
    console.error('[marketing/queue] groups', gErr.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const selection = selectQueueGroups((groups || []) as FbGroup[], { now, limit });

  // Өнөөдрийн хүлээгдэж буй (queued) item-уудыг цэвэрлэж дахин үүсгэнэ.
  // Постолсон / лид / татгалзсан item-уудыг хадгална.
  await supabaseAdmin
    .from('marketing_queue_items')
    .delete()
    .eq('queue_date', date)
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  // Өнөөдөр аль хэдийн (ямар ч статустай) орсон группүүд
  const { data: existing } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('group_id')
    .eq('queue_date', date)
    .eq('campaign_id', campaignId);
  const already = new Set((existing || []).map((r) => Number(r.group_id)));

  const toAdd = selection.selected.filter((g) => !already.has(g.id));

  // Caption үүсгэх (Layer 2 deterministic)
  const captions = toAdd.map((g, i) =>
    varyCaption(campaign.main_text, g.group_type, i, campaign.link_url),
  );

  // Layer 3 — AI rewrite (сонголтоор)
  let aiEnhanced = false;
  if (enhance && toAdd.length > 0) {
    const provider = getProviderByName('anthropic');
    if (provider && provider.name !== 'template') {
      aiEnhanced = true;
      await Promise.all(
        toAdd.map(async (g, i) => {
          try {
            const prompt = buildRewritePrompt(captions[i], g.group_type, g.name);
            const text = await provider.generateText(prompt, { maxTokens: 500 });
            if (text && text.trim()) captions[i] = text.trim();
          } catch {
            // fallback: Layer 2 caption хэвээр
          }
        }),
      );
    }
  }

  const rows = toAdd.map((g, i) => ({
    campaign_id: campaignId,
    group_id: g.id,
    queue_date: date,
    caption: captions[i],
    status: 'queued',
    ai_enhanced: aiEnhanced,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await supabaseAdmin.from('marketing_queue_items').insert(rows);
    if (insErr) {
      console.error('[marketing/queue] insert', insErr.message);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
  }

  // Дахин уншиж буцаах
  const { data: items } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('*, group:marketing_fb_groups(*)')
    .eq('queue_date', date)
    .eq('campaign_id', campaignId)
    .order('id', { ascending: true });

  return NextResponse.json({
    data: items || [],
    date,
    added: rows.length,
    eligibleCount: selection.eligibleCount,
    aiEnhanced,
    warning: selection.reason,
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
