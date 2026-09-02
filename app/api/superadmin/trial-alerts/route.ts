import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import {
  DEFAULT_TARIFF,
  billingStartDate,
  orgTariff,
  daysBetweenUb,
  freeMonths,
  monthlyFee,
  trialAlertLevel,
  ubDay,
  TRIAL_ALERT_LEAD_DAYS,
  type PlatformTariff,
  type TrialAlertLevel,
} from '@/app/lib/platform-pricing';

// Үнэгүй ашиглах хугацаа дуусах гэж буй СӨХ-үүд.
//
// Үнэгүй хугацаа нь идэвхжсэн өдрөөс хойш 150-аас доош айлтай бол 1 сар,
// түүнээс дээш бол 2 сар (тарифаас уншина) — тухайн СӨХ-д сунгасан бол
// `free_months_override` давамгайлна. Тэр өдөр болоход төлбөр эхлэх
// ёстой ч хэн ч сануулахгүй бол мартагдана — энэ endpoint нь суперадмины
// хянах самбарын анхааруулгыг тэжээнэ.
//
// Хөнгөн байлгах нь чухал: цэсэн дээрх тоог хуудас солих бүрд татна.

export const dynamic = 'force-dynamic';

export interface TrialAlert {
  sokh_id: number;
  name: string;
  apartments: number;
  free_months: number;
  /** Үнэгүй хугацаа дуусах өдөр (UB, YYYY-MM-DD) */
  ends_on: string;
  ends_at: string;
  /** 0 = өнөөдөр, эерэг = үлдсэн хоног, сөрөг = хэдэн хоногийн өмнө дууссан */
  days_left: number;
  monthly_fee: number;
  /** Сарын нэхэмжлэх үүссэн эсэх */
  invoiced: boolean;
  level: TrialAlertLevel;
}

export async function GET() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Тариф (миграц ажиллаагүй бол үндсэн утгаар — сануулга ажиллаад байх нь
  // огт ажиллахгүй байснаас дээр)
  let tariff: PlatformTariff = DEFAULT_TARIFF;
  const { data: tRow } = await supabaseAdmin
    .from('platform_tariff')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (tRow) tariff = { ...DEFAULT_TARIFF, ...tRow };

  // Зөвхөн идэвхжсэн СӨХ-д үнэгүй хугацаа тоологдоно (activated_at-аас)
  const { data: orgs, error } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, activated_at')
    .eq('claim_status', 'active')
    .not('activated_at', 'is', null);

  if (error) {
    console.error('[superadmin/trial-alerts]', error.message);
    return NextResponse.json({ error: 'Байгууллага уншиж чадсангүй' }, { status: 500 });
  }

  const real = (orgs || []).filter(o => !isDemoSokh(Number(o.id)));
  if (!real.length) return NextResponse.json({ alerts: [], counts: emptyCounts(), today: ubDay() });

  const ids = real.map(o => Number(o.id));

  // Айлын тоо — residents-ийн бодит мөрөөр (unit_count нь гараар бичсэн тоо).
  // СӨХ бүрд тусад нь count авна: нэг select-ээр татвал Supabase-ийн мөрийн
  // тааз (1000) том СӨХ дээр дутуу тоолно.
  const counts = await Promise.all(
    ids.map(async id => {
      const { count } = await supabaseAdmin
        .from('residents')
        .select('id', { count: 'exact', head: true })
        .eq('sokh_id', id);
      return [id, count || 0] as const;
    })
  );
  const aptCount = new Map<number, number>(counts);

  // Сарын нэхэмжлэх үүссэн эсэх — үнэгүй хугацаа дууссан ч нэхэмжлэхгүй
  // үлдсэн СӨХ л «мартагдсан» гэж тооцогдоно.
  const { data: invoices } = await supabaseAdmin
    .from('platform_invoices')
    .select('sokh_id, kind')
    .in('sokh_id', ids)
    .neq('kind', 'setup');
  const invoiced = new Set((invoices || []).map(i => Number(i.sokh_id)));

  // Үнэгүй сарыг СӨХ тус бүрд сунгаж болдог (`free_months_override`). Үүнийг
  // тооцохгүй бол «Хэрэглэгч СӨХ» карт сунгасан огноог, самбарын сануулга
  // ерөнхий дүрмийн огноог харуулж, хоёр дэлгэц зөрнө — сунгасан СӨХ «хугацаа
  // дууссан» гэж улаанаар гарч ирнэ. Багана байхгүй (миграц ажиллаагүй) бол
  // ерөнхий дүрмээр үргэлжилнэ.
  const overrideByOrg = new Map<number, number | null>();
  const { data: billRows } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, free_months_override')
    .in('id', ids);
  for (const r of billRows || []) {
    overrideByOrg.set(Number(r.id), (r.free_months_override as number) ?? null);
  }

  const now = new Date();
  const alerts: TrialAlert[] = [];

  for (const o of real) {
    const id = Number(o.id);
    const apartments = aptCount.get(id) || 0;
    const t = orgTariff(tariff, overrideByOrg.get(id));
    const ends = billingStartDate(o.activated_at as string, t, apartments);
    if (!ends) continue;

    const daysLeft = daysBetweenUb(ends, now);
    const level = trialAlertLevel(daysLeft, invoiced.has(id));
    if (!level) continue;

    alerts.push({
      sokh_id: id,
      name: o.name as string,
      apartments,
      free_months: freeMonths(t, apartments),
      ends_on: ubDay(ends),
      ends_at: ends.toISOString(),
      days_left: daysLeft,
      monthly_fee: monthlyFee(t, apartments),
      invoiced: invoiced.has(id),
      level,
    });
  }

  // Хамгийн яаралтай нь эхэнд: дууссан → өнөөдөр → удахгүй
  alerts.sort((a, b) => a.days_left - b.days_left);

  return NextResponse.json({
    alerts,
    counts: {
      overdue: alerts.filter(a => a.level === 'overdue').length,
      today: alerts.filter(a => a.level === 'today').length,
      soon: alerts.filter(a => a.level === 'soon').length,
      total: alerts.length,
    },
    lead_days: TRIAL_ALERT_LEAD_DAYS,
    today: ubDay(now),
  });
}

function emptyCounts() {
  return { overdue: 0, today: 0, soon: 0, total: 0 };
}
