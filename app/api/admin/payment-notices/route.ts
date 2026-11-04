import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';

// /api/admin/payment-notices — оршин суугчийн «Би шилжүүлсэн» мэдэгдэл
//   GET                                   → pending мэдэгдлүүд + айлын нэхэмжлэхийн төлөв, давхардлын тоо
//   POST { id, action:'confirm'|'reject' }
//
// Яагаад сервер дээр: өмнө нь админ хуудас клиентээс шууд payments-д мөр нэмдэг байсан.
// Нэхэмжлэхийг хаадаггүй, давхар дарахад давхар төлбөр бичдэг байсан тул
// (2026-11-04, ICTown: 80 гар төлбөрийн ихэнх нь банкны төлбөрийн давхардал болсон)
// баталгаажуулалтыг энд нэг дор, нэхэмжлэхтэй холбож хийнэ.

const OPEN = ['pending', 'overdue', 'partial'];
const DUP_NOTE = 'Давхар — айлын нэхэмжлэх аль хэдийн төлөгдсөн';

interface InvoiceRow {
  id: number;
  resident_id: number;
  amount: number;
  previous_balance: number | null;
  total_amount: number | null;
  paid_amount: number | null;
  status: string;
  year: number;
  month: number;
}

const invTotal = (i: InvoiceRow) => Number(i.total_amount ?? Number(i.amount) + Number(i.previous_balance || 0));
const invLeft = (i: InvoiceRow) => Math.max(0, invTotal(i) - Number(i.paid_amount || 0));

async function auth() {
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const sokhId = a.sokhId ? parseInt(a.sokhId, 10) : 0;
  if (!sokhId) return { error: NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 }) };
  return { sokhId, demo: !!a.demo };
}

async function invoicesOf(residentIds: number[]) {
  if (residentIds.length === 0) return [] as InvoiceRow[];
  const { data } = await supabaseAdmin
    .from('invoices')
    .select('id, resident_id, amount, previous_balance, total_amount, paid_amount, status, year, month')
    .in('resident_id', residentIds);
  return (data || []) as InvoiceRow[];
}

