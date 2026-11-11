// /api/sokh-report?sokhId=&year=&month= — оршин суугчийн аппын «Зарцуулалтын тайлан».
//
// Яагаад сервер тал вэ: өмнө нь апп өөрөө (anon client) тооцоолдог байсан —
//   - айлын тоог residents-ийн БҮХ мөрөөр (баталгаажаагүй, давхар бүртгүүлснийг
//     ч оруулж) тоолдог байсан → Гринландад 129 тоот байхад «137 айл» гарч байв;
//   - орлогыг «айлын тоо × хураамж» гэж ТААМАГЛАДАГ байсан → бодит цуглуулалтаас
//     хамаагүй их, «үлдэгдэл» нь хуурамчаар их харагдаж байв.
// Оршин суугч бусдын төлбөрийг RLS-ээр харж чадахгүй тул нийлбэрийг энд бодно.
// Зөвхөн НИЙЛБЭР буцаана — айл тус бүрийн мэдээлэл (хувийн) гарахгүй.

import { NextRequest, NextResponse } from 'next/server';
import { periodKey } from '@/app/lib/finance/period';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { rateLimit } from '@/app/lib/rate-limit';
import { clientIp } from '@/app/lib/council';
import { isIncomeItem } from '@/app/lib/budget-items';

const limiter = rateLimit({ name: 'sokh-report', windowMs: 60 * 1000, maxRequests: 30 });
const PAGE = 1000;

async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}


export async function GET(req: NextRequest) {
  const rl = limiter.check(clientIp(req));
  if (!rl.allowed) return NextResponse.json({ error: 'Хэт олон хүсэлт' }, { status: 429 });
  const sp = req.nextUrl.searchParams;
  const sokhId = parseInt(sp.get('sokhId') || '', 10);
  const year = parseInt(sp.get('year') || '', 10);
  const month = parseInt(sp.get('month') || '', 10);
  if (!sokhId || !year || !(month >= 1 && month <= 12)) {
    return NextResponse.json({ error: 'sokhId, year, month шаардлагатай' }, { status: 400 });
  }
  const target = year * 100 + month;

  try {
    const { data: org } = await supabaseAdmin.from('sokh_organizations')
      .select('*').eq('id', sokhId).maybeSingle();
    if (!org) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 404 });

    const residents = await allPages<{ id: number; unit_kind: string | null; pending_claim: boolean | null }>((f, t) =>
      supabaseAdmin.from('residents').select('id, unit_kind, pending_claim').eq('sokh_id', sokhId).order('id').range(f, t));
    // Баталгаажаагүй (өөрөө бүртгүүлсэн) мөр айлын тоонд орохгүй
    const households = residents.filter((r) => !r.pending_claim && r.unit_kind !== 'business').length;

    // Төлбөрийг resident_id-аар авна: гараар бүртгэсэн төлбөрт sokh_id хоосон байдаг
    const payments: { amount: number; paid_at: string }[] = [];
    const rIds = residents.map((r) => r.id);
    for (let i = 0; i < rIds.length; i += 150) {
      const chunk = rIds.slice(i, i + 150);
      payments.push(...await allPages<{ amount: number; paid_at: string }>((f, t) =>
        supabaseAdmin.from('payments').select('amount, paid_at').in('resident_id', chunk).order('id').range(f, t)));
    }

    const [items, invoices] = await Promise.all([
      allPages<{ type: string | null; category: string | null; amount: number; year: number; month: number }>((f, t) =>
        supabaseAdmin.from('budget_items').select('type, category, amount, year, month').eq('sokh_id', sokhId).order('id').range(f, t)),
      allPages<{ amount: number; paid_amount: number | null; status: string }>((f, t) =>
        supabaseAdmin.from('invoices').select('amount, paid_amount, status').eq('sokh_id', sokhId).eq('year', year).eq('month', month).order('id').range(f, t)),
    ]);

    const collected = payments.filter((p) => periodKey(sokhId, p.paid_at) === target).reduce((s, p) => s + Number(p.amount), 0);
    const monthItems = items.filter((i) => i.year * 100 + i.month === target);
    const otherIncome = monthItems.filter(isIncomeItem).reduce((s, i) => s + Number(i.amount), 0);
    const expense = monthItems.filter((i) => !isIncomeItem(i)).reduce((s, i) => s + Number(i.amount), 0);

    // Дансны үлдэгдэл (сарын эцэст) — зөвхөн дарга эхний үлдэгдлээ огноотой нь
    // оруулсан үед. Эс бөгөөс «0-ээс эхэлсэн» дүн бодит данстай таарахгүй тул харуулахгүй.
    let cashEnd: number | null = null;
    const openDate: string | null = org.opening_balance_date ?? null;
    if (openDate) {
      const [oy, om] = openDate.split('-').map(Number);
      const from = oy * 100 + om;
      if (target >= from) {
        const inc = payments.filter((p) => { const k = periodKey(sokhId, p.paid_at); return k >= from && k <= target; })
          .reduce((s, p) => s + Number(p.amount), 0);
        const rng = items.filter((i) => { const k = i.year * 100 + i.month; return k >= from && k <= target; });
        cashEnd = Number(org.opening_balance || 0) + inc
          + rng.filter(isIncomeItem).reduce((s, i) => s + Number(i.amount), 0)
          - rng.filter((i) => !isIncomeItem(i)).reduce((s, i) => s + Number(i.amount), 0);
      }
    }

    return NextResponse.json({
      households,
      billed: invoices.reduce((s, i) => s + Number(i.amount || 0), 0),
      invoiceCount: invoices.length,
      paidCount: invoices.filter((i) => i.status === 'paid').length,
      collected,
      otherIncome,
      expense,
      cashEnd,
      openingDate: openDate,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
