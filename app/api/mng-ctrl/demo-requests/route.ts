import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { HOUSEHOLD_RANGES, VALID_STATUSES, VALID_PRIORITIES } from '@/app/lib/demo-requests/constants';

// GET /api/mng-ctrl/demo-requests
//   ?search= &status= &city= &district= &priority= &household=lt100|100_300|300_1000|gt1000
export async function GET(req: NextRequest) {
  const a = await checkAnyAuth('superadmin');
  if (!a.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const search = (sp.get('search') || '').trim();
  const status = sp.get('status') || '';
  const city = (sp.get('city') || '').trim();
  const district = (sp.get('district') || '').trim();
  const priority = sp.get('priority') || '';
  const household = sp.get('household') || '';

  let q = supabaseAdmin.from('soh_demo_requests').select('*').order('created_at', { ascending: false });

  if (status && VALID_STATUSES.has(status as never)) q = q.eq('status', status);
  if (priority && VALID_PRIORITIES.has(priority as never)) q = q.eq('priority', priority);
  if (city) q = q.ilike('city', `%${city}%`);
  if (district) q = q.ilike('district', `%${district}%`);

  const range = HOUSEHOLD_RANGES.find((r) => r.value === household);
  if (range) {
    if (range.min !== undefined) q = q.gte('household_count', range.min);
    if (range.max !== undefined) q = q.lte('household_count', range.max);
  }

  if (search) {
    const esc = search.replace(/[%,]/g, ' ');
    q = q.or(`soh_name.ilike.%${esc}%,phone.ilike.%${esc}%,contact_name.ilike.%${esc}%`);
  }

  const { data, error } = await q.limit(500);
  if (error) {
    console.error('[mng-ctrl/demo-requests] GET', error.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  // Хянах самбарын картанд зориулсан тоонууд (статусаар)
  const { data: allStatuses } = await supabaseAdmin.from('soh_demo_requests').select('status, next_follow_up_at');
  const rows = allStatuses || [];
  const byStatus = (s: string) => rows.filter((r) => r.status === s).length;
  const stats = {
    total: rows.length,
    new: byStatus('new'),
    demo_scheduled: byStatus('demo_scheduled'),
    proposal_sent: byStatus('proposal_sent'),
    won: byStatus('won'),
    later: byStatus('later'),
  };

  return NextResponse.json({ data: data || [], stats });
}
