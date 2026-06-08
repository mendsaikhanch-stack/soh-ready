import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { checkAuth } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import {
  getRpConfig,
  expectedOrigins,
  loadSuperadmin,
  unpackChallenge,
  bytesToB64u,
  CHALLENGE_COOKIE,
} from '@/app/lib/webauthn';

// POST /api/auth/passkey/register/verify  { response, deviceName? }
export async function POST(req: NextRequest) {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await loadSuperadmin();
  if (!user) return NextResponse.json({ error: 'Superadmin олдсонгүй' }, { status: 404 });

  let body: { response?: unknown; deviceName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const expectedChallenge = unpackChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!expectedChallenge) return NextResponse.json({ error: 'Challenge байхгүй/хүчингүй' }, { status: 400 });

  const { rpID } = getRpConfig(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: body.response as any,
      expectedChallenge,
      expectedOrigin: expectedOrigins(req),
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Баталгаажуулалт амжилтгүй' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Баталгаажуулалт амжилтгүй' }, { status: 400 });
  }

  const cred = verification.registrationInfo.credential;
  const { error } = await supabaseAdmin.from('webauthn_credentials').insert([
    {
      admin_user_id: user.id,
      credential_id: cred.id,
      public_key: bytesToB64u(cred.publicKey),
      counter: cred.counter,
      transports: JSON.stringify(cred.transports || []),
      device_name: (body.deviceName || 'Төхөөрөмж').slice(0, 60),
    },
  ]);

  if (error) {
    const msg = error.message.includes('duplicate') ? 'Энэ төхөөрөмж аль хэдийн бүртгэгдсэн' : 'DB error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const res = NextResponse.json({ verified: true });
  res.cookies.set(CHALLENGE_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
