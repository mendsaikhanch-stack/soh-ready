import { createHmac, randomUUID } from 'crypto';
import { cookies } from 'next/headers';

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

// ============ Shared auth helpers ============

export type AuthRole = 'admin' | 'superadmin' | 'osnaa' | 'inspector';

const ROLE_MAX_AGE: Record<AuthRole, number> = {
  admin: 24 * 60 * 60 * 1000,
  superadmin: 12 * 60 * 60 * 1000,
  osnaa: 24 * 60 * 60 * 1000,
  inspector: 24 * 60 * 60 * 1000,
};

// Нэг role-ийн session шалгах
export async function checkAuth(role: AuthRole): Promise<{ valid: boolean; userId?: string; sokhId?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(`${role}-session`)?.value;
  if (!token) return { valid: false };
  return validateSessionToken(token, ROLE_MAX_AGE[role]);
}

// Олон role-ийн аль нэгийг шалгах (admin || superadmin гэх мэт)
export async function checkAnyAuth(...roles: AuthRole[]): Promise<{ valid: boolean; role?: AuthRole; userId?: string; sokhId?: string }> {
  for (const role of roles) {
    const result = await checkAuth(role);
    if (result.valid) return { ...result, role };
  }
  return { valid: false };
}

// Бүх role-ийн дотроос хамгийн өндөр эрхтэйг олох
export async function getAuthRole(): Promise<{ role: AuthRole; userId?: string; sokhId?: string } | null> {
  const order: AuthRole[] = ['superadmin', 'admin', 'osnaa', 'inspector'];
  for (const role of order) {
    const result = await checkAuth(role);
    if (result.valid) return { role, userId: result.userId, sokhId: result.sokhId };
  }
  return null;
}
