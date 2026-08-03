// Өдрийн постын дараалал үүсгэх — админы «Дараалал гаргах» товч болон
// өглөөний cron хоёул ЭНЭ функцыг дуудна (логик хоёр газар давхардахгүй).

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getProviderByName } from '@/app/lib/ai/core';
import { selectQueueGroups } from './selection';
import { varyCaption, buildRewritePrompt, campaignUtmSlug, tagCampaignLink } from './captions';
import type { Campaign, FbGroup, GroupType } from './constants';

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

/** YYYY-MM-DD → эрин үеэс хойшх хоногийн дугаар (ротацийн тогтвортой суурь) */
function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** Кампанит ажил тухайн группийн төрөлд тохирох эсэх (хоосон = бүгдэд тохирно) */
export function matchesGroupType(c: Campaign, type: GroupType): boolean {
  if (!c.target_types || c.target_types.length === 0) return true;
  return c.target_types.includes(type);
}

/**
 * Групп бүрд кампанит ажил хуваарилах.
 *
 * Тохирох кампанит ажил хэд байвал группийн id болон огнооноос хамааруулж
 * ээлжлүүлнэ — ингэснээр нэг групп cooldown бүрд өөр текст хүлээж авна
 * (Facebook давхардлын шүүлтээс сэргийлнэ), гэхдээ үр дүн нь тогтвортой.
 */
export function pickCampaignForGroup(
  campaigns: Campaign[],
  group: FbGroup,
  date: string,
): Campaign | null {
  const matches = campaigns
    .filter((c) => matchesGroupType(c, group.group_type))
    .sort((a, b) => a.id - b.id);
  if (matches.length === 0) return null;
  const i = (dayNumber(date) + group.id) % matches.length;
  return matches[i];
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  date: string;
  added: number;
  eligibleCount: number;
  aiEnhanced: boolean;
  warning?: string;
  /** Дараалалд орсон кампанит ажлуудын гарчиг */
  campaignTitles: string[];
}

/**
 * Өнөөдрийн дараалал үүсгэнэ.
 *
 * campaignId өгвөл ЗӨВХӨН тэр кампанит ажлыг ашиглана (гараар сонгосон гэж үзнэ).
 * Өгөхгүй бол идэвхтэй кампанит ажлуудаас групп бүрийн төрөлд тохирохыг сонгоно.
 *
 * Хүлээгдэж буй (queued) item-уудыг цэвэрлээд дахин үүсгэдэг —
 * постолсон / лид / татгалзсан item-ууд хэвээр үлдэнэ.
 */
export async function generateDailyQueue(opts: {
  campaignId?: number | null;
  limit?: number;
  enhance?: boolean;
  now?: Date;
}): Promise<GenerateResult> {
  const now = opts.now ?? new Date();
  const date = ubDateStr(now);
  const enhance = opts.enhance === true;

  const empty = { date, added: 0, eligibleCount: 0, aiEnhanced: false, campaignTitles: [] };

  // 1. Кампанит ажлууд
  let cq = supabaseAdmin.from('marketing_campaigns').select('*');
  cq = opts.campaignId ? cq.eq('id', opts.campaignId) : cq.eq('status', 'active');
  const { data: campaignRows, error: cErr } = await cq;

  if (cErr) {
    console.error('[marketing/generate] campaigns', cErr.message);
    return { ok: false, error: 'DB error', ...empty };
  }
  const campaigns = (campaignRows || []) as Campaign[];
  if (campaigns.length === 0) {
    return {
      ok: false,
      error: opts.campaignId ? 'Кампанит ажил олдсонгүй' : 'Идэвхтэй кампанит ажил алга',
      ...empty,
    };
  }

  // 2. Группүүд + сонголт
  const { data: groups, error: gErr } = await supabaseAdmin.from('marketing_fb_groups').select('*');
  if (gErr) {
    console.error('[marketing/generate] groups', gErr.message);
    return { ok: false, error: 'DB error', ...empty };
  }

  const selection = selectQueueGroups((groups || []) as FbGroup[], { now, limit: opts.limit });

  // 3. Өнөөдрийн хүлээгдэж буй item-уудыг цэвэрлэж дахин үүсгэнэ.
  //    Огноогоор цэвэрлэнэ — нэг өдөрт нэг л дараалал байна.
  await supabaseAdmin
    .from('marketing_queue_items')
    .delete()
    .eq('queue_date', date)
    .eq('status', 'queued');

  // Өнөөдөр аль хэдийн (ямар ч статустай) орсон группүүдийг давхардуулахгүй
  const { data: existing } = await supabaseAdmin
    .from('marketing_queue_items')
    .select('group_id')
    .eq('queue_date', date);
  const already = new Set((existing || []).map((r) => Number(r.group_id)));

  // 4. Групп бүрд кампанит ажил хуваарилж caption үүсгэх
  type Planned = { group: FbGroup; campaign: Campaign; caption: string };
  const planned: Planned[] = [];

  for (const g of selection.selected) {
    if (already.has(g.id)) continue;
    const campaign = pickCampaignForGroup(campaigns, g, date);
    if (!campaign) continue; // энэ төрөлд тохирох текст алга — алгасна

    const taggedLink = tagCampaignLink(
      campaign.link_url,
      campaignUtmSlug(campaign.title, campaign.id),
    );

    // target_types тодорхойлсон кампанит ажлын текст нь тухайн үзэгчид
    // зориулж бичигдсэн тул дэгээ/CTA нэмэхгүй, хэвээр нь ашиглана.
    const tailored = !!campaign.target_types && campaign.target_types.length > 0;
    const caption = tailored
      ? [campaign.main_text.trim(), taggedLink ? `\n🔗 ${taggedLink}` : '']
          .filter(Boolean)
          .join('\n')
      : varyCaption(campaign.main_text, g.group_type, planned.length, taggedLink);

    planned.push({ group: g, campaign, caption });
  }

  // 5. Layer 3 — AI rewrite (сонголтоор)
  let aiEnhanced = false;
  if (enhance && planned.length > 0) {
    const provider = getProviderByName('anthropic');
    if (provider && provider.name !== 'template') {
      aiEnhanced = true;
      await Promise.all(
        planned.map(async (p) => {
          try {
            const prompt = buildRewritePrompt(p.caption, p.group.group_type, p.group.name);
            const text = await provider.generateText(prompt, { maxTokens: 500 });
            if (text && text.trim()) p.caption = text.trim();
          } catch {
            // fallback: Layer 2 caption хэвээр
          }
        }),
      );
    }
  }

  const rows = planned.map((p) => ({
    campaign_id: p.campaign.id,
    group_id: p.group.id,
    queue_date: date,
    caption: p.caption,
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

  // Тэнцэх групп байсан ч тохирох текст олдоогүй бол мэдэгдэнэ
  let warning = selection.reason;
  const skipped = selection.selected.filter((g) => !already.has(g.id)).length - planned.length;
  if (skipped > 0) {
    warning = `${skipped} группэд тохирох кампанит ажил олдсонгүй (тэдгээрийн төрөлд зориулсан идэвхтэй текст алга).${warning ? ' ' + warning : ''}`;
  }

  return {
    ok: true,
    date,
    added: rows.length,
    eligibleCount: selection.eligibleCount,
    aiEnhanced,
    warning,
    campaignTitles: [...new Set(planned.map((p) => p.campaign.title))],
  };
}
