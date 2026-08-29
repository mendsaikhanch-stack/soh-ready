import { createHmac, randomUUID } from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// HMAC-SHA256 гарын үсэг
function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

// Token үүсгэх: payload.signature
// payload = timestamp:sokhId:userId:role:nonce  (role signature-т шингэнэ)
export function createSessionToken(parts: {
  userId: string | number;
  sokhId?: string | number;
  role: AuthRole;
}): string {
  const timestamp = Date.now();
  const nonce = randomUUID();
  const payload = `${timestamp}:${parts.sokhId || 0}:${parts.userId}:${parts.role}:${nonce}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

// Token шалгах: signature + хугацаа + (сонголтоор) role
// expectedRole өгвөл token доторх role түүнтэй таарахгүй бол хүчингүй болно.
// Ингэснээр нэг role-ийн cookie-г өөр role-ийн cookie нэрээр хуулж эрх
// өсгөх боломжийг хаана (жишээ нь admin-session → superadmin-session).
export function validateSessionToken(token: string, maxAgeMs: number, expectedRole?: AuthRole): {
  valid: boolean;
  userId?: string;
  sokhId?: string;
  role?: AuthRole;
} {
  if (!token) return { valid: false };

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return { valid: false };

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  // Signature шалгах
  const expectedSig = sign(payload);
  if (sig !== expectedSig) return { valid: false };

  // Формат: timestamp:sokhId:userId:role:nonce (5 хэсэг заавал)
  const parts = payload.split(':');
  if (parts.length < 5) return { valid: false };

  const timestamp = parseInt(parts[0], 10);
  if (isNaN(timestamp)) return { valid: false };
  if (Date.now() - timestamp > maxAgeMs) return { valid: false };

  const role = parts[3] as AuthRole;
  // Role тулгах — cookie нэр биш, token доторх гарын үсэгтэй role-оор шийднэ
  if (expectedRole && role !== expectedRole) return { valid: false };

  return {
    valid: true,
    sokhId: parts[1],
    userId: parts[2],
    role,
  };
}

// ============ Shared auth helpers ============

export type AuthRole = 'admin' | 'superadmin' | 'osnaa' | 'inspector';

// Серверийн баталгаажуулалтын дээд хугацаа. Нэвтрэлтийн БОДИТ хугацааг
// cookie-гийн maxAge (login дахь "Намайг сана" сонголт) удирдана:
//   • "Намайг сана" ✓ → cookie 30 хоног
//   • тэмдэглээгүй    → cookie 12ц (superadmin) / 24ц (бусад), хөтөч өөрөө устгана
// Тиймээс энэ утгыг cookie-гийн дээд хугацаатай (30 хоног) тэнцүү болгов —
// эс бол богино server cap нь 30 хоногийн cookie-г 12 цагийн дараа хүчингүй
// болгож, идэвхтэй засвар үйлчилгээний үед байнга гаргаж байв.
// (Хэрэглэгч цөөн, байнга ажиллаж буй үеийн зөөлрүүлсэн горим — OTP_DISABLED-тэй адил.)
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 хоног
const ROLE_MAX_AGE: Record<AuthRole, number> = {
  admin: SESSION_TTL,
  superadmin: SESSION_TTL,
  osnaa: SESSION_TTL,
  inspector: SESSION_TTL,
};

// Нэг role-ийн session шалгах — token доторх role мөн таарах ёстой
export async function checkAuth(role: AuthRole): Promise<{ valid: boolean; userId?: string; sokhId?: string; role?: AuthRole }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(`${role}-session`)?.value;
  if (!token) return { valid: false };
  return validateSessionToken(token, ROLE_MAX_AGE[role], role);
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
