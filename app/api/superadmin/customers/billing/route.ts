import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';

// Супер админы ГАР удирдлага — тухайн СӨХ-ийн төлбөрийн нөхцөл, тооцоо.
//
//   set_activated_at — «нээсэн» огноог засах. Үнэгүй хугацаа, төлбөр эхлэх
//                      өдөр, тооцоот сарууд бүгд үүнээс тоологддог.
//   set_free_months  — үнэгүй сарыг тухайн СӨХ-д сунгах (null = ерөнхий дүрэм)
//   set_note         — төлбөрийн чөлөөт тэмдэглэл
//   settle           — «тооцоо хийлээ» гэж тэмдэглэх (огноо, тэмдэглэл, хэн)
//   unsettle         — тэмдэглэгээг арилгах
//
// Багана нь supabase-billing-control-migration.sql-ээр үүснэ. Миграц
// ажиллаагүй бол update алдаа буцаана — дэлгэц дээр шалтгааныг нь харуулна.

const MIGRATION_HINT =
  'Багана олдсонгүй. supabase-billing-control-migration.sql-ийг Supabase → SQL Editor дээр ажиллуулна уу.';

export async function POST(request: Request) {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Хүсэлт буруу' }, { status: 400 });
  }

  const sokhId = Number(body.sokh_id);
  const action = String(body.action || '');
  if (!sokhId) return NextResponse.json({ error: 'sokh_id шаардлагатай' }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (action === 'set_activated_at') {
    // Хоосон утга = идэвхжсэн огноог арилгах (төлбөрийн тооцоо зогсоно)
    const raw = body.activated_at == null || body.activated_at === '' ? null : String(body.activated_at);
    if (raw !== null) {
      const d = new Date(raw);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Огноо буруу байна' }, { status: 400 });
      }
      // Ирээдүйн огноо тавибал төлбөр хэзээ ч эхлэхгүй — санамсаргүй бичилтээс сэргийлнэ
      if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return NextResponse.json({ error: 'Ирээдүйн огноо тавьж болохгүй' }, { status: 400 });
      }
      patch.activated_at = d.toISOString();
    } else {
      patch.activated_at = null;
    }
  } else if (action === 'set_free_months') {
    const raw = body.free_months;
    if (raw == null || raw === '') {
      patch.free_months_override = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 24) {
        return NextResponse.json({ error: 'Үнэгүй сар 0-24 хооронд байна' }, { status: 400 });
      }
      patch.free_months_override = Math.round(n);
    }
  } else if (action === 'set_note') {
    const note = String(body.note ?? '').trim();
    patch.billing_note = note || null;
  } else if (action === 'settle') {
    patch.settled_at = new Date().toISOString();
    patch.settled_note = String(body.note ?? '').trim() || null;
    patch.settled_by = auth.userId ? `admin#${auth.userId}` : 'superadmin';
  } else if (action === 'unsettle') {
    patch.settled_at = null;
    patch.settled_note = null;
    patch.settled_by = null;
  } else {
    return NextResponse.json({ error: 'action танигдсангүй' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('sokh_organizations')
    .update(patch)
    .eq('id', sokhId);

  if (error) {
    console.error('[superadmin/customers/billing]', action, error.message);
    const missingColumn = /column .* does not exist|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: missingColumn ? MIGRATION_HINT : 'Хадгалж чадсангүй' },
      { status: 500 },
    );
  }

  console.log(`[billing] ${action} sokh=${sokhId} by=${auth.userId}`);
  return NextResponse.json({ success: true });
}
