// Mongolian/Cyrillic-aware СӨХ нэрийн нормчлол
// Зорилго: ижил СӨХ-ийг бичлэгийн ялгаа байсан ч таних
// Жишээ: "Од СӨХ", "ОД  СӨХ.", "Од сох" → "од"

const SOH_TOKENS = [
  'сөх',
  'сох',
  'cөх',
  'cox',
  'soh',
  'sokh',
  'нийтлэг өмчлөгчдийн холбоо',
  'орон сууцны өмчлөгчдийн холбоо',
];

const NOISE_PUNCT = /[.,/\\#!$%^&*;:{}=\-_`~()"'?<>|@+\[\]]/g;

// Кирилл/Латин үсгийг нэгэн төрөлд (lowercase) шилжүүлэх
function unifyCyrillicLatin(input: string): string {
  return input
    .replace(/[Үү]/g, 'ү')
    .replace(/[Өө]/g, 'ө')
    .replace(/[Ёё]/g, 'ё');
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function stripSohSuffix(input: string): string {
  let out = input;
  for (const token of SOH_TOKENS) {
    // нэрийн төгсгөлд эсвэл эхэнд байгаа СӨХ-ийг арилгах
    const re = new RegExp(`(^|\\s)${token}(\\s|$)`, 'gi');
    out = out.replace(re, ' ');
  }
  return out;
}

export function normalizeSohName(input: string | null | undefined): string {
  if (!input) return '';
  let v = String(input);
  v = unifyCyrillicLatin(v.toLowerCase());
  v = v.replace(NOISE_PUNCT, ' ');
  v = collapseWhitespace(v);
  v = stripSohSuffix(v);
  v = collapseWhitespace(v);
  return v;
}

// Хайлтын тестэд зориулсан өргөн нормчлол
// (нэр + дүүрэг + хороо + хаяг бүгдийг нэг тэжээлд)
export function buildSearchText(fields: {
  officialName?: string | null;
  displayName?: string | null;
  aliases?: (string | null | undefined)[];
  district?: string | null;
  khoroo?: string | null;
  address?: string | null;
  sohCode?: string | null;
}): string {
  const parts = [
    fields.officialName,
    fields.displayName,
    ...(fields.aliases || []),
    fields.district,
    fields.khoroo,
    fields.address,
    fields.sohCode,
  ]
    .filter(Boolean)
    .map((p) => normalizeSohName(p as string));
  return collapseWhitespace(parts.join(' '));
}

// Levenshtein distance — fuzzy match-д зориулсан энгийн хувилбар
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
        ? prev
        : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[n];
}

// 0..1 хооронд таарал. 1 = яг таарсан.
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - dist / max;
}
