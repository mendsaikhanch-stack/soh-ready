import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';

interface LinkBody {
  directoryId: number;
  tenantId: number | null; // null = unlink
}

// Master directory record-ыг идэвхтэй sokh_organizations tenant-тай холбоно.
// Жишээ: Олон нийтэд "Khotol идэвхтэй" гэж тэмдэглэх боломжтой болно.
export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: LinkBody = await req.json();
    if (!body.directoryId) return NextResponse.json({ error: 'directoryId шаардлагатай' }, { status: 400 });

    // Tenant байгаа эсэхийг шалгах
    if (body.tenantId !== null && body.tenantId !== undefined) {
      const { data: tenant } = await supabaseAdmin
        .from('sokh_organizations')
        .select('id')
        .eq('id', body.tenantId)
        .single();
      if (!tenant) return NextResponse.json({ error: 'Tenant олдсонгүй' }, { status: 400 });

      // Бусад directory нэгэнт энэ tenant-тай холбогдсон бол хориглох
      const { data: conflict } = await supabaseAdmin
        .from('hoa_directory')
        .select('id')
        .eq('linked_tenant_id', body.tenantId)
        .neq('id', body.directoryId)
        .limit(1);
      if (conflict && conflict.length > 0) {
        return NextResponse.json({ error: 'Энэ tenant өөр directory-той аль хэдийн холбогдсон' }, { status: 409 });
      }
    }

    const { error } = await supabaseAdmin
      .from('hoa_directory')
      .update({ linked_tenant_id: body.tenantId ?? null })
      .eq('id', body.directoryId);

    if (error) {
      console.error('[directory/link] error:', error.message);
      return NextResponse.json({ error: 'Холбож чадсангүй' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
