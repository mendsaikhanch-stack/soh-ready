// Гүйлгээний утгаас байр-орц-тоотыг СӨХ-ийн дугаарлалтын схемээр таних.
//
// Цэвэр логик, импортгүй — core.ts болон админ дэлгэц (client) хоёулаа ашиглана.
//
// Яагаад: «АйСиТаун» (#2694) эхэндээ тогтсон дугаарлалтгүй байсан. Оршин суугчид
// хуучин нэрээр (498, 203, 205) бичдэг, Хотол дотор бид «блок-орц» (1-1, 2-1, 2-2,
// 3-1, 5-1, 5-2)-оор хадгалсан. Аль ч бичиглэлээр ирсэн ойлгох ёстой, гэхдээ
// эргэлзээтэй бол ХЭЗЭЭ Ч таамаглахгүй — даргын шалгалт руу.
//
// residents.building-ийг ӨӨРЧЛӨХГҮЙ: QR, нэхэмжлэх, тайлан бүгд «блок-орц»
// түлхүүрээр холбогдсон. Албан ёсны нэр (498-2-613) нь зөвхөн харагдах шошго.

export interface SchemeEntrance {
  entrance: string;
  /** Давхар бүрийн тоотын сүүлийн 2 оронгийн муж (орц хамааралгүй үргэлжилсэн) */
  from: number;
  to: number;
}

export interface SchemeBuilding {
  /** Албан ёсны нэр — бүртгэл, тайланд харагдана */
  official: string;
  /** residents.building = `${internal}-${entrance}` */
  internal: string;
  floors: number;
  entrances: SchemeEntrance[];
  /**
   * Гүйлгээний утгад байрыг илэрхийлэх дугаарууд («-»-ээр нийлүүлсэн).
   * strong — ганцаараа байрыг ЯГ заана; ард нь орцны дугаар бичиж болно.
   */
  strongCodes: string[];
  /** Энэ байрыг заах МАГАДЛАЛТАЙ ч баталгаагүй дугаар — үргэлж шалгалт руу */
  weakCodes?: string[];
}

export interface UnitScheme {
  buildings: SchemeBuilding[];
}

// ------------------------------------------------------------
// «АйСиТаун» (#2694) — даргатай тохирсон дугаарлалт (2026-10-26)
// ------------------------------------------------------------
//  498-1 (Хотолд 1-1): 1 орц, давхарт 7 айл → 101–107 … 1601–1607
//  498-2 (Хотолд 2-1, 2-2): 2 орц, давхарт 7+7 айл, орц хамааралгүй үргэлжилнэ:
//        1-р орц 101–107, 2-р орц 108–114 … 1601–1607 / 1608–1614
//  203   (Хотолд 3-1): 1 орц, давхарт 5 айл → 101–105 … 1601–1605
//  205   (Хотолд 5-1, 5-2): 2 орц, давхарт 5+5 айл: 1-р орц 101–105, 2-р орц 106–110
//
//  «498-1607» (дэд дугааргүй 498) нь 498-1, 498-2 аль алинд нь байж болох тул
//  тоот нь ганц байранд таарсан ч ЗААВАЛ шалгаж баталгаажуулна.
//  «498/5», «498/2» гэж бүртгүүлсэн тохиолдол өмнө гарсан (merge-ictown-strays.mjs)
//  тул 498-3 → 203, 498-5 → 205-ыг зөвхөн санал болгоно.
export const ICTOWN_SCHEME: UnitScheme = {
  buildings: [
    {
      official: '498-1', internal: '1', floors: 16,
      entrances: [{ entrance: '1', from: 1, to: 7 }],
      strongCodes: ['498-1', '1'],
      weakCodes: ['498'],
    },
    {
      official: '498-2', internal: '2', floors: 16,
      entrances: [{ entrance: '1', from: 1, to: 7 }, { entrance: '2', from: 8, to: 14 }],
      strongCodes: ['498-2', '2'],
      weakCodes: ['498'],
    },
    {
      official: '203', internal: '3', floors: 16,
      entrances: [{ entrance: '1', from: 1, to: 5 }],
      strongCodes: ['203', '3'],
      weakCodes: ['498-3'],
    },
    {
      official: '205', internal: '5', floors: 16,
      entrances: [{ entrance: '1', from: 1, to: 5 }, { entrance: '2', from: 6, to: 10 }],
      strongCodes: ['205', '5'],
      weakCodes: ['498-5'],
    },
  ],
};

