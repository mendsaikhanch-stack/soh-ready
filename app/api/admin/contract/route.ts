// СӨХ-ийн даргын тал — үйлчилгээний гэрээгээ харах, татах.
//
// Гэрээ нь ЗӨВХӨН супер админ эрхийг нь нээсэн СӨХ-д харагдана
// (`sokh_organizations.contract_unlocked_at`). Эрх нээгээгүй бол 403 — гэрээг
// хэсэгчлэн ч харуулахгүй, эс тэгвэл тохиролцоогүй байхад нөхцөл нь тарчихна.
//
// sokh_id-г клиентээс АВАХГҮЙ, зөвхөн сешнээс уншина. Эс тэгвэл нэг СӨХ-ийн
// дарга нөгөөгийн айлын тоо, төлбөрийг харах боломжтой болно.

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
  contractSections,
} from '@/app/lib/contract/service-agreement';
import { loadSeal } from '@/app/lib/contract/seal';
import { setupFee, monthlyFee, freeMonths, billingStartDate } from '@/app/lib/platform-pricing';

export async function GET(req: NextRequest) {
  const auth = await checkAuth('admin');
  if (!auth.valid || !auth.sokhId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sokhId = Number(auth.sokhId);
  if (!sokhId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const state = await loadContractState(sokhId);
  if (!state) return NextResponse.json({ error: 'СӨХ олдсонгүй' }, { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const fill = {
    register: url.searchParams.get('register'),
    chairman: url.searchParams.get('chairman'),
    date: url.searchParams.get('date') ? new Date(url.searchParams.get('date')!) : undefined,
  };

  // Эрх нээгээгүй — гэрээний агуулгыг огт өгөхгүй
  if (!state.unlocked_at) {
    if (format) return NextResponse.json({ error: 'Гэрээ нээгдээгүй байна' }, { status: 403 });
    return NextResponse.json({
      unlocked: false,
      migrated: state.migrated,
      org: { name: state.org.name },
    });
  }

  const input = buildContractInput(state, fill);

  // Хотолын тамга, гарын үсэг урьдчилан суусан байна — СӨХ зөвхөн өөрийн
  // талаа бөглөж, тамгалаад буцаана. Word нь data: URI зураг харуулдаггүй
  // тул зөвхөн дэлгэц/PDF-д буулгана.
  const seal = format === 'doc' ? undefined : await loadSeal();
  const html = renderContractHtml(input, { seal });

  if (format === 'doc' || format === 'html') {
    // Татсан гэдгийг тэмдэглэнэ — супер админ талд «татсан эсэх» харагдана.
    if (state.migrated) {
      await supabaseAdmin
        .from('sokh_organizations')
        .update({ contract_downloaded_at: new Date().toISOString() })
        .eq('id', sokhId);
    }
    return contractFileResponse(html, contractFileName(input, format), format === 'doc');
  }

  return NextResponse.json({
    unlocked: true,
    migrated: state.migrated,
    number: input.number,
    unlocked_at: state.unlocked_at,
    downloaded_at: state.downloaded_at,
    org: {
      name: state.org.name,
      address: state.org.address,
      phone: state.org.phone,
      email: state.org.email,
    },
    apartments: state.apartments,
    setup_fee: setupFee(state.tariff, state.apartments),
    monthly_fee: monthlyFee(state.tariff, state.apartments),
    free_months: freeMonths(state.tariff, state.apartments),
    billing_starts_at: (
      billingStartDate(state.org.activated_at || (input.date ?? new Date()).toISOString(), state.tariff, state.apartments) || null
    )?.toISOString() ?? null,
    section_titles: contractSections(input).map(s => `${s.no}. ${s.title}`),
    html,
  });
}
