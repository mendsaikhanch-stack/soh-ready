// Нэг төлбөрийг айлын нээлттэй нэхэмжлэхүүдэд ХУУЧНААС нь эхлэн хуваарилах.
//
// Яагаад: нэхэмжлэх сар бүр тусдаа (тайлан сар сараараа гарна), харин айлаас
// дутуу үлдсэн өрийг энэ сарынхтай нийлүүлж нэг дүнгээр нэхдэг. Айл 110,000₮
// (10 + 11-р сар) нэг дор шилжүүлэхэд өмнө нь бүхэлд нь нэг нэхэмжлэх рүү
// бичигдэж, 11-р сар нээлттэй үлддэг байв.
//
// payments.invoice_id ганц тул нэхэмжлэх бүрд тусдаа payments мөр үүснэ.
// Илүү гарсан дүн нэхэмжлэхгүй урьдчилгаа болно.

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export const OPEN_STATUSES = ['pending', 'overdue', 'partial'];

export interface AllocInvoice {
  id: number;
  year: number;
  month: number;
  amount: number;
  previous_balance: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string;
}

export const invoiceTotal = (i: Pick<AllocInvoice, 'amount' | 'previous_balance' | 'total_amount'>) =>
  Number(i.total_amount ?? Number(i.amount) + Number(i.previous_balance || 0));
export const invoiceLeft = (i: AllocInvoice) => Math.max(0, invoiceTotal(i) - Number(i.paid_amount || 0));

/** Айлын нээлттэй нэхэмжлэх, хамгийн хуучин нь эхэнд */
export async function openInvoicesOldestFirst(residentId: number): Promise<AllocInvoice[]> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('id, year, month, amount, previous_balance, total_amount, paid_amount, status')
    .eq('resident_id', residentId)
    .in('status', OPEN_STATUSES);
  if (error) throw new Error(error.message);
  return ((data || []) as AllocInvoice[])
    .filter((i) => invoiceLeft(i) > 0)
    .sort((a, b) => a.year - b.year || a.month - b.month || a.id - b.id);
}

/** Цэвэр тооцоо: аль нэхэмжлэхэд хэдийг, үлдэгдэл хэд */
export function planAllocation(open: AllocInvoice[], amount: number) {
  let left = amount;
  const parts: { invoice: AllocInvoice; amount: number }[] = [];
  for (const inv of open) {
    if (left <= 0) break;
    const part = Math.min(left, invoiceLeft(inv));
    if (part <= 0) continue;
    parts.push({ invoice: inv, amount: part });
    left -= part;
  }
  return { parts, advance: Math.max(0, left) };
}

/** Нэхэмжлэхийн paid_amount/status-ийг нэмэгдүүлнэ */
export async function addToInvoice(inv: AllocInvoice, part: number, nowIso: string) {
  const newPaid = Number(inv.paid_amount || 0) + part;
  const full = newPaid >= invoiceTotal(inv);
  const { error } = await supabaseAdmin.from('invoices').update({
    paid_amount: newPaid, status: full ? 'paid' : 'partial', paid_at: full ? nowIso : null, updated_at: nowIso,
  }).eq('id', inv.id);
  if (error) throw new Error(error.message);
  return full;
}

export const monthTag = (i: Pick<AllocInvoice, 'year' | 'month'>) => `${i.year}-${String(i.month).padStart(2, '0')}`;

/**
 * Төлбөрийг хуваарилж бичнэ (payments мөр + нэхэмжлэх шинэчлэл).
 * residents.debt-ийг ӨӨРЧЛӨХГҮЙ — дуудагч өөрөө шийднэ (зарим зам аль хэдийн хассан байдаг).
 */
export async function writeAllocatedPayment(input: {
  sokhId: number;
  residentId: number;
  amount: number;
  description: string;
  provider: string;
  /** Давхардлаас хамгаалах угтвар; мөр бүрд `${prefix}:${invoiceId|advance}` */
  txnPrefix: string;
  open?: AllocInvoice[];
  nowIso?: string;
}) {
  const nowIso = input.nowIso || new Date().toISOString();
  const open = input.open || (await openInvoicesOldestFirst(input.residentId));
  const { parts, advance } = planAllocation(open, input.amount);
  const applied: { invoice_id: number | null; month: string | null; amount: number; payment_id: number }[] = [];

  const insert = async (invoiceId: number | null, amt: number, label: string) => {
    const { data, error } = await supabaseAdmin.from('payments').insert({
      resident_id: input.residentId, sokh_id: input.sokhId, invoice_id: invoiceId, amount: amt,
      description: label.slice(0, 300), provider: input.provider,
      provider_txn_id: `${input.txnPrefix}:${invoiceId ?? 'advance'}`,
      status: 'paid', paid_at: nowIso, updated_at: nowIso,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'payment insert');
    return data.id as number;
  };

  const many = parts.length > 1 || advance > 0;
  for (const p of parts) {
    const pid = await insert(p.invoice.id, p.amount, many ? `${input.description} (${p.invoice.month}-р сар)` : input.description);
    await addToInvoice(p.invoice, p.amount, nowIso);
    applied.push({ invoice_id: p.invoice.id, month: monthTag(p.invoice), amount: p.amount, payment_id: pid });
  }
  if (advance > 0) {
    const pid = await insert(null, advance, parts.length ? `${input.description} (урьдчилгаа)` : input.description);
    applied.push({ invoice_id: null, month: null, amount: advance, payment_id: pid });
  }
  return { applied, advance, hadInvoices: open.length > 0 };
}