export const UNIT_SCHEMES: Record<number, UnitScheme> = {
  2694: ICTOWN_SCHEME,
};

export interface UnitCandidate {
  building_number: string;
  entrance_number: string;
  apartment_number: string;
  /** Албан ёсны хаяг, жишээ «498-2-613» */
  official: string;
}

export type UnitResolution =
  /** Байр, орц, тоот ганцхан утгаар тодорхой — дүрэмтэй адил ашиглаж болно */
  | { status: 'resolved'; unit: UnitCandidate }
  /** Тоот байгаа ч байр баталгаагүй (дан тоот, «498-…», «498/5») — шалгана */
  | { status: 'unconfirmed'; candidates: UnitCandidate[] }
  /** Бичсэн орц нь тоотын дугаартай зөрж байна (жишээ 205-2-505) */
  | { status: 'conflict'; candidates: UnitCandidate[] }
  /** Байр танигдсан ч ийм тоот тэр байранд байхгүй (жишээ 203-506) */
  | { status: 'invalid' }
  /** Утгаас хаяг уншигдсангүй */
  | { status: 'none' };

/**
 * Гүйлгээний утгаас хаягийн тоонуудыг дарааллаар нь гаргана.
 * Хаягт хамааралгүй тоог хасна: «10 сар», «10-р сарын» (сар), 5+ оронтой
 * (утас, дүн, QPay дугаар — тоот хамгийн ихдээ 4 оронтой).
 */
export function addressNumbers(text: string): string[] {
  const s = text
    .toLowerCase()
    .replace(/(?<!\d)\d{1,2}\s*-?\s*(?:р|r|n|н|ын|ийн|iin|yn)?\s*(?:сар|sar)\p{L}*/gu, ' ');
  return (s.match(/\d+/g) || []).filter((n) => n.length <= 4);
}

function unitIn(b: SchemeBuilding, apartment: string): SchemeEntrance | null {
  if (!/^[1-9]\d{2,3}$/.test(apartment)) return null;
  const n = Number(apartment);
  const floor = Math.floor(n / 100);
  const idx = n % 100;
  if (floor < 1 || floor > b.floors) return null;
  return b.entrances.find((e) => idx >= e.from && idx <= e.to) ?? null;
}

function candidate(b: SchemeBuilding, e: SchemeEntrance, apartment: string): UnitCandidate {
  return {
    building_number: b.internal,
    entrance_number: e.entrance,
    apartment_number: apartment,
    official: `${b.official}-${apartment}`,
  };
}

const key = (c: UnitCandidate) => `${c.building_number}-${c.entrance_number}-${c.apartment_number}`;

function uniq(cs: UnitCandidate[]): UnitCandidate[] {
  const m = new Map(cs.map((c) => [key(c), c]));
  return [...m.values()];
}

/**
 * Хүлээн авах хэлбэрүүд (тоонуудын дараалал, үг/тэмдэг хамаагүй):
 *   [байр, тоот]              498-1-1607 · 203-505 · 205 505 · 3-505
 *   [байр, орц, тоот]         203-1-505 · 205-1-505 · 3-1-505 · 2-2-613
 *   [498, дэд, орц, тоот]     498-2-1-505
 *   [498, тоот]               → unconfirmed (498-1 эсвэл 498-2)
 *   [тоот]                    → unconfirmed (бүх байрнаас)
 * Бусад бүх хэлбэр → none (таамаглахгүй).
 */
