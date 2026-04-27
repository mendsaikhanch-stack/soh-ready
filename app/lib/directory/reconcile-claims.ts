// Claims reconciliation
// Зорилго: resident_memberships-д user_id null боловч phone/email/token-аар
// тааралдсан resident байвал auto-link хийх. Хэзээ ч хүчирхийллээр өөр user-руу
// шилжүүлэхгүй (Phase I safety rules).

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { linkManualSignupToUser, normalizePhone, normalizeEmail } from './link-manual-signup';

export interface ClaimReconcileReport {
  scanned: number;
  linked: number;
  alreadyLinked: number;
  noMatch: number;
  errors: number;
}

/**
 * Бүх unclaimed resident_memberships-ыг шалгаад phone/email-ээр resident-тэй
 * холбож үзнэ. Гэхдээ хэзээ ч одоо байгаа user_id-г overwrite хийхгүй.
 */
export async function reconcileAllUnclaimedMemberships(opts: { limit?: number } = {}): Promise<ClaimReconcileReport> {
  const limit = opts.limit ?? 200;
  const report: ClaimReconcileReport = { scanned: 0, linked: 0, alreadyLinked: 0, noMatch: 0, errors: 0 };

  const { data: memberships, error } = await supabaseAdmin
    .from('resident_memberships')
    .select('id, user_id, contact_phone, contact_email, claim_token')
    .is('user_id', null)
    .limit(limit);
  if (error) {
    console.error('[reconcileAllUnclaimedMemberships]', error.message);
    report.errors++;
    return report;
  }

  for (const m of memberships || []) {
    report.scanned++;
    const phone = normalizePhone(m.contact_phone);
    const email = normalizeEmail(m.contact_email);
    const token = (m.claim_token as string) || null;
    if (!phone && !email && !token) {
      report.noMatch++;
      continue;
    }

    // Resident-ийг утсаар хайх
    let resident: { id: number } | null = null;
    if (phone) {
      const { data } = await supabaseAdmin
        .from('residents')
        .select('id')
        .eq('phone', phone)
        .limit(1)
        .maybeSingle();
      if (data) resident = data as { id: number };
    }
    if (!resident && email) {
      const { data } = await supabaseAdmin
        .from('residents')
        .select('id')
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      if (data) resident = data as { id: number };
    }
    if (!resident) {
      report.noMatch++;
      continue;
    }

    try {
      const r = await linkManualSignupToUser({
        userId: resident.id,
        phone: phone || undefined,
        email: email || undefined,
        claimToken: token || undefined,
      });
      if (r.anythingLinked) report.linked++;
      else report.alreadyLinked++;
    } catch (e) {
      console.error('[reconcileAllUnclaimedMemberships row]', m.id, e);
      report.errors++;
    }
  }

  return report;
}

/**
 * Зөвхөн нэг тодорхой resident-н claim-уудыг дахин уях. Job retry-аас дуудна.
 */
export async function reconcileClaimsForResident(residentId: number): Promise<void> {
  const { data: r } = await supabaseAdmin
    .from('residents')
    .select('id, phone, email')
    .eq('id', residentId)
    .maybeSingle();
  if (!r) return;
  await linkManualSignupToUser({
    userId: r.id,
    phone: r.phone || undefined,
    email: (r as { email?: string }).email || undefined,
  });
}
