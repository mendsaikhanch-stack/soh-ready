// Импортын баганы хувирамжуудыг нэг загварт буулгах + талбар бүрийг шалгах

export interface MappedDirectoryRow {
  officialName: string;
  displayName?: string | null;
  aliases: string[];
  district?: string | null;
  khoroo?: string | null;
  address?: string | null;
  sohCode?: string | null;
  phone?: string | null;
  buildingCount?: number | null;
  unitCount?: number | null;
  status: 'ACTIVE' | 'PENDING' | 'HIDDEN';
}

export interface ValidatedRow {
  ok: boolean;
  data?: MappedDirectoryRow;
  errors: string[];
  warnings: string[];
}

// Боломжит баганы нэрсийн хувилбарууд
// (бүгдийг lowercase болгож харьцуулна)
const COLUMN_ALIASES: Record<keyof MappedDirectoryRow | 'alias_1' | 'alias_2' | 'alias_3' | 'alias_4' | 'alias_5', string[]> = {
  officialName: ['official_name', 'name', 'сөхийн нэр', 'soh name', 'сөх нэр', 'нэр', 'official name'],
  displayName: ['display_name', 'товч нэр', 'display'],
  aliases: ['aliases', 'өөр нэрс'],
  alias_1: ['alias_1', 'alias1'],
  alias_2: ['alias_2', 'alias2'],
  alias_3: ['alias_3', 'alias3'],
  alias_4: ['alias_4', 'alias4'],
  alias_5: ['alias_5', 'alias5'],
  district: ['district', 'дүүрэг'],
  khoroo: ['khoroo', 'хороо'],
  address: ['address', 'хаяг'],
  sohCode: ['soh_code', 'сөх код', 'код', 'code'],
  phone: ['phone', 'утас', 'phone_number'],
  buildingCount: ['building_count', 'байр тоо', 'байрны тоо'],
  unitCount: ['unit_count', 'тоот тоо', 'айлын тоо', 'нийт тоот'],
  status: ['status', 'төлөв'],
};

const STATUS_VALUES: Record<string, 'ACTIVE' | 'PENDING' | 'HIDDEN'> = {
  active: 'ACTIVE',
  идэвхтэй: 'ACTIVE',
  pending: 'PENDING',
  хүлээгдэж: 'PENDING',
  hidden: 'HIDDEN',
  далд: 'HIDDEN',
};

function normalizeKey(k: string): string {
  return k.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildLookup(headers: string[]): Map<string, string> {
  // header → канон key
  const map = new Map<string, string>();
  for (const h of headers) {
    const lh = normalizeKey(h);
    for (const [canon, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.some((a) => normalizeKey(a) === lh)) {
        map.set(canon, h);
        break;
      }
    }
  }
  return map;
}

function readStr(row: Record<string, unknown>, header: string | undefined): string {
  if (!header) return '';
  const v = row[header];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function readNum(row: Record<string, unknown>, header: string | undefined): number | null {
  const s = readStr(row, header);
  if (!s) return null;
  const cleaned = s.replace(/[,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function validateDirectoryRow(
  row: Record<string, unknown>,
  headerLookup: Map<string, string>
): ValidatedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const officialName = readStr(row, headerLookup.get('officialName'));
  if (!officialName) errors.push('officialName шаардлагатай');
  if (officialName && officialName.length > 200) errors.push('officialName хэт урт');

  const district = readStr(row, headerLookup.get('district')) || null;
  if (!district) warnings.push('district хоосон');

  const statusRaw = readStr(row, headerLookup.get('status')).toLowerCase();
  const status: 'ACTIVE' | 'PENDING' | 'HIDDEN' = STATUS_VALUES[statusRaw] || 'ACTIVE';

  const aliases: string[] = [];
  for (const k of ['alias_1', 'alias_2', 'alias_3', 'alias_4', 'alias_5']) {
    const v = readStr(row, headerLookup.get(k));
    if (v) aliases.push(v);
  }
  // "aliases" header нь ; эсвэл | эсвэл , -ээр тусгаарласан байж болно
  const aggregateAlias = readStr(row, headerLookup.get('aliases'));
  if (aggregateAlias) {
    aggregateAlias.split(/[;|,]/).map((s) => s.trim()).filter(Boolean).forEach((a) => aliases.push(a));
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    errors,
    warnings,
    data: {
      officialName,
      displayName: readStr(row, headerLookup.get('displayName')) || null,
      aliases,
      district,
      khoroo: readStr(row, headerLookup.get('khoroo')) || null,
      address: readStr(row, headerLookup.get('address')) || null,
      sohCode: readStr(row, headerLookup.get('sohCode')) || null,
      phone: readStr(row, headerLookup.get('phone')) || null,
      buildingCount: readNum(row, headerLookup.get('buildingCount')),
      unitCount: readNum(row, headerLookup.get('unitCount')),
      status,
    },
  };
}

export { buildLookup };
