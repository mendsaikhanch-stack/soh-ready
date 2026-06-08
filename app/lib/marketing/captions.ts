// Caption үүсгэгч — Layer 2 (deterministic, AI шаардахгүй) + Layer 3 (AI rewrite) prompt.
//
// Зорилго: нэг кампанит ажлын үндсэн текстээс групп тус бүрт АРАЙ ӨӨР
// caption гаргах. Ингэснээр ижил постыг олон группэд тавихад Facebook-ийн
// давхардал/спам шүүлтэд өртөх эрсдэл багасна.
//
// Layer 2 нь түлхүүргүйгээр үргэлж ажиллана. Layer 3 (Anthropic) идэвхтэй
// үед илүү байгалийн дахин найруулга өгнө. Алдаа гарвал Layer 2-руу унана.

import type { GroupType } from './constants';

// Группийн төрөл тус бүрд тохирсон нээлтийн дэгээ (rotation-той)
const TYPE_HOOKS: Record<GroupType, string[]> = {
  hoa_mgmt: [
    'СӨХ-ийн удирдлагынхаа өдөр тутмын ажлыг хөнгөвчлөх шийдэл хайж байна уу? 👇',
    'СӨХ-ийн нярав, дарга нарт зориулсан мэдээлэл 📋',
    'Төлбөр цуглуулалт, оршин суугчдын мэдээллээ нэг дороос удирдъя 🏛',
  ],
  resident: [
    'Айл бүрт хэрэгтэй мэдээлэл 👇',
    'Оршин суугчдад зориулав 🏠',
    'Байрныхаа төлбөр, зарлал, гомдлоо утаснаасаа шийдээрэй 📱',
  ],
  apartment: [
    'Барилгынхаа оршин суугчдад зориулав 🏢',
    'Хороололынхоо удирдлагыг ухаалаг болгоё 🏢',
    'Байр доторх мэдээлэл солилцоог нэг апп дээр 👇',
  ],
  general: [
    'Сонирхвол үзээрэй 👇',
    'Хэрэгтэй мэдээлэл хуваалцлаа 📢',
    'Танд хэрэг болж магадгүй 👇',
  ],
};

// Хаалтын CTA хувилбарууд (rotation-той)
const CLOSERS = [
  'Дэлгэрэнгүй мэдээлэл, демо хүсвэл коммент / inbox-оор бичээрэй.',
  'Сонирхсон бол comment-д бичээрэй, бид холбогдоно.',
  'Асуух зүйл байвал inbox-оор чөлөөтэй бичээрэй 🙌',
  'Үнэгүй танилцуулга авах бол бичээрэй.',
];

/**
 * Deterministic caption — групп бүрт давтагдашгүй жижиг ялгаа гаргана.
 * index-ийг ашиглан hook/closer-ийг ротаци хийнэ.
 */
export function varyCaption(
  mainText: string,
  groupType: GroupType,
  index: number,
  linkUrl?: string | null,
): string {
  const hooks = TYPE_HOOKS[groupType] || TYPE_HOOKS.general;
  const hook = hooks[index % hooks.length];
  const closer = CLOSERS[index % CLOSERS.length];

  const parts = [hook, '', mainText.trim()];
  if (linkUrl && linkUrl.trim()) {
    parts.push('', `🔗 ${linkUrl.trim()}`);
  }
  parts.push('', closer);
  return parts.join('\n');
}

/**
 * Layer 3 — AI rewrite-д өгөх prompt. Утга, линк, баримтыг хадгална;
 * зөвхөн найруулга, үг сонголтыг группийн төрөлд тааруулж өөрчилнө.
 */
export function buildRewritePrompt(
  baseCaption: string,
  groupType: GroupType,
  groupName: string,
): string {
  const audience: Record<GroupType, string> = {
    hoa_mgmt: 'СӨХ-ийн дарга, нярав, удирдлагын ажилтнууд',
    resident: 'орон сууцны оршин суугчид',
    apartment: 'тодорхой байр/хорооллын оршин суугчид',
    general: 'ерөнхий олон нийт',
  };
  return [
    `Доорх Facebook group постыг "${groupName}" нэртэй группэд тохируулан дахин найруулна уу.`,
    `Уг группийн зорилтот үзэгчид: ${audience[groupType]}.`,
    '',
    '=== Эх пост ===',
    baseCaption,
    '',
    '=== Шаардлага ===',
    '- Утга, санал болгож буй үйлчилгээ, линк, холбоо барих заавар хэвээр үлдэнэ',
    '- Шинэ тоо, баримт, амлалт зохиож нэмэхгүй',
    '- Үг сонголт, өгүүлбэрийн дэс дарааг арай өөрчилж байгалийн, давтагдашгүй болго (спам шүүлтээс сэргийлэх)',
    '- Энгийн, дотно монгол хэлээр, 1-2 emoji-той',
    '- Зөвхөн постын эцсийн текстийг буцаа, тайлбар бүү нэм',
  ].join('\n');
}

/**
 * Лидэд илгээх дагалт (follow-up) мессеж үүсгэх prompt.
 */
export function buildFollowUpPrompt(opts: {
  leadName?: string | null;
  groupName?: string | null;
  campaignTitle?: string | null;
  note?: string | null;
}): string {
  return [
    'Facebook группээс ирсэн боломжит үйлчлүүлэгчид (лид) илгээх эелдэг, богино дагалт мессеж бичнэ үү.',
    opts.leadName ? `Лидийн нэр: ${opts.leadName}` : 'Лидийн нэр тодорхойгүй.',
    opts.groupName ? `Ямар группээс ирсэн: ${opts.groupName}` : '',
    opts.campaignTitle ? `Холбогдох кампанит ажил: ${opts.campaignTitle}` : '',
    opts.note ? `Тэмдэглэл: ${opts.note}` : '',
    '',
    '=== Шаардлага ===',
    '- Хотол (СӨХ-ийн ухаалаг удирдлагын апп) платформын нэрийн өмнөөс бичнэ',
    '- Дарамтгүй, тусламж санал болгосон өнгө аястай',
    '- Демо үзүүлэх эсвэл асуултад хариулахад бэлэн гэдгээ илэрхийлнэ',
    '- 3-5 өгүүлбэр, энгийн монгол хэлээр',
    '- Зөвхөн мессежийн текстийг буцаа',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Layer 2 follow-up (AI-гүй fallback) — энгийн загвар.
 */
export function templateFollowUp(leadName?: string | null): string {
  const greeting = leadName ? `Сайн байна уу, ${leadName}.` : 'Сайн байна уу.';
  return [
    greeting,
    '',
    'Та Хотол (СӨХ-ийн ухаалаг удирдлагын апп)-ын талаар сонирхсон тул холбогдож байна.',
    'Төлбөр цуглуулалт, зарлал, гомдол, оршин суугчдын мэдээллийг нэг дороос удирдах боломжтой.',
    'Хүсвэл богино демо үзүүлж, асуултад тань хариулахад баяртай байх болно.',
    '',
    'Тохиромжтой цагаа хэлээрэй, бид холбогдоно. Баярлалаа! 🙌',
  ].join('\n');
}
