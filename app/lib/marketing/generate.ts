// Өдрийн постын дараалал үүсгэх — админы «Дараалал гаргах» товч болон
// өглөөний cron хоёул ЭНЭ функцыг дуудна (логик хоёр газар давхардахгүй).

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getProviderByName } from '@/app/lib/ai/core';
import { selectQueueGroups } from './selection';
import { varyCaption, buildRewritePrompt, campaignUtmSlug, tagCampaignLink } from './captions';
import type { FbGroup } from './constants';

/** Asia/Ulaanbaatar бүсийн огноо (YYYY-MM-DD) */
export function ubDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** N хоногийн өмнөх UB огноо */
export function ubDateStrAgo(days: number): string {
  return ubDateStr(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  date: string;
  added: number;
  eligibleCount: number;
  aiEnhanced: boolean;
  warning?: string;
}

/**
 * Тухайн кампанит ажлаар өнөөдрийн дараалал үүсгэнэ.
 * Хүлээгдэж буй (queued) item-уудыг цэвэрлээд дахин үүсгэдэг —
 * постолсон / лид / татгалзсан item-ууд хэвээр үлдэнэ.
 */
export async function generateDailyQueue(opts: {
  campaignId: number;
  limit?: number;
  enhance?: boolean;
  now?: Date;
}): Promise<GenerateResult> {
  const { campaignId } = opts;
  const now = opts.now ?? new Date();
  const date = ubDateStr(now);
  const enhance = opts.enhance === true;

  const empty = { date, added: 0, eligibleCount: 0, aiEnhanced: false };

  if (!campaignId) return { ok: false, error: 'campaign_id шаардлагатай', ...empty };

  const { data: campaign, error: cErr } = await supabaseAdmin
    .from('marketing_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  if (cErr || !campaign) return { ok: false, error: 'Кампанит ажил олдсонгүй', ...empty };

  const { data: groups, error: gErr } = await supabaseAdmin.from('marketing_fb_groups').select('*');
  if (gErr) {
    console.error('[marketing/generate] groups', gErr.message);
    return { ok: false, error: 'DB error', ...empty };
  }

  const selection = selectQueueGroups((groups || []) as FbGroup[], { now, limit: opts.limit });

  // Өнөөдрийн хүлээгдэж буй item-уудыг цэвэрлэж дахин үүсгэнэ
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

  // Caption үүсгэх (Layer 2 deterministic).
  // Кампанит ажил бүрийн линкэнд ялгаатай utm_campaign автоматаар залгана.
  const taggedLink = tagCampaignLink(campaign.link_url, campaignUtmSlug(campaign.title, campaign.id));
  const captions = toAdd.map((g, i) => varyCaption(campaign.main_text, g.group_type, i, taggedLink));

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
      console.error('[marketing/generate] insert', insErr.message);
      return { ok: false, error: 'DB error', ...empty };
    }
  }

  return {
    ok: true,
    date,
    added: rows.length,
    eligibleCount: selection.eligibleCount,
    aiEnhanced,
    warning: selection.reason,
  };
}
