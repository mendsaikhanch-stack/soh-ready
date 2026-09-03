import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { DEFAULT_TARIFF, orgTariff, setupFee, monthlyFee } from '@/app/lib/platform-pricing';

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

  // Нэг нэхэмжлэл төлсөнд тэмдэглэх.
  // paid_at-ыг илгээж болно — мөнгө өчигдөр орсныг өнөөдөр бүртгэх нь элбэг.
  if (body.action === 'mark_paid') {
    const { id, paid_amount, paid_at } = body;
    let paidAt = new Date().toISOString();
    if (paid_at) {
      const d = new Date(paid_at);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Төлсөн огноо буруу байна' }, { status: 400 });
      }
      paidAt = d.toISOString();
    }
    const { data, error } = await supabaseAdmin
      .from('platform_invoices')
      .update({
        status: 'paid',
        paid_at: paidAt,
        paid_amount: paid_amount || 0,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Төлсөн тэмдэглэгээг буцаах — андуурч дарсан, эсвэл мөнгө буцаагдсан үед
  if (body.action === 'unmark_paid') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id шаардлагатай' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('platform_invoices')
      .update({ status: 'pending', paid_at: null, paid_amount: null })
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

  // Тарифаар нэг СӨХ-д нэхэмжлэл үүсгэх (суурилуулалт эсвэл сарын хураамж).
  // Захиалга (sokh_subscriptions) шаарддаггүй — тариф бүх СӨХ-д ижил тул
  // айлын тоо × нэгжийн үнэ гэсэн тооцоо хангалттай.
  if (body.action === 'create') {
    const { sokh_id, kind, period_year, period_month, mark_paid } = body;

    if (!sokh_id || !period_year || !period_month) {
      return NextResponse.json({ error: 'sokh_id, period_year, period_month шаардлагатай' }, { status: 400 });
    }
    if (kind !== 'setup' && kind !== 'monthly') {
      return NextResponse.json({ error: 'kind нь setup эсвэл monthly байна' }, { status: 400 });
    }

    // Тариф + айлын тоог СЕРВЕР дээр дахин тооцно. Клиентээс ирсэн дүнд
    // найдвал хөтчөөс дүнг өөрчилж, дурын нэхэмжлэл бичих боломж үүснэ.
    const { data: tRow } = await supabaseAdmin
      .from('platform_tariff').select('*').eq('id', 1).maybeSingle();
    const tariff = { ...DEFAULT_TARIFF, ...(tRow || {}) };

    // СӨХ тус бүрийн хөнгөлөлтийг тооцно — гэрээ, нэхэмжлэх хоёр зөрөх ёсгүй
    const { data: orgBilling } = await supabaseAdmin
      .from('sokh_organizations')
      .select('free_months_override, setup_discount_percent')
      .eq('id', sokh_id)
      .maybeSingle();
    const orgT = orgTariff(
      tariff,
      (orgBilling?.free_months_override as number) ?? null,
      (orgBilling?.setup_discount_percent as number) ?? null,
    );

    const { count } = await supabaseAdmin
      .from('residents')
      .select('id', { count: 'exact', head: true })
      .eq('sokh_id', sokh_id);
    const apartments = count || 0;

    if (apartments === 0) {
      return NextResponse.json({ error: 'Айлгүй СӨХ-д нэхэмжлэл үүсгэхгүй' }, { status: 400 });
    }

    const amount = kind === 'setup'
      ? setupFee(orgT, apartments)
      : monthlyFee(orgT, apartments);

    // Тухайн сарын дараа сарын 15-нд төлөх хугацаа дуусна
    const dueDate = new Date(period_year, period_month, 15).toISOString().split('T')[0];

    const row: Record<string, unknown> = {
      sokh_id,
      kind,
      period_year,
      period_month,
      amount,
      calculation_details: {
        apartments,
        per_unit_fee: kind === 'setup' ? orgT.setup_per_unit : orgT.monthly_per_unit,
        ...(kind === 'setup' && orgBilling?.setup_discount_percent
          ? { list_per_unit_fee: tariff.setup_per_unit,
              discount_percent: orgBilling.setup_discount_percent }
          : {}),
        unit_total: amount,
        plan_name: kind === 'setup' ? 'Суурилуулалт' : 'Сарын хураамж',
      },
      status: mark_paid ? 'paid' : 'pending',
      due_date: dueDate,
    };
    if (mark_paid) {
      row.paid_at = new Date().toISOString();
      row.paid_amount = amount;
    }

    const { data, error } = await supabaseAdmin
      .from('platform_invoices')
      .upsert([row], { onConflict: 'sokh_id,period_year,period_month,kind' })
      .select()
      .single();

    if (error) {
      console.error('[superadmin/invoices create]', error.message);
      return NextResponse.json(
        { error: 'Нэхэмжлэл үүсгэж чадсангүй. supabase-platform-tariff-migration.sql ажилласан эсэхийг шалгана уу.' },
        { status: 500 },
      );
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'action шаардлагатай' }, { status: 400 });
}
