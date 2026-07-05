import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { computeTally, finalizeIfNeeded } from '@/app/lib/board-server';

// GET /api/vote/[id] — санал өгөх хуудсанд харуулах нийтийн мэдээлэл + тооллого
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);
  if (!proposalId) return NextResponse.json({ error: 'Буруу ID' }, { status: 400 });

  const { data: p } = await supabaseAdmin
    .from('proposals')
    .select('id, title, description, budget_amount, status, kind, org_name, pass_threshold_percentage, auto_approve_on_timeout, expires_at, sokh_id')
    .eq('id', proposalId)
    .single();

  if (!p) return NextResponse.json({ error: 'Санал асуулга олдсонгүй' }, { status: 404 });

  // Хугацаа дуусах/бүх санал орсон бол статусыг шинэчилнэ
  const status = await finalizeIfNeeded(p);
  const tally = await computeTally(proposalId);

  return NextResponse.json({
    proposal: {
      id: p.id,
      title: p.title,
      description: p.description,
      budget_amount: p.budget_amount,
      status,
      kind: p.kind,
      org_name: p.org_name,
      expires_at: p.expires_at,
    },
    tally,
  });
}
