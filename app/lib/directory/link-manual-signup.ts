import { supabaseAdmin } from '@/app/lib/supabase-admin';

// 8 оронтой Монгол утас гэж үзэн зөвхөн цифрийг үлдээх.
// "+976 99-00-11-22" → "97699001122" — гэхдээ эхний +976 гэсэн код байх юм бол
// сүүлийн 8 оронг гол утас гэж авна.
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, '');
  if (!digits) return null;
  // Олон улсын код байвал хасна (Монгол: 976)
  let core = digits;
  if (core.length > 8 && core.startsWith('976')) core = core.slice(3);
  if (core.length > 8) core = core.slice(-8);
  if (core.length < 8) return null;
  return core;
}

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  if (!v.includes('@')) return null;
  return v;
}

export interface LinkInput {
  userId: number; // residents.id
  phone?: string | null;
  email?: string | null;
  claimToken?: string | null;
}

export interface LinkReport {
  membershipsLinked: number;
  membershipsAlreadyClaimed: number;
  activationRequestsLinked: number;
  signupRequestsLinked: number;
  matchedDirectoryIds: number[];
  matchedProvisionalIds: number[];
  // ямар нэг шинэ бичлэг холбогдсон эсэхийг харуулах туслах
  anythingLinked: boolean;
}

// Pre-auth signup-аас үлдсэн provisional бичлэгүүдийг нэвтэрсэн user-тэй холбох.
// Idempotent — давхар дуудсан ч аль хэдийн user_id-той бичлэгийг хөндөхгүй.
export async function linkManualSignupToUser(input: LinkInput): Promise<LinkReport> {
  const phone = normalizePhone(input.phone || null);
  const email = normalizeEmail(input.email || null);
  const token = input.claimToken && input.claimToken.length >= 8 ? input.claimToken : null;

  const report: LinkReport = {
    membershipsLinked: 0,
    membershipsAlreadyClaimed: 0,
    activationRequestsLinked: 0,
    signupRequestsLinked: 0,
    matchedDirectoryIds: [],
    matchedProvisionalIds: [],
    anythingLinked: false,
  };

  if (!phone && !email && !token) return report;

  // 1) resident_memberships
  const memberships = await collectClaimableRows('resident_memberships' as const, { phone, email, token, userIdCol: 'user_id' });
  if (memberships.length > 0) {
    const ids = memberships.map((m) => m.id);
    // Memberships claim — directory эсвэл provisional-ыг шалгаж status тохируулна
    const directoryIds = Array.from(new Set(memberships.map((m) => m.directory_id).filter((v): v is number => v != null)));
    const provisionalIds = Array.from(new Set(memberships.map((m) => m.provisional_hoa_id).filter((v): v is number => v != null)));

    // Идэвхтэй tenant-той directory-уудыг олох
    let activeDirectoryIds = new Set<number>();
    if (directoryIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('hoa_directory')
        .select('id, linked_tenant_id')
        .in('id', directoryIds);
      activeDirectoryIds = new Set(
        (data || [])
          .filter((d) => d.linked_tenant_id != null)
          .map((d) => d.id as number)
      );
    }

    // ACTIVE_TENANT-д шилжих ёстой бичлэгүүдийг ялгах
    const activeMembershipIds: number[] = [];
    const linkedMembershipIds: number[] = [];
    const provisionalMembershipIds: number[] = [];
    for (const m of memberships) {
      if (m.directory_id && activeDirectoryIds.has(m.directory_id)) {
        activeMembershipIds.push(m.id);
      } else if (m.directory_id) {
        linkedMembershipIds.push(m.id);
      } else if (m.provisional_hoa_id) {
        provisionalMembershipIds.push(m.id);
      }
    }

    if (activeMembershipIds.length > 0) {
      await supabaseAdmin
        .from('resident_memberships')
        .update({ user_id: input.userId, status: 'ACTIVE_TENANT' })
        .in('id', activeMembershipIds)
        .is('user_id', null);
    }
    if (linkedMembershipIds.length > 0) {
      await supabaseAdmin
        .from('resident_memberships')
        .update({ user_id: input.userId, status: 'LINKED_TO_DIRECTORY' })
        .in('id', linkedMembershipIds)
        .is('user_id', null);
    }
    if (provisionalMembershipIds.length > 0) {
      await supabaseAdmin
        .from('resident_memberships')
        .update({ user_id: input.userId })
        .in('id', provisionalMembershipIds)
        .is('user_id', null);
    }

    report.membershipsLinked = ids.length;
    report.matchedDirectoryIds = directoryIds;
    report.matchedProvisionalIds = provisionalIds;
  }

  // 2) hoa_activation_requests
  const activationRows = await collectClaimableRows('hoa_activation_requests', { phone, email, token, userIdCol: 'user_id' });
  if (activationRows.length > 0) {
    const ids = activationRows.map((r) => r.id);
    await supabaseAdmin
      .from('hoa_activation_requests')
      .update({ user_id: input.userId })
      .in('id', ids)
      .is('user_id', null);
    report.activationRequestsLinked = ids.length;
  }

  // 3) user_signup_requests — phone/email/claim_token-аар (claimed_user_id IS NULL)
  const signupRows = await collectClaimableRows('user_signup_requests', { phone, email, token, userIdCol: 'claimed_user_id' });
  if (signupRows.length > 0) {
    const ids = signupRows.map((r) => r.id);
    await supabaseAdmin
      .from('user_signup_requests')
      .update({ claimed_user_id: input.userId, status: 'MATCHED' })
      .in('id', ids)
      .is('claimed_user_id', null);
    report.signupRequestsLinked = ids.length;
  }

  report.anythingLinked = report.membershipsLinked + report.activationRequestsLinked + report.signupRequestsLinked > 0;
  return report;
}

interface ClaimableRow {
  id: number;
  directory_id?: number | null;
  provisional_hoa_id?: number | null;
}

interface CollectArgs {
  phone: string | null;
  email: string | null;
  token: string | null;
  userIdCol: 'user_id' | 'claimed_user_id';
}

type ClaimableTable = 'resident_memberships' | 'hoa_activation_requests' | 'user_signup_requests';

// Тус хүснэгтээс claim хийх боломжтой бичлэгүүдийг (user_id IS NULL) олох.
// Phone, email, claim_token аль нэгээр таарвал авна.
async function collectClaimableRows(table: ClaimableTable, args: CollectArgs): Promise<ClaimableRow[]> {
  const out = new Map<number, ClaimableRow>();
  const isFull = table !== 'user_signup_requests';
  const phoneCol = isFull ? 'contact_phone' : 'phone';
  const emailCol = isFull ? 'contact_email' : 'email';

  const runQuery = async (col: string, value: string) => {
    if (isFull) {
      const { data } = await supabaseAdmin
        .from(table)
        .select('id, directory_id, provisional_hoa_id')
        .eq(col, value)
        .is(args.userIdCol, null)
        .limit(500);
      return (data || []) as ClaimableRow[];
    }
    const { data } = await supabaseAdmin
      .from(table)
      .select('id')
      .eq(col, value)
      .is(args.userIdCol, null)
      .limit(500);
    return (data || []).map((r) => ({ id: r.id as number })) as ClaimableRow[];
  };

  if (args.phone) for (const r of await runQuery(phoneCol, args.phone)) out.set(r.id, r);
  if (args.email) for (const r of await runQuery(emailCol, args.email)) out.set(r.id, r);
  if (args.token) for (const r of await runQuery('claim_token', args.token)) out.set(r.id, r);

  return Array.from(out.values());
}
