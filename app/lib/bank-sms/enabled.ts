// Банкны SMS функц асаалттай СӨХ-үүд. Бусад СӨХ-ийн даргад цэс харагдахгүй,
// /api/admin/bank-sms болон /api/bank-sms 403 буцаана (superadmin үл хамаарна).
// Шинэ СӨХ-д нэвтрүүлэхдээ id-г нь энд нэмнэ.
export const BANK_SMS_SOKH_IDS: readonly number[] = [
  2694, // АйСиТаун (ICTown) — ХасБанк 131888
];

export function isBankSmsEnabled(sokhId: number | string | null | undefined): boolean {
  const id = Number(sokhId);
  return Number.isSafeInteger(id) && BANK_SMS_SOKH_IDS.includes(id);
}
