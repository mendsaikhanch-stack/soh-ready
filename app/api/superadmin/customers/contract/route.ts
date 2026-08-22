// Супер админ — СӨХ бүрийн гэрээ татах эрхийг нээх/хаах, гэрээг урьдчилан харах.
//
// Эрх нээх нь ганц үйлдэл: `contract_unlocked_at` тэмдэглэгдмэгц тухайн
// СӨХ-ийн дарга /admin/contract хуудсаараа гэрээгээ татаж чадна. Хаах нь
// дугаарыг устгахгүй — дахин нээхэд ижил дугаартай гэрээ гарна.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import {
  loadContractState,
  buildContractInput,
  contractFileResponse,
} from '@/app/lib/contract/load';
import {
  renderContractHtml,
  contractFileName,
  contractNumberFor,
} from '@/app/lib/contract/service-agreement';

const MIGRATION_HINT =
  'supabase-service-contract-migration.sql ажиллаагүй байна — Supabase SQL Editor-т ажиллуулна уу.';

export async function GET(req: NextRequest) {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const sokhId = Number(url.searchParams.get('sokh_id'));
  if (!sokhId) return NextResponse.json({ error: 'sokh_id шаардлагатай' }, { status: 400 });

  const state = await loadContractState(sokhId);
  if (!state) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 404 });

  const input = buildContractInput(state, {
    register: url.searchParams.get('register'),
    chairman: url.searchParams.get('chairman'),
  });
  const html = renderContractHtml(input);
  const format = url.searchParams.get('format');

  if (format === 'doc' || format === 'html') {
    return contractFileResponse(html, contractFileName(input, format), format === 'doc');
  }
  // Урьдчилан харах — шинэ табд шууд нээхэд зориулж HTML-ээр өгнө
  if (format === 'preview') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json({
    migrated: state.migrated,
    unlocked_at: state.unlocked_at,
    downloaded_at: state.downloaded_at,
    number: input.number,
    apartments: state.apartments,
    html,
  });
}

export async function POST(req: NextRequest) {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sokhId = Number(body.sokh_id);
  const action = String(body.action || '');
  if (!sokhId || !['unlock', 'lock'].includes(action)) {
    return NextResponse.json({ error: 'sokh_id, action шаардлагатай' }, { status: 400 });
  }

  const state = await loadContractState(sokhId);
  if (!state) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 404 });
  if (!state.migrated) return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 });

  if (action === 'lock') {
    const { error } = await supabaseAdmin
      .from('sokh_organizations')
      .update({ contract_unlocked_at: null })
      .eq('id', sokhId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ unlocked_at: null });
  }

  // Идэвхжээгүй СӨХ-д гэрээ нээх нь утгагүй — айлын тоо нь тэглэгдсэн
  // гэрээ гарна. Дүнгүй гэрээ гарын үсэг зурагдвал маргаан үүснэ.
  if (state.apartments === 0) {
    return NextResponse.json(
      { error: 'Айлын жагсаалт ороогүй байна — гэрээний дүн 0 гарна. Эхлээд оршин суугчдыг импортлоно уу.' },
      { status: 409 },
    );
  }

  const now = new Date();
  const patch: Record<string, string> = { contract_unlocked_at: now.toISOString() };
  if (!state.number) patch.contract_number = contractNumberFor(sokhId, now);

  const { error } = await supabaseAdmin
    .from('sokh_organizations')
    .update(patch)
    .eq('id', sokhId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    unlocked_at: patch.contract_unlocked_at,
    number: state.number || patch.contract_number,
  });
}
