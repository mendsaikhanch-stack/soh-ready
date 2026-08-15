import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { DEFAULT_TARIFF, type PlatformTariff } from '@/app/lib/platform-pricing';

// Хотолын нэгдсэн тариф. Бүх СӨХ-д ижил тул ганц мөр (id=1).
// Зөвхөн superadmin — СӨХ-ийн дарга энэ дүнг харах ёсгүй.

async function requireSuperadmin() {
  const auth = await getAuthRole();
  if (!auth || auth.role !== 'superadmin') return null;
  return auth;
}

const FIELDS = [
  'setup_per_unit',
  'monthly_per_unit',
  'free_months_threshold',
  'free_months_below',
  'free_months_above',
] as const;

export async function GET() {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('platform_tariff')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  // Миграц ажиллаагүй үед хуудас цоохор алдаа заахын оронд үндсэн тарифаар
  // ажиллаад, миграц дутуугаа хэлнэ.
  if (error) {
    return NextResponse.json({ ...DEFAULT_TARIFF, migrated: false });
  }

  return NextResponse.json({ ...DEFAULT_TARIFF, ...(data || {}), migrated: true });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSuperadmin();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const patch: Record<string, number> = {};

  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    const n = Number(body[f]);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `${f} буруу утгатай` }, { status: 400 });
    }
    patch[f] = n;
  }

  if (patch.free_months_threshold !== undefined && patch.free_months_threshold < 1) {
    return NextResponse.json({ error: 'Айлын хязгаар 1-ээс бага байж болохгүй' }, { status: 400 });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Өөрчлөх утга алга' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('platform_tariff')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('[superadmin/tariff]', error.message);
    return NextResponse.json(
      { error: 'Тариф хадгалж чадсангүй. supabase-platform-tariff-migration.sql ажилласан эсэхийг шалгана уу.' },
      { status: 500 },
    );
  }

  return NextResponse.json(data as PlatformTariff);
}
