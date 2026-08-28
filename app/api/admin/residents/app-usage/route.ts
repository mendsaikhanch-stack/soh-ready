import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { loadSignIns } from '@/app/lib/auth-signins';

// Тухайн СӨХ-ийн айл бүр аппаа татаж нэвтэрсэн эсэх.
//
// Яагаад тусдаа API вэ: нэвтрэлтийн ул мөр нь auth.users.last_sign_in_at-д
// байдаг бөгөөд тэр хүснэгтийг PostgREST-ээр (тэр дундаа /api/admin/db proxy)
// уншиж болдоггүй. Иймд зөвхөн сервер талд service role-оор уншина.
//
// Дарга зөвхөн ӨӨРИЙН СӨХ-ийг харна. Супер админ ?sokhId=-ээр аль нэгийг харж болно.

interface ResidentRow {
  id: number;
  name: string | null;
  apartment: string | null;
  phone: string | null;
  building: string | null;
  auth_user_id: string | null;
  pending_claim: boolean | null;
  unit_kind: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) {
    return NextResponse.json({ error: 'Нэвтрээгүй байна' }, { status: 401 });
  }

  const asked = Number(new URL(request.url).searchParams.get('sokhId')) || 0;
  const sokhId = auth.role === 'superadmin'
    ? asked || Number(auth.sokhId) || 0
    : Number(auth.sokhId) || 0;

  if (!sokhId) {
    return NextResponse.json({ error: 'СӨХ тодорхойгүй байна' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('residents')
    .select('id, name, apartment, phone, building, auth_user_id, pending_claim, unit_kind')
    .eq('sokh_id', sokhId);

  if (error) {
    console.error('[admin/residents/app-usage]', error.message);
    return NextResponse.json({ error: 'Оршин суугчдыг уншиж чадсангүй' }, { status: 500 });
  }

  const rows = (data || []) as ResidentRow[];
  const signIns = await loadSignIns('admin/residents/app-usage');
  const nowMs = Date.now();

  const residents = rows
    .map(r => {
      const last = r.auth_user_id ? signIns.get(String(r.auth_user_id)) || null : null;
      return {
        id: r.id,
        name: r.name,
        apartment: r.apartment,
        phone: r.phone,
        building: r.building,
        pending_claim: !!r.pending_claim,
        unit_kind: r.unit_kind,
        has_account: !!r.auth_user_id,
        last_sign_in_at: last,
      };
    })
    .sort((a, b) =>
      (a.apartment || '').localeCompare(b.apartment || '', undefined, { numeric: true }) || a.id - b.id
    );

  const age = (t: string | null) => (t ? nowMs - new Date(t).getTime() : Infinity);

  const summary = {
    total: residents.length,
    with_account: residents.filter(r => r.has_account).length,
    signed_in: residents.filter(r => r.last_sign_in_at).length,
    active_7d: residents.filter(r => age(r.last_sign_in_at) < 7 * DAY).length,
    active_30d: residents.filter(r => age(r.last_sign_in_at) < 30 * DAY).length,
    never_signed_in: residents.filter(r => !r.last_sign_in_at).length,
    no_account: residents.filter(r => !r.has_account).length,
    no_phone: residents.filter(r => !(r.phone || '').trim()).length,
  };

  return NextResponse.json({ sokh_id: sokhId, summary, residents });
}
