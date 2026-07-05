import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { getAuthRole } from '@/app/lib/session-token';
import { voteCreateLimiter } from '@/app/lib/rate-limit';
import { sendSms } from '@/app/lib/sms';
import { normalizePhone } from '@/app/lib/vote-ticket';

interface VoterInput {
  phone?: string;
  name?: string;
}

const MAX_VOTERS = 50;

// POST /api/vote/create
// - Админ session-тэй бол:   1-р СӨХ доторх суурин санал (kind=internal, sokh_id=session)
// - Session байхгүй бол:      нээлттэй борлуулалтын санал (kind=public, sokh_id=null)
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  try {
    const body = await req.json();
    const {
      title,
      description,
      budget_amount,
      expires_in_days,
      pass_threshold_percentage,
      auto_approve_on_timeout,
      org_name,
      creator_name,
      creator_phone,
      voters,
    } = body as {
      title?: string;
      description?: string;
      budget_amount?: number;
      expires_in_days?: number;
      pass_threshold_percentage?: number;
      auto_approve_on_timeout?: boolean;
      org_name?: string;
      creator_name?: string;
      creator_phone?: string;
      voters?: VoterInput[];
    };

    // --- Баталгаажуулалт ---
    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: 'Гарчиг доод тал нь 3 тэмдэгт байна' }, { status: 400 });
    }
    if (!Array.isArray(voters) || voters.length === 0) {
      return NextResponse.json({ error: 'Дор хаяж 1 гишүүн нэмнэ үү' }, { status: 400 });
    }
    if (voters.length > MAX_VOTERS) {
      return NextResponse.json({ error: `Хамгийн ихдээ ${MAX_VOTERS} гишүүн` }, { status: 400 });
    }

    const days = Math.min(Math.max(Number(expires_in_days) || 3, 1), 30);
    const threshold = Math.min(Math.max(Math.round(Number(pass_threshold_percentage) || 50), 1), 100);
    const autoApprove = auto_approve_on_timeout === true;

    // Гишүүдийг цэвэрлэж давхардлыг арилгах
    const seen = new Set<string>();
    const cleanVoters: { phone_number: string; full_name: string | null }[] = [];
    for (const v of voters) {
      const phone = normalizePhone(v.phone || '');
      if (phone.length !== 8) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      cleanVoters.push({ phone_number: phone, full_name: v.name?.trim() || null });
    }
    if (cleanVoters.length === 0) {
      return NextResponse.json({ error: 'Зөв утасны дугаар (8 орон) оруулна уу' }, { status: 400 });
    }

    // --- Эрх / шат тодорхойлох ---
    const auth = await getAuthRole();
    const isInternal = !!auth && (auth.role === 'admin' || auth.role === 'superadmin' || auth.role === 'osnaa');

    let sokhId: number | null = null;
    let createdBy = 'public';
    if (isInternal && auth) {
      sokhId = auth.sokhId ? parseInt(auth.sokhId, 10) : null;
      if (!sokhId) {
        return NextResponse.json({ error: 'Session-д СӨХ тодорхойгүй' }, { status: 403 });
      }
      createdBy = `${auth.role}:${auth.userId || '0'}`;
    } else {
      // Нээлттэй санал — rate limit + чөлөөт мэдээлэл шаардах
      const rl = voteCreateLimiter.check(ip);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: `Хэт олон санал үүсгэлээ. ${rl.retryAfterSec}с хүлээнэ үү` },
          { status: 429 },
        );
      }
      if (!creator_phone || normalizePhone(creator_phone).length !== 8) {
        return NextResponse.json({ error: 'Даргын утасны дугаар шаардлагатай' }, { status: 400 });
      }
    }

    const resultToken = randomUUID();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    // --- proposals оруулах ---
    const { data: proposal, error: pErr } = await supabaseAdmin
      .from('proposals')
      .insert({
        sokh_id: sokhId,
        kind: isInternal ? 'internal' : 'public',
        title: title.trim(),
        description: description?.trim() || null,
        budget_amount: budget_amount != null ? Number(budget_amount) : null,
        status: 'active',
        pass_threshold_percentage: threshold,
        auto_approve_on_timeout: autoApprove,
        org_name: org_name?.trim() || null,
        created_by: createdBy,
        created_by_name: creator_name?.trim() || null,
        created_by_phone: creator_phone ? normalizePhone(creator_phone) : null,
        result_token: resultToken,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (pErr || !proposal) {
      console.error('[vote/create] proposal', pErr?.message);
      return NextResponse.json({ error: 'Санал үүсгэхэд алдаа гарлаа' }, { status: 500 });
    }

    const proposalId = proposal.id as number;

    // --- proposal_voters оруулах ---
    const voterRows = cleanVoters.map((v) => ({
      proposal_id: proposalId,
      sokh_id: sokhId,
      phone_number: v.phone_number,
      full_name: v.full_name,
      invite_token: randomUUID(),
    }));

    const { error: vErr } = await supabaseAdmin.from('proposal_voters').insert(voterRows);
    if (vErr) {
      console.error('[vote/create] voters', vErr.message);
      // proposal-ыг цэвэрлэх (best-effort)
      await supabaseAdmin.from('proposals').delete().eq('id', proposalId);
      return NextResponse.json({ error: 'Гишүүд нэмэхэд алдаа гарлаа' }, { status: 500 });
    }

    // --- Урилгын SMS илгээх (одоогоор stub) ---
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : 'https://khotol.com');
    const voteUrl = `${origin}/vote/${proposalId}`;

    await Promise.all(
      cleanVoters.map((v) =>
        sendSms(
          v.phone_number,
          `Хотол: "${title.trim()}" санал асуулгад санал өгнө үү. ${voteUrl}`,
        ),
      ),
    );

    return NextResponse.json({
      id: proposalId,
      result_token: resultToken,
      vote_url: voteUrl,
      result_url: `${origin}/vote/${proposalId}/result?k=${resultToken}`,
      voters_count: cleanVoters.length,
    });
  } catch (err) {
    console.error('[vote/create] unexpected', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}
