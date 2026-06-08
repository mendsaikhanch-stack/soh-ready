import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import {
  getRpConfig,
  loadSuperadmin,
  loadCredentials,
  packChallenge,
  CHALLENGE_COOKIE,
} from '@/app/lib/webauthn';

// POST /api/auth/passkey/authenticate/options  (нээлттэй — нэвтрэхийн өмнө)
export async function POST(req: NextRequest) {
  const user = await loadSuperadmin();
  if (!user) return NextResponse.json({ error: 'Superadmin олдсонгүй' }, { status: 404 });

  const creds = await loadCredentials(user.id);
  const { rpID } = getRpConfig(req);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    userVerification: 'preferred',
  });

  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, packChallenge(options.challenge), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 300,
    path: '/',
  });
  return res;
}
