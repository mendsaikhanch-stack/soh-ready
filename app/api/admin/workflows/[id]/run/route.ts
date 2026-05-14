import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { runRule } from '@/app/lib/automation/runtime';
import type { AutomationRule } from '@/app/api/admin/workflows/route';

// ============================================================
// POST /api/admin/workflows/[id]/run
// ------------------------------------------------------------
// Дүрмийг гар ажиллагаагаар нэг удаа турших. Calendar gate-ийг
// орхиж шууд run хийнэ. Idempotency_key орхино — гар оролдлого үргэлж
// шинэ run үүсгэнэ.
// ============================================================

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const ruleId = parseInt(id, 10);
  if (!Number.isFinite(ruleId)) {
    return NextResponse.json({ error: 'rule id буруу' }, { status: 400 });
  }

  let q = supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('id', ruleId);

  // Admin зөвхөн өөрийн сох-ийн дүрмийг ажиллуулна
  if (auth.role === 'admin' && auth.sokhId) {
    q = q.eq('sokh_id', parseInt(auth.sokhId, 10));
  }

  const { data: rule, error } = await q.maybeSingle();
  if (error || !rule) {
    return NextResponse.json({ error: 'Дүрэм олдсонгүй' }, { status: 404 });
  }

  const outcome = await runRule(rule as AutomationRule, { mode: 'manual' });

  if (outcome.status === 'failed') {
    return NextResponse.json(
      { ok: false, ...outcome },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ...outcome });
}