export function resolveUnitReference(scheme: UnitScheme, text: string | null | undefined): UnitResolution {
  if (!text) return { status: 'none' };
  const nums = addressNumbers(text);
  const res = resolveNumbers(scheme, nums);
  if (res.status !== 'none' || nums.length < 3) return res;

  // «498/2 байр 1 орц 4/ 405» — тоотын өмнөх тоо нь давхар (405 → 4) байж магадгүй.
  // Зөвхөн өөрөөр уншигдаагүй үед хасаж үзнэ, үр дүн нь ҮРГЭЛЖ санал (шалгалт руу).
  const apt = nums[nums.length - 1];
  const floor = nums[nums.length - 2];
  if (!/^\d{3,4}$/.test(apt) || !/^\d{1,2}$/.test(floor) || Number(floor) !== Math.floor(Number(apt) / 100)) return res;
  const alt = resolveNumbers(scheme, [...nums.slice(0, -2), apt]);
  return alt.status === 'resolved' ? { status: 'unconfirmed', candidates: [alt.unit] } : alt;
}

function resolveNumbers(scheme: UnitScheme, nums: string[]): UnitResolution {
  if (nums.length === 0 || nums.length > 4) return { status: 'none' };

  const apartment = nums[nums.length - 1];
  const prefix = nums.slice(0, -1);

  if (prefix.length === 0) {
    const all = scheme.buildings.flatMap((b) => {
      const e = unitIn(b, apartment);
      return e ? [candidate(b, e, apartment)] : [];
    });
    return all.length ? { status: 'unconfirmed', candidates: all } : { status: 'none' };
  }

  const resolved: UnitCandidate[] = [];
  const conflicts: UnitCandidate[] = [];
  const weak: UnitCandidate[] = [];
  let buildingKnown = false;

  const code = prefix.join('-');
  const head = prefix.slice(0, -1).join('-');
  const entranceGiven = prefix[prefix.length - 1];
  // «498-1-…» нь 498-1 байр (орц биш) — сул кодын орцтой хэлбэрийг зөвхөн бусад үед
  const codeIsStrong = scheme.buildings.some((b) => b.strongCodes.includes(code));

  for (const b of scheme.buildings) {
    const e = unitIn(b, apartment);
    // [байр…, тоот]
    if (b.strongCodes.includes(code)) {
      buildingKnown = true;
      if (e) resolved.push(candidate(b, e, apartment));
    }
    // [байр…, орц, тоот] — орц нь тоотын дугаартай таарах ёстой
    if (head && b.strongCodes.includes(head) && b.entrances.some((x) => x.entrance === entranceGiven)) {
      buildingKnown = true;
      if (e && e.entrance === entranceGiven) resolved.push(candidate(b, e, apartment));
      else if (e) conflicts.push(candidate(b, e, apartment));
    }
    if (b.weakCodes?.includes(code)) {
      buildingKnown = true;
      if (e) weak.push(candidate(b, e, apartment));
    }
    // [498, 5, орц, тоот] — сул код ч орц нь тоотын дугаартай таарвал санал болгоно
    if (!codeIsStrong && head && b.weakCodes?.includes(head) && b.entrances.some((x) => x.entrance === entranceGiven)) {
      buildingKnown = true;
      if (e && e.entrance === entranceGiven) weak.push(candidate(b, e, apartment));
      else if (e) conflicts.push(candidate(b, e, apartment));
    }
  }

  const r = uniq(resolved);
  if (r.length === 1 && weak.length === 0 && conflicts.length === 0) return { status: 'resolved', unit: r[0] };
  if (r.length > 1 || weak.length > 0) return { status: 'unconfirmed', candidates: uniq([...r, ...weak]) };
  if (conflicts.length > 0) return { status: 'conflict', candidates: uniq(conflicts) };
  return buildingKnown ? { status: 'invalid' } : { status: 'none' };
}

/** residents.building («2-2») + тоот → албан ёсны хаяг («498-2-613»). Схемгүй бол null. */
export function officialUnitLabel(sokhId: number, residentBuilding: string | null, apartment: string | null): string | null {
  const scheme = UNIT_SCHEMES[sokhId];
  if (!scheme || !residentBuilding || !apartment) return null;
  const [internal, entrance] = residentBuilding.split('-');
  const b = scheme.buildings.find((x) => x.internal === internal);
  if (!b || !b.entrances.some((e) => e.entrance === entrance)) return null;
  return `${b.official}-${apartment}`;
}
