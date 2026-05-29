import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { isCurrentAppValue } from '@/app/lib/directory/current-app';

interface CurrentAppBody {
  directoryId: number;
  currentApp: string; // CurrentAppValue
}

// Master directory record-ийн "одоо ашиглаж байгаа апп" талбарыг шинэчилнэ.
export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: CurrentAppBody = await req.json();
    if (!body.directoryId) return NextResponse.json({ error: 'directoryId шаардлагатай' }, { status: 400 });
    if (!isCurrentAppValue(body.currentApp)) {
      return NextResponse.json({ error: 'Буруу апп утга' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('hoa_directory')
      .update({ current_app: body.currentApp })
      .eq('id', body.directoryId);

    if (error) {
      console.error('[directory/current-app] error:', error.message);
      return NextResponse.json({ error: 'Хадгалж чадсангүй' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
