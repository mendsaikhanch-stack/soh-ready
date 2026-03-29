import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Нэг удаагийн migration: inspectors хүснэгтийн plaintext нууц үгийг bcrypt hash болгох
export async function POST(request: Request) {
  const { secret } = await request.json();

  if (!process.env.MIGRATION_SECRET || secret !== process.env.MIGRATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: inspectors, error } = await sb.from('inspectors').select('id, username, password');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let hashed = 0;
  let skipped = 0;

  for (const inspector of inspectors || []) {
    // bcrypt hash "$2" -ээр эхэлдэг — аль хэдийн hash-лагдсан бол алгасах
    if (inspector.password.startsWith('$2')) {
      skipped++;
      continue;
    }

    const hash = await bcrypt.hash(inspector.password, 12);
    const { error: updateError } = await sb
      .from('inspectors')
      .update({ password: hash })
      .eq('id', inspector.id);

    if (updateError) {
      return NextResponse.json({ error: `Failed to update ${inspector.username}: ${updateError.message}` }, { status: 500 });
    }
    hashed++;
  }

  return NextResponse.json({ success: true, hashed, skipped, total: (inspectors || []).length });
}
