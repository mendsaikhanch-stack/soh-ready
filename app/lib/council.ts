import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { normalizePhone } from '@/app/lib/vote-ticket';

// Апп дахь «🏛 Зөвлөл» хэсгийн эрх — зөвхөн сервер.
//
// Эрх нээгдэх нөхцөл (хоёулаа):
//   1. Дарга оршин суугчдын жагсаалтаас тухайн хүнийг ТУЗ / Хяналт гэж
//      тэмдэглэсэн (board_members.resident_id = residents.id).
//   2. Оршин суугчийн одоогийн утас = тэмдэглэх үеийн утас (board_members.phone_number).
//
// Бүртгүүлэх, профайлаас утас солих үед OTP байхгүй тул зөвхөн утсаар
// таньж болохгүй; харин өөр хүн тоотыг нь «авч» бүртгүүлбэл утас зөрөөд эрх нээгдэхгүй.

export type Council = 'board' | 'audit';

export interface CouncilMember {
  residentId: number;
  council: Council;
  name: string;
  phone: string; // board_members.phone_number — proposal_voters-тэй тулгана
}

/** Bearer токеноос Supabase хэрэглэгчийг гаргана. */
async function userFromRequest(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  return user?.id || null;
}

export async function resolveCouncil(req: Request, sokhId: number): Promise<CouncilMember | null | 'unauth'> {
  const userId = await userFromRequest(req);
  if (!userId) return 'unauth';

  const { data: residents } = await supabaseAdmin
    .from('residents')
    .select('id, phone')
    .eq('auth_user_id', userId)
    .eq('sokh_id', sokhId);
  if (!residents || residents.length === 0) return null;

  const { data: members } = await supabaseAdmin
    .from('board_members')
    .select('resident_id, council, full_name, phone_number')
    .eq('sokh_id', sokhId)
    .in('resident_id', residents.map((r) => r.id));
  if (!members || members.length === 0) return null;

  for (const m of members) {
    const r = residents.find((x) => x.id === m.resident_id);
    if (!r) continue;
    const phone = normalizePhone(String(m.phone_number || ''));
    if (phone.length === 8 && normalizePhone(String(r.phone || '')) === phone) {
      return { residentId: r.id as number, council: m.council as Council, name: m.full_name as string, phone };
    }
  }
  return null;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
