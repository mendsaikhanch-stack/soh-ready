import { createHmac } from 'crypto';

const SECRET = process.env.QR_SECRET || process.env.SESSION_SECRET || 'dev-qr-secret-change-in-production';

// HMAC-SHA256
function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

export type QrKind = 'gate' | 'gate-guest' | 'elevator';

export interface QrTokenPayload {
  kind: QrKind;
  sokhId: number;
  userId?: string | number;
  apartment?: string | null;
  floor?: number;
  guestName?: string;
  // Issued at, expires at (unix ms)
  iat: number;
  exp: number;
}

// Token үүсгэх: base64url(json).signature
export function createQrToken(parts: Omit<QrTokenPayload, 'iat' | 'exp'> & { ttlSec: number }): string {
  const iat = Date.now();
  const exp = iat + parts.ttlSec * 1000;
  const payload: QrTokenPayload = {
    kind: parts.kind,
    sokhId: parts.sokhId,
    userId: parts.userId,
    apartment: parts.apartment ?? null,
    floor: parts.floor,
    guestName: parts.guestName,
    iat,
    exp,
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

// Token шалгах
export function validateQrToken(token: string): {
  valid: boolean;
  reason?: 'malformed' | 'bad_signature' | 'expired';
  payload?: QrTokenPayload;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'malformed' };
  }

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return { valid: false, reason: 'malformed' };

  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = sign(b64);
  if (sig !== expectedSig) return { valid: false, reason: 'bad_signature' };

  let payload: QrTokenPayload;
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    payload = JSON.parse(json) as QrTokenPayload;
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return { valid: false, reason: 'expired', payload };
  }

  return { valid: true, payload };
}
