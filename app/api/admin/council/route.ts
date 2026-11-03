import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { councilLimiter } from '@/app/lib/rate-limit';
import { DEMO_READONLY_MESSAGE } from '@/app/lib/demo-admin';
import { normalizePhone } from '@/app/lib/vote-ticket';
import { clientIp } from '@/app/lib/council';

// /api/admin/council
//   POST { action:'set', resident_id, council:'board'|'audit'|null, position? }
//        → оршин суугчийг ТУЗ / Хяналт гэж тэмдэглэх (эсвэл хасах)
//   GET  ?view=chat&after=<id>         → зөвлөлийн чат
//   POST { action:'chat', body }        → даргын мессеж

async function auth(req: NextRequest) {
  const rl = councilLimiter.check(clientIp(req));
  if (!rl.allowed) {
    return { error: NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 }) };
  }
  const a = await checkAnyAuth('admin', 'superadmin');
  if (!a.valid) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const sokhId = a.sokhId ? parseInt(a.sokhId, 10) : 0;
  if (!sokhId) return { error: NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 }) };
  return { sokhId, demo: !!a.demo };
}

export async function GET(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  if (req.nextUrl.searchParams.get('view') !== 'chat') {
    return NextResponse.json({ error: 'view буруу' }, { status: 400 });
  }
  const after = parseInt(req.nextUrl.searchParams.get('after') || '', 10) || 0;
  let q = supabaseAdmin
    .from('board_chat_messages')
    .select('id, resident_id, author_name, author_role, body, created_at')
    .eq('sokh_id', a.sokhId);
  q = after ? q.gt('id', after).order('id', { ascending: true }).limit(100) : q.order('id', { ascending: false }).limit(100);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Чат ачаалж чадсангүй (миграц ажиллуулсан эсэхийг шалгана уу)' }, { status: 500 });
  const rows = data || [];
  return NextResponse.json({ messages: after ? rows : rows.reverse() });
}

export async function POST(req: NextRequest) {
  const a = await auth(req);
  if ('error' in a) return a.error;
  if (a.demo) return NextResponse.json({ error: DEMO_READONLY_MESSAGE }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON буруу' }, { status: 400 }); }

  try {
    if (body.action === 'chat') {
      const text = String(body.body || '').trim().slice(0, 2000);
      if (!text) return NextResponse.json({ error: 'Хоосон мессеж' }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from('board_chat_messages')
        .insert({ sokh_id: a.sokhId, resident_id: null, author_name: 'СӨХ-ийн дарга', author_role: 'admin', body: text })
        .select('id, resident_id, author_name, author_role, body, created_at')
        .single();
      if (error) return NextResponse.json({ error: 'Илгээж чадсангүй' }, { status: 500 });
      return NextResponse.json({ message: data });
    }

    if (body.action === 'set') {
      const residentId = parseInt(String(body.resident_id), 10);
      const council = body.council === 'board' || body.council === 'audit' ? body.council : null;
      if (!residentId) return NextResponse.json({ error: 'resident_id шаардлагатай' }, { status: 400 });

      const { data: r } = await supabaseAdmin
        .from('residents').select('id, sokh_id, name, phone').eq('id', residentId).maybeSingle();
      if (!r || Number(r.sokh_id) !== a.sokhId) {
        return NextResponse.json({ error: 'Оршин суугч олдсонгүй' }, { status: 404 });
      }

      // Хасах
      if (!council) {
        await supabaseAdmin.from('board_members').delete().eq('sokh_id', a.sokhId).eq('resident_id', residentId);
        return NextResponse.json({ ok: true, council: null });
      }

      const phone = normalizePhone(String(r.phone || ''));
      if (phone.length !== 8) {
        return NextResponse.json({ error: 'Энэ оршин суугчид 8 оронтой утас бүртгэгдээгүй байна — эхлээд утсыг нь оруулна уу' }, { status: 400 });
      }
      const name = String(r.name || '').trim() || phone;
      const position = body.position ? String(body.position).trim().slice(0, 60) : null;

      // Өмнөх тэмдэглэгээг арилгаад, ижил утастай гараар нэмсэн (resident_id-гүй) мөрийг шингээнэ
      await supabaseAdmin.from('board_members').delete().eq('sokh_id', a.sokhId).eq('resident_id', residentId);
      await supabaseAdmin.from('board_members').delete()
        .eq('sokh_id', a.sokhId).eq('phone_number', phone).is('resident_id', null);

      const { error } = await supabaseAdmin.from('board_members').insert({
        sokh_id: a.sokhId,
        council,
        full_name: name,
        phone_number: phone, // тэмдэглэх үеийн утас — эрх шалгахад тулгана
        position,
        resident_id: residentId,
      });
      if (error) {
        console.error('[admin/council] set', error.message);
        return NextResponse.json({
          error: error.code === '23505'
            ? 'Энэ утас өөр гишүүнд бүртгэлтэй байна'
            : 'Хадгалж чадсангүй (миграц ажиллуулсан эсэхийг шалгана уу)',
        }, { status: 500 });
      }
      return NextResponse.json({ ok: true, council });
    }

    return NextResponse.json({ error: 'action буруу' }, { status: 400 });
  } catch (err) {
    console.error('[admin/council] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
