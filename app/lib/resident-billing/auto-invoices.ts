// СӨХ → оршин суугчийн САРЫН нэхэмжлэх ба ӨР — автомат тооцоо.
//
// Дүрэм (2026-10-07, хатуу):
//   - M сарын нэхэмжлэх M сарын 1-нд үүснэ. Төлөх хугацаа = M+1 сарын 5
//     (9-р сарынхыг 10-р сарын 5 гэхэд төлнө).
//   - Дөнгөж үүссэн нэхэмжлэх төлөх хугацаа хүртэл ӨР БИШ — «энэ сарын төлбөр».
//   - Төлөх хугацаа өнгөрсөн, төлөгдөөгүй нэхэмжлэх л ӨР болно.
//
// Тооцоо (өдөр бүр шинээр, cron): айл бүрийн нэхэмжлэхүүд (хамгийн эхнийх нь
// асаах үеийн «Эхний үлдэгдэл») + тэр мөчөөс хойш орсон төлбөрүүд →
// төлбөрийг хамгийн хуучин нэхэмжлэхээс эхэлж хаана (FIFO) →
//   residents.debt = хугацаа нь өнгөрсөн нэхэмжлэхүүдийн төлөгдөөгүй үлдэгдэл.
// Төлбөр бүртгэдэг замууд (гар, «Би шилжүүлсэн», банкны хуулга) өрийг шууд
// хасдаг хэвээр — тэр нь шөнийн тооцоотой зөрөхгүй, зөвхөн урьдчилж хийгдэнэ.
// ⚠️ Энэ горимд өрийг гараар засвал шөнө дарагдана — төлбөр/нэхэмжлэхээр засна.
//
// Зөвхөн `sokh_organizations.auto_invoice_from` бөглөгдсөн СӨХ-д ажиллана:
// ихэнх СӨХ-д 50,000₮ жишиг хураамж байгаа тул бүгдэд асаавал буруу дүн очно.
// Асаахдаа айл бүрт «Эхний үлдэгдэл» нэхэмжлэх үүсгэнэ (openingInvoiceRow,
// created_at = өрийн тайлангийн цаг) — түүнээс өмнө ТӨЛСӨН төлбөр тооцоонд
// ОРОХГҮЙ (тайланд аль хэдийн шингэсэн).

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { residentDueDate } from '@/app/lib/resident-billing/due-date';

const MONTH_NAMES = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

