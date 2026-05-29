// СӨХ-ийн одоо ашиглаж байгаа аппын сонголтууд (нэгдсэн эх сурвалж).
// hoa_directory.current_app багана энэ value-уудыг л хадгална.
// UI dropdown болон API validation хоёулаа эндээс уншина.

export type CurrentAppValue =
  | 'KHOTOL'
  | 'OTHER'
  | 'MANUAL'
  | 'UNKNOWN';

export interface CurrentAppOption {
  value: CurrentAppValue;
  label: string;
  // Жагсаалт дээрх өнгөний хэв маяг (tailwind)
  badgeClass: string;
}

export const CURRENT_APP_OPTIONS: readonly CurrentAppOption[] = [
  { value: 'KHOTOL', label: 'Хотол', badgeClass: 'bg-green-100 text-green-700' },
  { value: 'OTHER', label: 'Бусад апп', badgeClass: 'bg-orange-100 text-orange-700' },
  { value: 'MANUAL', label: 'Цаасан / гар аргаар', badgeClass: 'bg-gray-200 text-gray-600' },
  { value: 'UNKNOWN', label: 'Мэдэгдэхгүй', badgeClass: 'bg-gray-100 text-gray-400' },
] as const;

const VALUE_SET = new Set<string>(CURRENT_APP_OPTIONS.map((o) => o.value));

export function isCurrentAppValue(v: unknown): v is CurrentAppValue {
  return typeof v === 'string' && VALUE_SET.has(v);
}

export function currentAppLabel(v: string | null | undefined): string {
  if (!v) return '—';
  return CURRENT_APP_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
