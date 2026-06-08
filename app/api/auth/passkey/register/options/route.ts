import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { checkAuth } from '@/app/lib/session-token';
import {
  getRpConfig,
  loadSuperadmin,
  loadCredentials,
  packChallenge,
  CHALLENGE_COOKIE,
} from '@/app/lib/webauthn';

// POST /api/auth/passkey/register/options
// Passkey бүртгэхийн тулд эхлээд superadmin-аар нэвтэрсэн байх ёстой.
export async function POST(req: NextRequest) {
  const auth = await checkAuth('superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await loadSuperadmin();
  if (!user) return NextResponse.json({ error: 'Superadmin олдсонгүй' }, { status: 404 });

  const creds = await loadCredentials(user.id);
  const { rpID, rpName } = getRpConfig(req);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    userDisplayName: user.display_name || user.username,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: 'none',
    excludeCredentials: creds.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
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
