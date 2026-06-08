// WebAuthn / Passkey туслах — RP тохиргоо, challenge cookie, credential DB.
// Зөвхөн server-side (passkey routes) ашиглана.

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// ── RP (Relying Party) тохиргоог хүсэлтийн host-оос гаргах ──
// khotol.com / www.khotol.com → rpID 'khotol.com' (passkey хоёуланд ажиллана)
// localhost → 'localhost'; бусад (preview) → бүтэн host
export function getRpConfig(req: NextRequest): { rpID: string; origin: string; rpName: string } {
  const url = new URL(req.url);
  const host = url.host; // ж: khotol.com, www.khotol.com, localhost:3000
  const hostname = host.split(':')[0];
  let rpID: string;
  if (hostname === 'khotol.com' || hostname.endsWith('.khotol.com')) {
    rpID = 'khotol.com';
  } else {
    rpID = hostname; // localhost эсвэл preview
  }
  const origin = `${url.protocol}//${host}`;
  return { rpID, origin, rpName: 'Хотол Удирдлага' };
}

// Бүх боломжит origin (www + apex)-ийг зөвшөөрөх жагсаалт
export function expectedOrigins(req: NextRequest): string[] {
  const { origin } = getRpConfig(req);
  const set = new Set([origin, 'https://khotol.com', 'https://www.khotol.com']);
  return [...set];
}

// ── Challenge cookie (HMAC-signed, богино настай) ──
export const CHALLENGE_COOKIE = 'pk-challenge';

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

export function packChallenge(challenge: string): string {
  return `${challenge}.${sign(challenge)}`;
}

export function unpackChallenge(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const idx = cookieValue.lastIndexOf('.');
  if (idx === -1) return null;
  const challenge = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  if (sign(challenge) !== sig) return null;
  return challenge;
}

// ── Superadmin хэрэглэгч + түүний passkey-ууд ──
export interface SuperadminUser {
  id: number;
  username: string;
  display_name: string | null;
}

export async function loadSuperadmin(): Promise<SuperadminUser | null> {
  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, display_name')
    .eq('role', 'superadmin')
    .eq('status', 'active')
    .single();
  return data ?? null;
}

export interface StoredCredential {
  id: number;
  credential_id: string; // base64url
  public_key: string; // base64url
  counter: number;
  transports: string | null;
}

export async function loadCredentials(adminUserId: number): Promise<StoredCredential[]> {
  const { data } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, credential_id, public_key, counter, transports')
    .eq('admin_user_id', adminUserId);
  return (data ?? []) as StoredCredential[];
}

// base64url ↔ Uint8Array
// Шинэ ArrayBuffer дээр суурилсан хуулбар буцаана (simplewebauthn-ийн
// Uint8Array<ArrayBuffer> төрөлд тааруулах).
export function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, 'base64url');
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}
export function bytesToB64u(b: Uint8Array): string {
  return Buffer.from(b).toString('base64url');
}