/** Улаанбаатарын (UTC+8) огноо — Vercel UTC дээр ажилладаг */
function ubToday(now: Date) {
  const ub = new Date(now.getTime() + 8 * 3600 * 1000);
  const year = ub.getUTCFullYear();
  const month = ub.getUTCMonth() + 1;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(ub.getUTCDate()).padStart(2, '0')}`;
  return { year, month, iso };
}

const ym = (y: number, m: number) => y * 100 + m;
const prevMonth = (y: number, m: number) => (m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 });

/** Асаах үеийн «Эхний үлдэгдэл» — автомат эхлэх сарын өмнөх сарын мөр болж
 *  орно, хугацаа нь тэр сарын нэхэмжлэхийнхтэй ижил (= эхлэх сарын 5). */
export function openingInvoiceRow(sokhId: number, residentId: number, debt: number, fromYear: number, fromMonth: number, asOf: string) {
  const p = prevMonth(fromYear, fromMonth);
  return {
    sokh_id: sokhId,
    resident_id: residentId,
    year: p.year,
    month: p.month,
    amount: debt,
    due_date: residentDueDate(p.year, p.month),
    status: 'pending',
    description: `Эхний үлдэгдэл (${asOf}-ны байдлаар)`,
  };
}

interface OrgRow { id: number; name: string; monthly_fee: number | null; auto_invoice_from: string }
interface ResRow { id: number; debt: number | null; monthly_fee: number | null }
interface InvRow { id: number; resident_id: number; year: number; month: number; amount: number; status: string; paid_amount: number | null; paid_at: string | null; due_date: string | null; created_at: string }
interface PayRow { resident_id: number; amount: number; paid_at: string }

export interface ResidentInvoiceRunResult {
  ok: boolean;
  orgs: { sokh_id: number; name: string; created: number; createdAmount: number; statusChanged: number; debtChanged: number }[];
  errors: string[];
}

export async function runResidentInvoices(now: Date = new Date()): Promise<ResidentInvoiceRunResult> {
  const result: ResidentInvoiceRunResult = { ok: true, orgs: [], errors: [] };
  const today = ubToday(now);

  const { data: orgData, error: orgErr } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, monthly_fee, auto_invoice_from')
    .not('auto_invoice_from', 'is', null);
  if (orgErr) {
    // Миграц ажиллаагүй (багана байхгүй) — юу ч хийхгүй, унахгүй
    result.ok = false;
    result.errors.push(`СӨХ уншиж чадсангүй (supabase-resident-auto-invoice-migration.sql ажилласан уу?): ${orgErr.message}`);
    return result;
  }

  for (const o of (orgData || []) as OrgRow[]) {
    const sokhId = Number(o.id);
    const [fy, fm] = o.auto_invoice_from.split('-').map(Number);
    const opening = prevMonth(fy, fm);
    const summary = { sokh_id: sokhId, name: o.name, created: 0, createdAmount: 0, statusChanged: 0, debtChanged: 0 };
    result.orgs.push(summary);

    const { data: resData, error: resErr } = await supabaseAdmin
      .from('residents')
      .select('id, debt, monthly_fee')
      .eq('sokh_id', sokhId)
      .eq('pending_claim', false);
    if (resErr) { result.errors.push(`${o.name}: айл уншиж чадсангүй — ${resErr.message}`); continue; }
    const residents = (resData || []) as ResRow[];

    // 1) Энэ сарын нэхэмжлэх (өрөнд НЭМЭХГҮЙ — хугацаа нь болоогүй)
    if (ym(today.year, today.month) >= ym(fy, fm)) {
      const rows = residents
        .map(r => ({ r, fee: Number(r.monthly_fee ?? o.monthly_fee) || 0 }))
        .filter(x => x.fee > 0)
        .map(({ r, fee }) => ({
          sokh_id: sokhId,
          resident_id: r.id,
          year: today.year,
          month: today.month,
          amount: fee,
          due_date: residentDueDate(today.year, today.month),
          status: 'pending',
          description: `${MONTH_NAMES[today.month - 1]} ${today.year} - сарын хураамж`,
        }));
      if (rows.length) {
        // ignoreDuplicates: аль хэдийн байгаа мөрийг (гараар үүсгэсэн ч) хөндөхгүй
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from('invoices')
          .upsert(rows, { onConflict: 'resident_id,year,month', ignoreDuplicates: true })
          .select('amount');
        if (insErr) result.errors.push(`${o.name}: нэхэмжлэх үүсгэж чадсангүй — ${insErr.message}`);
        for (const inv of inserted || []) { summary.created++; summary.createdAmount += Number(inv.amount); }
      }
    }

    // 2) Тооцоо — «Эхний үлдэгдэл»-ээс хойших нэхэмжлэх + төлбөр
    const { data: invData, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('id, resident_id, year, month, amount, status, paid_amount, paid_at, due_date, created_at')
      .eq('sokh_id', sokhId)
      .gte('year', opening.year);
    if (invErr) { result.errors.push(`${o.name}: нэхэмжлэх уншиж чадсангүй — ${invErr.message}`); continue; }

    const invByRes = new Map<number, InvRow[]>();
    for (const inv of (invData || []) as InvRow[]) {
      if (ym(inv.year, inv.month) < ym(opening.year, opening.month)) continue;
      const list = invByRes.get(inv.resident_id) || [];
      list.push(inv);
      invByRes.set(inv.resident_id, list);
    }
    if (!invByRes.size) continue;

    // Айл бүрийн тооцоо эхэлсэн мөч = түүний хамгийн эхний нэхэмжлэхийн created_at
    // («Эхний үлдэгдэл»-ийг тайлангийн огноогоор created_at-тай үүсгэнэ). Төлбөрийг
    // ТӨЛСӨН огноогоор (paid_at) нь тооцно — хуучин хуулгыг хожим оруулахад
    // тайланд аль хэдийн шингэсэн төлбөр давхар хасагдахгүй.
    const startOf = new Map<number, string>();
    for (const [rid, list] of invByRes) {
      startOf.set(rid, list.reduce((min, i) => (i.created_at < min ? i.created_at : min), list[0].created_at));
    }
    const earliest = [...startOf.values()].reduce((a, b) => (a < b ? a : b));
    const paidByRes = new Map<number, number>();
    const resIds = [...invByRes.keys()];
    for (let i = 0; i < resIds.length; i += 100) {
      const { data: payData, error: payErr } = await supabaseAdmin
        .from('payments')
        .select('resident_id, amount, paid_at')
        .in('resident_id', resIds.slice(i, i + 100))
        .gte('paid_at', earliest);
      if (payErr) { result.errors.push(`${o.name}: төлбөр уншиж чадсангүй — ${payErr.message}`); continue; }
      for (const p of (payData || []) as PayRow[]) {
        if (new Date(p.paid_at) < new Date(startOf.get(p.resident_id) || 0)) continue;
        paidByRes.set(p.resident_id, (paidByRes.get(p.resident_id) || 0) + Number(p.amount || 0));
      }
    }

    for (const r of residents) {
      const list = invByRes.get(r.id);
      if (!list) continue;
      list.sort((a, b) => ym(a.year, a.month) - ym(b.year, b.month)); // хуучнаас шинэ рүү
      let pool = paidByRes.get(r.id) || 0;
      let overdue = 0;
      for (const inv of list) {
        const amount = Number(inv.amount) || 0;
        const paid = Math.min(pool, amount);
        pool -= paid;
        const unpaid = amount - paid;
        const pastDue = !!inv.due_date && inv.due_date < today.iso;
        if (pastDue) overdue += unpaid;
        const status = unpaid === 0 ? 'paid' : pastDue ? 'overdue' : paid > 0 ? 'partial' : 'pending';
        if (status === inv.status && paid === Number(inv.paid_amount || 0)) continue;
        const patch: Record<string, unknown> = { status, paid_amount: paid };
        if (status === 'paid' && !inv.paid_at) patch.paid_at = now.toISOString();
        if (status !== 'paid') patch.paid_at = null;
        const { error } = await supabaseAdmin.from('invoices').update(patch).eq('id', inv.id);
        if (error) { result.errors.push(`${o.name}: нэхэмжлэх #${inv.id} төлөв — ${error.message}`); continue; }
        summary.statusChanged++;
      }
      if (overdue !== (Number(r.debt) || 0)) {
        const { error } = await supabaseAdmin.from('residents').update({ debt: overdue }).eq('id', r.id);
        if (error) { result.errors.push(`${o.name}: айл #${r.id} өр — ${error.message}`); continue; }
        summary.debtChanged++;
      }
    }
  }

  if (result.errors.length) result.ok = false;
  return result;
}
