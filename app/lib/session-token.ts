import { createHmac, randomUUID } from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// HMAC-SHA256 гарын үсэг
function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

// Token үүсгэх: payload.signature
export function createSessionToken(parts: {
  userId: string | number;
  sokhId?: string | number;
}): string {
  const timestamp = Date.now();
  const nonce = randomUUID();
  const payload = `${timestamp}:${parts.sokhId || 0}:${parts.userId}:${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

// Token шалгах: signature + хугацаа
export function validateSessionToken(token: string, maxAgeMs: number): {
  valid: boolean;
  userId?: string;
  sokhId?: string;
} {
  if (!token) return { valid: false };

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return { valid: false };

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  // Signature шалгах
  const expectedSig = sign(payload);
  if (sig !== expectedSig) return { valid: false };

  // Timestamp шалгах
  const parts = payload.split(':');
  if (parts.length < 4) return { valid: false };

  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return { valid: false };
  if (Date.now() - timestamp > maxAgeMs) return { valid: false };

  return {
    valid: true,
    sokhId: parts[1],
    userId: parts[2],
  };
}
