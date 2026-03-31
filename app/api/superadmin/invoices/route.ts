import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';

async function requireSuperadmin() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') return null;
  return auth;
}

export async function GET(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const sokhId = searchParams.get('sokh_id');

  let query = supabaseAdmin
    .from('platform_invoices')
    .select('*, sokh_organizations(name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) query = query.eq('status', status);
  if (sokhId) query = query.eq('sokh_id', sokhId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (data || []).map((inv: Record<string, unknown>) => ({
    ...inv,
    sokh_name: (inv.sokh_organizations as Record<string, unknown>)?.name,
    sokh_organizations: undefined,
  }));

  return NextResponse.json(formatted);
}

// Нэхэмжлэл үүсгэх (сар бүрийн тооцоо)
export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Нэг нэхэмжлэл төлсөнд тэмдэглэх
  if (body.action === 'mark_paid') {
    const { id, paid_amount } = body;
    const { data, error } = await supabaseAdmin
      .from('platform_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount: paid_amount || 0,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Бүх идэвхтэй захиалгад нэхэмжлэл үүсгэх
  if (body.action === 'generate') {
    const year = body.year || new Date().getFullYear();
    const month = body.month || new Date().getMonth() + 1;

    // Идэвхтэй захиалгуудыг авах
    const { data: subs } = await supabaseAdmin
      .from('sokh_subscriptions')
      .select('*, platform_plans(*)')
      .in('status', ['active', 'trial']);

    if (!subs?.length) {
      return NextResponse.json({ message: 'Идэвхтэй захиалга олдсонгүй', generated: 0 });
    }

    const invoices = [];

    for (const sub of subs) {
      const plan = sub.platform_plans;
      if (!plan) continue;

      // СӨХ-ийн зэрэглэлээс per_unit_fee авах
      let tierPerUnit = 0;
      const { data: org } = await supabaseAdmin
        .from('sokh_organizations')
        .select('tier_id, sokh_tiers(per_unit_fee)')
        .eq('id', sub.sokh_id)
        .single();
      if (org?.sokh_tiers) {
        tierPerUnit = (org.sokh_tiers as unknown as { per_unit_fee: number }).per_unit_fee || 0;
      }

      const custom = sub.custom_pricing || {};
      const baseFee = custom.base_fee ?? plan.base_fee;
      // Давуу эрэмбэ: custom > зэрэглэл > багцын ерөнхий
      const perUnitFee = custom.per_unit_fee ?? (tierPerUnit > 0 ? tierPerUnit : plan.per_unit_fee);
      const commissionPct = custom.commission_percent ?? plan.commission_percent;

      let amount = 0;
      const details: Record<string, unknown> = {
        plan_name: plan.name,
        plan_type: plan.type,
        base_fee: baseFee,
      };

      // Төрлөөс хамаарч тооцоолох
      if (plan.type === 'fixed_monthly' || plan.type === 'one_time') {
        amount = baseFee;
      }

      if (plan.type === 'per_apartment' || plan.type === 'hybrid') {
        const { count } = await supabaseAdmin
          .from('residents')
          .select('id', { count: 'exact', head: true })
          .eq('sokh_id', sub.sokh_id);

        const aptCount = count || 0;
        const unitTotal = perUnitFee * aptCount;
        details.apartments = aptCount;
        details.per_unit_fee = perUnitFee;
        details.unit_total = unitTotal;
        amount += plan.type === 'hybrid' ? baseFee + unitTotal : unitTotal;
      }

      if (plan.type === 'per_transaction' || plan.type === 'hybrid') {
        const { data: txns } = await supabaseAdmin
          .from('platform_transactions')
          .select('commission_amount')
          .eq('sokh_id', sub.sokh_id)
          .gte('created_at', `${year}-${String(month).padStart(2, '0')}-01`)
          .lt('created_at', month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, '0')}-01`);

        const commissionTotal = (txns || []).reduce(
          (sum: number, t: { commission_amount: number }) => sum + (t.commission_amount || 0), 0
        );
        details.commission_percent = commissionPct;
        details.commission_total = commissionTotal;

        if (plan.type === 'per_transaction') {
          amount = commissionTotal;
        } else {
          amount += commissionTotal;
        }
      }

      // Дараа сарын 15-нд хугацаа дуусна
      const dueDate = new Date(year, month, 15).toISOString().split('T')[0];

      invoices.push({
        sokh_id: sub.sokh_id,
        subscription_id: sub.id,
        period_year: year,
        period_month: month,
        amount: Math.round(amount),
        calculation_details: details,
        status: 'pending',
        due_date: dueDate,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('platform_invoices')
      .upsert(invoices, { onConflict: 'sokh_id,period_year,period_month' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ generated: data?.length || 0, invoices: data });
  }

  return NextResponse.json({ error: 'action шаардлагатай' }, { status: 400 });
}
