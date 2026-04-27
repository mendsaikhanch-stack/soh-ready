import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAuth } from '@/app/lib/session-token';
import { bulkOnboardLimiter } from '@/app/lib/rate-limit';

const CODE_TTL_DAYS = 7;
const MAX_ROWS = 200;

interface InputRow {
  khoroo_id: number;
  sokh_name: string;
  address?: string;
  darga_phone: string;
  darga_name?: string;
  unit_count?: number;
}

interface ResultRow {
  row: number;
  status: 'created' | 'matched' | 'skipped' | 'error';
  sokh_id?: number;
  sokh_name?: string;
  code?: string;
  contact_phone?: string;
  expires_at?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  const rl = bulkOnboardLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Хэт олон хүсэлт. ${rl.retryAfterSec}с хүлээнэ үү` }, { status: 429 });
  }

  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const superId = auth.userId ? parseInt(auth.userId, 10) : null;

  const body = await req.json().catch(() => null) as { rows?: unknown } | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows массив шаардлагатай' }, { status: 400 });
  }
  const rowsRaw = body.rows;
  if (rowsRaw.length === 0) {
    return NextResponse.json({ error: 'Мөр алга' }, { status: 400 });
  }
  if (rowsRaw.length > MAX_ROWS) {
    return NextResponse.json({ error: `Нэг batch дотор хамгийн их ${MAX_ROWS} мөр` }, { status: 400 });
  }

  // Parse + validate each row
  const rows: (InputRow | { error: string })[] = rowsRaw.map((r: unknown) => {
    if (!r || typeof r !== 'object') return { error: 'Мөр буруу' };
    const o = r as Record<string, unknown>;
    const khoroo_id = Number(o.khoroo_id);
    const sokh_name = typeof o.sokh_name === 'string' ? o.sokh_name.trim() : '';
    const address = typeof o.address === 'string' ? o.address.trim() : undefined;
    const darga_phone = typeof o.darga_phone === 'string' ? o.darga_phone.trim() : '';
    const darga_name = typeof o.darga_name === 'string' ? o.darga_name.trim() : undefined;
    const unit_count = o.unit_count !== undefined && o.unit_count !== null && o.unit_count !== ''
      ? Number(o.unit_count) : undefined;

    if (!Number.isFinite(khoroo_id) || khoroo_id <= 0) return { error: 'Хороо тохироогүй' };
    if (sokh_name.length < 2 || sokh_name.length > 100) return { error: 'СӨХ нэр буруу' };
    if (!/^\d{8}$/.test(darga_phone)) return { error: 'Дарга утас 8 оронтой' };
    if (unit_count !== undefined && (!Number.isFinite(unit_count) || unit_count < 0 || unit_count > 100000)) {
      return { error: 'Айлын тоо буруу' };
    }
    return { khoroo_id, sokh_name, address, darga_phone, darga_name, unit_count };
  });

  // Зөвхөн зөвшөөрөгдсөн khoroo_id-ууд
  const validKhorooIds = [...new Set(rows.flatMap(r => 'error' in r ? [] : [r.khoroo_id]))];
  let knownKhoroos = new Set<number>();
  if (validKhorooIds.length > 0) {
    const { data: ks } = await supabaseAdmin
      .from('khoroos')
      .select('id')
      .in('id', validKhorooIds);
    knownKhoroos = new Set((ks || []).map(k => k.id as number));
  }

  // Тухайн хороонд хамаарах одоо байгаа СӨХ-уудыг авч давхардал шалгана
  const { data: existingOrgs } = await supabaseAdmin
    .from('sokh_organizations')
    .select('id, name, khoroo_id, claim_status')
    .in('khoroo_id', validKhorooIds.length > 0 ? validKhorooIds : [-1]);

  type ExistingOrg = { id: number; name: string; khoroo_id: number; claim_status: string };
  const existingMap = new Map<string, ExistingOrg>();
  (existingOrgs || []).forEach(o => {
    const key = `${o.khoroo_id}|${(o.name as string).toLowerCase().trim()}`;
    existingMap.set(key, o as ExistingOrg);
  });

  const results: ResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ('error' in r) {
      results.push({ row: i, status: 'error', reason: r.error });
      continue;
    }
    if (!knownKhoroos.has(r.khoroo_id)) {
      results.push({ row: i, status: 'error', reason: 'Хороо олдсонгүй' });
      continue;
    }

    try {
      // 1. СӨХ үүсгэх эсвэл олох
      const dupKey = `${r.khoroo_id}|${r.sokh_name.toLowerCase()}`;
      const existing = existingMap.get(dupKey);
      let sokhId: number;
      let sokhName: string;
      let isNew = false;

      if (existing) {
        if (existing.claim_status === 'active') {
          results.push({
            row: i,
            status: 'skipped',
            sokh_id: existing.id,
            sokh_name: existing.name,
            reason: 'Аль хэдийн идэвхтэй',
          });
          continue;
        }
        sokhId = existing.id;
        sokhName = existing.name;
        // unit_count шинэчлэх (хэрэв олгогдсон бол)
        if (r.unit_count !== undefined) {
          await supabaseAdmin
            .from('sokh_organizations')
            .update({ unit_count: r.unit_count, address: r.address || undefined })
            .eq('id', sokhId);
        }
      } else {
        const { data: created, error: insErr } = await supabaseAdmin
          .from('sokh_organizations')
          .insert([{
            khoroo_id: r.khoroo_id,
            name: r.sokh_name,
            address: r.address || null,
            phone: r.darga_phone,
            unit_count: r.unit_count ?? null,
            claim_status: 'pending',
          }])
          .select('id, name')
          .single();
        if (insErr || !created) {
          results.push({ row: i, status: 'error', reason: 'СӨХ үүсгэж чадсангүй' });
          continue;
        }
        sokhId = created.id;
        sokhName = created.name;
        isNew = true;
        existingMap.set(dupKey, { id: sokhId, name: sokhName, khoroo_id: r.khoroo_id, claim_status: 'pending' });
      }

      // 2. Утсаар идэвхтэй token байвал хүчингүй болгоно
      await supabaseAdmin
        .from('sokh_activation_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('sokh_id', sokhId)
        .eq('contact_phone', r.darga_phone)
        .is('used_at', null);

      // 3. Шинэ код үүсгэнэ
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const code_hash = await bcrypt.hash(code, 12);
      const expires_at = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { error: tokErr } = await supabaseAdmin
        .from('sokh_activation_tokens')
        .insert([{
          sokh_id: sokhId,
          code_hash,
          contact_phone: r.darga_phone,
          expires_at,
          created_by_superadmin_id: superId,
        }]);
      if (tokErr) {
        results.push({ row: i, status: 'error', reason: 'Код үүсгэж чадсангүй' });
        continue;
      }

      // 4. Шинээр үүсгэсэн биш бол claim_status='pending' болгоно
      if (!isNew) {
        await supabaseAdmin
          .from('sokh_organizations')
          .update({ claim_status: 'pending' })
          .eq('id', sokhId)
          .neq('claim_status', 'active');
      }

      results.push({
        row: i,
        status: isNew ? 'created' : 'matched',
        sokh_id: sokhId,
        sokh_name: sokhName,
        code,
        contact_phone: r.darga_phone,
        expires_at,
      });
    } catch (e) {
      console.error('[bulk-onboard row]', i, e);
      results.push({ row: i, status: 'error', reason: 'Серверийн алдаа' });
    }
  }

  const summary = {
    total: rows.length,
    created: results.filter(r => r.status === 'created').length,
    matched: results.filter(r => r.status === 'matched').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    error: results.filter(r => r.status === 'error').length,
  };

  return NextResponse.json({ summary, results });
}
