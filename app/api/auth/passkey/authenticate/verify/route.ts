import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createSessionToken } from '@/app/lib/session-token';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import {
  getRpConfig,
  expectedOrigins,
  loadSuperadmin,
  loadCredentials,
  unpackChallenge,
  b64uToBytes,
  CHALLENGE_COOKIE,
} from '@/app/lib/webauthn';

// POST /api/auth/passkey/authenticate/verify  { response, remember? }
// Амжилттай бол superadmin-session cookie олгоно.
export async function POST(req: NextRequest) {
  const user = await loadSuperadmin();
  if (!user) return NextResponse.json({ error: 'Superadmin олдсонгүй' }, { status: 404 });

  let body: { response?: { id?: string }; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const expectedChallenge = unpackChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!expectedChallenge) return NextResponse.json({ error: 'Challenge байхгүй/хүчингүй' }, { status: 400 });

  const creds = await loadCredentials(user.id);
  const cred = creds.find((c) => c.credential_id === body.response?.id);
  if (!cred) return NextResponse.json({ error: 'Бүртгэгдсэн passkey олдсонгүй' }, { status: 400 });

  const { rpID } = getRpConfig(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: body.response as any,
      expectedChallenge,
      expectedOrigin: expectedOrigins(req),
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: b64uToBytes(cred.public_key),
        counter: Number(cred.counter),
        transports: cred.transports ? JSON.parse(cred.transports) : undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Баталгаажуулалт амжилтгүй' }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Баталгаажуулалт амжилтгүй' }, { status: 400 });
  }

  // Counter + last_used шинэчлэх
  await supabaseAdmin
    .from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id);

  // superadmin session олгох (remember → 30 хоног)
  const token = createSessionToken({ userId: user.id, sokhId: 0 });
  const maxAge = body.remember ? 60 * 60 * 24 * 30 : 43200;

  const res = NextResponse.json({ verified: true });
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge,
    path: '/',
  };
  res.cookies.set('superadmin-session', token, cookieOpts);
  // Passkey бол хүчтэй MFA — имэйл OTP-г алгасаж 2-р шатыг баталгаажуулсанд тооцно
  res.cookies.set('sa-otp-verified', 'true', cookieOpts);
  res.cookies.set(CHALLENGE_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
