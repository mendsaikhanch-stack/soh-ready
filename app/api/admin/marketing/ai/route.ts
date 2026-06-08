import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getProviderByName } from '@/app/lib/ai/core';
import { buildFollowUpPrompt, templateFollowUp } from '@/app/lib/marketing/captions';

async function auth() {
  return checkAnyAuth('superadmin');
}

// POST /api/admin/marketing/ai
//   { action: 'follow_up', lead_id }   ← лидэд дагалт мессеж үүсгэх
export async function POST(req: NextRequest) {
  const a = await auth();
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.action !== 'follow_up') {
    return NextResponse.json({ error: 'Тодорхойгүй action' }, { status: 400 });
  }

  const leadId = Number(body.lead_id);
  if (!leadId) return NextResponse.json({ error: 'lead_id шаардлагатай' }, { status: 400 });

  // Лидийн мэдээллийг group/campaign-тай нь авах
  const { data: lead, error: lErr } = await supabaseAdmin
    .from('marketing_leads')
    .select('*, group:marketing_fb_groups(name), campaign:marketing_campaigns(title)')
    .eq('id', leadId)
    .single();
  if (lErr || !lead) return NextResponse.json({ error: 'Лид олдсонгүй' }, { status: 404 });

  const groupName = (lead.group as { name?: string } | null)?.name || null;
  const campaignTitle = (lead.campaign as { title?: string } | null)?.title || null;

  // Layer 2 fallback
  let message = templateFollowUp(lead.name);
  let layer: 'template' | 'ai_enhanced' = 'template';

  // Layer 3 — Anthropic байвал
  const provider = getProviderByName('anthropic');
  if (provider && provider.name !== 'template') {
    try {
      const prompt = buildFollowUpPrompt({
        leadName: lead.name,
        groupName,
        campaignTitle,
        note: lead.note,
      });
      const text = await provider.generateText(prompt, { maxTokens: 500 });
      if (text && text.trim()) {
        message = text.trim();
        layer = 'ai_enhanced';
      }
    } catch (err) {
      console.error('[marketing/ai] follow_up', err instanceof Error ? err.message : 'err');
      // template хэвээр
    }
  }

  // Лид дээр хадгалах
  await supabaseAdmin.from('marketing_leads').update({ follow_up_message: message }).eq('id', leadId);

  return NextResponse.json({
    message,
    layer,
    disclaimer: 'AI-ийн санал. Илгээхээс өмнө шалгаж засаарай.',
  });
}