export async function GET() {
  const a = await auth();
  if ('error' in a) return a.error;

  const { data: notices, error } = await supabaseAdmin
    .from('payment_notices')
    .select('id, resident_id, amount, description, status, created_at')
    .eq('sokh_id', a.sokhId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Мэдэгдэл ачаалж чадсангүй' }, { status: 500 });

  const ids = [...new Set((notices || []).map((n) => n.resident_id as number))];
  const [inv, { data: res }] = await Promise.all([
    invoicesOf(ids),
    ids.length
      ? supabaseAdmin.from('residents').select('id, name, building, apartment').in('id', ids)
      : Promise.resolve({ data: [] as { id: number; name: string; building: string | null; apartment: string }[] }),
  ]);
  const resBy = new Map((res || []).map((r) => [r.id, r]));
  const dupCount = new Map<number, number>();
  for (const n of notices || []) dupCount.set(n.resident_id, (dupCount.get(n.resident_id) || 0) + 1);

  return NextResponse.json({
    notices: (notices || []).map((n) => {
      const mine = inv.filter((i) => i.resident_id === n.resident_id);
      const open = mine.filter((i) => OPEN.includes(i.status));
      const r = resBy.get(n.resident_id);
      return {
        ...n,
        resident_name: r?.name || null,
        unit: r ? [r.building, r.apartment].filter(Boolean).join('-') : null,
        has_invoices: mine.length > 0,
        open_due: open.reduce((s, i) => s + invLeft(i), 0),
        same_resident_pending: dupCount.get(n.resident_id) || 1,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ('error' in a) return a.error;
  if (a.demo) return NextResponse.json({ error: DEMO_READONLY_MESSAGE }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  const action = body?.action;
  if (!id || (action !== 'confirm' && action !== 'reject')) {
    return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });
  }

  const { data: notice } = await supabaseAdmin
    .from('payment_notices')
    .select('id, sokh_id, resident_id, amount, description, status')
    .eq('id', id)
    .eq('sokh_id', a.sokhId)
    .maybeSingle();
  if (!notice) return NextResponse.json({ error: 'Мэдэгдэл олдсонгүй' }, { status: 404 });
  if (notice.status !== 'pending') {
    return NextResponse.json({ error: 'Энэ мэдэгдэл аль хэдийн шийдэгдсэн' }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  // pending → шинэ төлөв. Зөвхөн нэг хүсэлт амжина (давхар даралт, хоёр таб).
  const claim = async (status: 'confirmed' | 'rejected', note: string | null) => {
    const { data } = await supabaseAdmin
      .from('payment_notices')
      .update({ status, resolved_at: nowIso, admin_note: note })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');
    return (data || []).length === 1;
  };

  if (action === 'reject') {
    if (!(await claim('rejected', null))) {
      return NextResponse.json({ error: 'Энэ мэдэгдэл аль хэдийн шийдэгдсэн' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  const residentId = notice.resident_id as number;
  const amount = Number(notice.amount);
  const inv = await invoicesOf([residentId]);
  const open = inv
    .filter((i) => OPEN.includes(i.status))
    .sort((x, y) => x.year - y.year || x.month - y.month || x.id - y.id);

  // Нэхэмжлэхтэй айл боловч нээлттэй нэхэмжлэх алга → төлбөр аль хэдийн (ихэвчлэн банкны
  // хуулгаар) бүртгэгдсэн. Дахин төлбөр бичвэл давхар орлого болно — мэдэгдлийг хаана.
  if (inv.length > 0 && open.length === 0) {
    await claim('rejected', DUP_NOTE);
    const closed = await closeOtherPending(a.sokhId, residentId, nowIso);
    return NextResponse.json({
      ok: true,
      status: 'duplicate',
      closed_others: closed,
      message: 'Энэ айлын нэхэмжлэх аль хэдийн төлөгдсөн байна (банкны хуулгаар бүртгэгдсэн байх). Давхар төлбөр бичсэнгүй, мэдэгдлийг хаалаа.',
    });
  }

  if (!(await claim('confirmed', null))) {
    return NextResponse.json({ error: 'Энэ мэдэгдэл аль хэдийн шийдэгдсэн' }, { status: 409 });
  }

  const target = open[0] || null;
  const { data: pay, error: payErr } = await supabaseAdmin
    .from('payments')
    .insert({
      resident_id: residentId,
      sokh_id: a.sokhId,
      invoice_id: target?.id ?? null,
      amount,
      description: notice.description || 'Банкаар шилжүүлсэн',
      provider: 'manual',
      provider_txn_id: `notice:${id}`,
      status: 'paid',
      paid_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single();
  if (payErr || !pay) {
    // Төлбөр бичигдээгүй — мэдэгдлийг буцааж нээнэ, дарга дахин оролдоно.
    await supabaseAdmin.from('payment_notices').update({ status: 'pending', resolved_at: null }).eq('id', id);
    console.error('[payment-notices] payment insert', payErr?.message);
    return NextResponse.json({ error: 'Төлбөр бүртгэж чадсангүй. Дахин оролдоно уу.' }, { status: 500 });
  }

  let full = false;
  if (target) {
    const newPaid = Number(target.paid_amount || 0) + amount;
    full = newPaid >= invTotal(target);
    await supabaseAdmin
      .from('invoices')
      .update({ paid_amount: newPaid, status: full ? 'paid' : 'partial', paid_at: full ? nowIso : null, updated_at: nowIso })
      .eq('id', target.id);
  }

  const { data: r } = await supabaseAdmin.from('residents').select('debt').eq('id', residentId).single();
  if (r) {
    await supabaseAdmin.from('residents').update({ debt: Math.max(0, Number(r.debt || 0) - amount) }).eq('id', residentId);
  }

  // Нэхэмжлэх бүгд хаагдсан бол тухайн айлын бусад pending мэдэгдэл давхар гэсэн үг.
  let closed = 0;
  if (full && open.length === 1) {
    closed = await closeOtherPending(a.sokhId, residentId, nowIso);
  }

  return NextResponse.json({ ok: true, status: 'confirmed', payment_id: pay.id, invoice_id: target?.id ?? null, closed_others: closed });
}

async function closeOtherPending(sokhId: number, residentId: number, nowIso: string) {
  const { data } = await supabaseAdmin
    .from('payment_notices')
    .update({ status: 'rejected', resolved_at: nowIso, admin_note: DUP_NOTE })
    .eq('sokh_id', sokhId)
    .eq('resident_id', residentId)
    .eq('status', 'pending')
    .select('id');
  return (data || []).length;
}
