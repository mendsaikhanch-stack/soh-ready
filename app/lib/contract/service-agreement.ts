// Хотол ↔ СӨХ хоорондын үйлчилгээний гэрээ.
//
// Гэрээний БҮХ ТЕКСТ энд байна — өөр газар хуулбарлаж бичихгүй. Дэлгэц дээр
// харагдах хувилбар, Word-оор татдаг хувилбар хоёул энэ файлаас үүснэ. Эс
// тэгвэл нэгийг нь засахад нөгөө нь хуучин нөхцөлтэй үлдэж, СӨХ-үүд өөр
// өөр агуулгатай гэрээнд гарын үсэг зурах эрсдэлтэй.
//
// Дүнг ЗӨВХӨН `platform-pricing.ts` тооцно (айл × тариф). Энд дахин үржүүлбэл
// нэхэмжлэхтэй зөрнө.

import {
  type PlatformTariff,
  setupFee,
  monthlyFee,
  freeMonths,
  billingStartDate,
} from '@/app/lib/platform-pricing';

/** Гүйцэтгэгч тал — Хотолын хуулийн этгээдийн мэдээлэл.
 *  Регистр, банкны данс нь баримтжаагүй тул хоосон үлдээв: гэрээн дээр
 *  цэгтэй мөр болж хэвлэгдэнэ, гараар бөглөнө. Утга оруулмагц бүх гэрээнд
 *  автоматаар орно. */
export const PROVIDER = {
  company: 'Төгс Орчин ХХК',
  brand: 'Хотол',
  register: '',            // улсын бүртгэлийн дугаар
  address: 'Улаанбаатар хот',
  phone: '9401-9927',
  email: 'tugsorchin@yahoo.com',
  website: 'khotol.com',
  bank: '',                // банкны нэр
  bankAccount: '',         // дансны дугаар
  representative: '',      // гэрээ байгуулах эрх бүхий хүний нэр
  representativeTitle: 'Захирал',
};

export interface ContractOrg {
  id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** СӨХ-ийн улсын бүртгэлийн дугаар — DB-д хадгалагддаггүй, гараар бөглөнө */
  register?: string | null;
  /** Даргын нэр — DB-д хадгалагддаггүй, гараар бөглөнө */
  chairman?: string | null;
}

export interface ContractInput {
  number: string;
  date: Date;
  org: ContractOrg;
  apartments: number;
  tariff: PlatformTariff;
  /** Идэвхжсэн огноо — үнэгүй хугацаа эндээс тоологдоно */
  activatedAt?: string | null;
}

export interface ContractSection {
  no: number;
  title: string;
  clauses: string[];
}

/** Гэрээний дугаар: ХОТ-2026-2679. СӨХ-ийн id давхардахгүй тул дугаар давхцахгүй. */
export function contractNumberFor(orgId: number, date: Date = new Date()): string {
  return `ХОТ-${date.getFullYear()}-${orgId}`;
}

const money = (n: number) => `${Math.round(n).toLocaleString('en-US')}₮`;

export function mnDate(d: Date | null | undefined): string {
  if (!d || isNaN(d.getTime())) return '20…… оны …… сарын ……';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()} оны ${p(d.getMonth() + 1)} сарын ${p(d.getDate())}`;
}

/** Бөглөгдөөгүй талбарыг цэгтэй мөрөөр орлуулна — хэвлээд гараар бичнэ */
const blank = (v: string | null | undefined, len = 24) =>
  v && v.trim() ? v.trim() : '.'.repeat(len);

/** Гэрээний бүх заалт. Дараалал = хэвлэгдэх дараалал. */
export function contractSections(input: ContractInput): ContractSection[] {
  const { apartments, tariff } = input;
  const setup = setupFee(tariff, apartments);
  const monthly = monthlyFee(tariff, apartments);
  const free = freeMonths(tariff, apartments);
  const start = billingStartDate(
    input.activatedAt || input.date.toISOString(),
    tariff,
    apartments,
  );

  return [
    {
      no: 1,
      title: 'Гэрээний зүйл',
      clauses: [
        `Гүйцэтгэгч нь өөрийн эзэмшлийн «${PROVIDER.brand}» (${PROVIDER.website}) программ хангамжийн платформыг Захиалагчид ашиглуулж, Захиалагч нь энэхүү гэрээнд заасан төлбөрийг төлнө.`,
        'Захиалагчид платформыг ашиглах эрх олгогдох бөгөөд программ хангамжийн өмчлөх эрх Гүйцэтгэгчид хэвээр үлдэнэ.',
        'Платформ нь СӨХ-ийн удирдлагын хэсэг, оршин суугчийн гар утасны апп хоёроос бүрдэнэ.',
      ],
    },
    {
      no: 2,
      title: 'Үйлчилгээний хамрах хүрээ',
      clauses: [
        'Захиалагч дараах боломжийг ашиглана: (а) оршин суугч, айл өрхийн бүртгэл; (б) хураамжийн тооцоо, өр, төлбөрийн мэдэгдэл, банкны QR-аар төлөх; (в) орлого, зарлага, өрийн жагсаалт бүхий санхүүгийн тайлан; (г) зарлал, мэдэгдэл, оршин суугчидтай харилцах суваг; (д) засвар үйлчилгээ, гомдол, саналын бүртгэл; (е) санал хураалт, хурлын шийдвэрийн бүртгэл.',
        'Платформын шинэчлэлт, алдааны засварыг Гүйцэтгэгч нэмэлт төлбөргүй хийнэ.',
        'Гүйцэтгэгч Захиалагчийн ажилтнуудад анхан шатны сургалт өгч, оршин суугчдад апп танилцуулах QR материалыг нэмэлт төлбөргүй хүргүүлнэ.',
        'Зөвхөн Захиалагчид зориулсан тусгай хөгжүүлэлтийг талууд тус бүрд нь тохиролцож, нэмэлт гэрээгээр гүйцэтгэнэ.',
      ],
    },
    {
      no: 3,
      title: 'Төлбөр, тооцоо',
      clauses: [
        `Гэрээ байгуулах үеийн айлын тоо: ${apartments}. Төлбөрийг айлын тоогоор тооцно.`,
        `Суурилуулалтын нэг удаагийн төлбөр: ${apartments} айл × ${money(tariff.setup_per_unit)} = ${money(setup)}.`,
        `Сарын хураамж: ${apartments} айл × ${money(tariff.monthly_per_unit)} = ${money(monthly)}.`,
        `Үйлчилгээ эхэлснээс хойш ${free} сарын хугацаанд сарын хураамж тооцогдохгүй. Сарын хураамж ${mnDate(start)}-ний өдрөөс эхэлнэ.`,
        'Гүйцэтгэгч сар бүрийн эхний 5 хоногт нэхэмжлэх илгээх ба Захиалагч тухайн сарын 15-ны дотор төлнө.',
        'Айлын тоо өөрчлөгдвөл дараагийн сарын хураамжийг шинэ тоогоор тооцно. Суурилуулалтын төлбөр дахин тооцогдохгүй.',
        `Төлбөрийг Гүйцэтгэгчийн ${blank(PROVIDER.bank, 14)} банкны ${blank(PROVIDER.bankAccount, 16)} тоот дансаар төлнө. Гүйцэтгэгч төлбөрт и-баримт олгоно.`,
      ],
    },
    {
      no: 4,
      title: 'Оршин суугчийн хураамжийн урсгал',
      clauses: [
        'Оршин суугчийн төлсөн хураамж шууд Захиалагчийн банкны данс руу шилжинэ. Гүйцэтгэгч уг мөнгийг хүлээн авах, дамжуулах, түүнээс шимтгэл суутгах эрхгүй.',
        'Гүйцэтгэгч зөвхөн төлбөрийн бүртгэл, тооцоолол, мэдэгдлийн хэрэгслээр хангана. Төлбөр бүрэн орсон эсэхийг банкны хуулгаар баталгаажуулах нь Захиалагчийн үүрэг.',
      ],
    },
    {
      no: 5,
      title: 'Гүйцэтгэгчийн эрх, үүрэг',
      clauses: [
        'Платформыг тасралтгүй ажиллуулж, сарын дунджаар 99 хувиас доошгүй хүртээмжтэй байлгах.',
        'Өгөгдлийг өдөр бүр нөөцлөх, алдагдал болон зөвшөөрөлгүй нэвтрэлтээс хамгаалах.',
        'Ажлын өдрүүдэд 09:00–18:00 цагт дэмжлэг үзүүлж, хүсэлтэд 1 ажлын өдөрт багтаан хариу өгөх.',
        'Урьдчилан төлөвлөсөн засвар үйлчилгээг 24 цагийн өмнө Захиалагчид мэдэгдэх.',
        'Захиалагч болон оршин суугчдын өгөгдлийг гуравдагч этгээдэд задруулах, зар сурталчилгаанд ашиглахыг хориглоно.',
        'Төлбөр 30 хоногоос дээш хугацаагаар хэтэрсэн тохиолдолд 6.5-д заасан журмаар үйлчилгээг түр зогсоох эрхтэй.',
      ],
    },
    {
      no: 6,
      title: 'Захиалагчийн эрх, үүрэг',
      clauses: [
        'Системд оруулсан өгөгдөл (айл, талбай, хураамжийн хэмжээ, өр)-ийн үнэн зөвийг хариуцах.',
        'Нэвтрэх нэр, нууц үгээ хамгаалах, ажилтан өөрчлөгдсөн тохиолдолд эрхийг нь нэн даруй хаалгах.',
        'Оршин суугчдын хувийн мэдээллийг зөвхөн СӨХ-ийн үйл ажиллагааны зорилгоор ашиглах.',
        'Платформыг задлан шинжлэх, хуулбарлах, гуравдагч этгээдэд ашиглуулах, дамжуулан борлуулахыг хориглоно.',
        'Төлбөрийг хугацаанд нь төлөх. 30 хоногоос дээш хугацаагаар хэтэрвэл Гүйцэтгэгч бичгээр мэдэгдэн үйлчилгээг түр зогсооно. Энэ тохиолдолд өгөгдөл устгагдахгүй, төлбөр төлөгдмөгц үйлчилгээ сэргэнэ.',
        'Платформын алдаа, доголдлыг илрүүлсэн даруй Гүйцэтгэгчид мэдэгдэх.',
      ],
    },
    {
      no: 7,
      title: 'Өгөгдлийн эзэмшил, нууцлал',
      clauses: [
        'Захиалагчийн болон оршин суугчдын өгөгдөл нь Захиалагчийн өмч мөн.',
        'Гүйцэтгэгч уг өгөгдлийг зөвхөн үйлчилгээ үзүүлэх зорилгоор боловсруулна.',
        'Гэрээ дуусгавар болсноос хойш 30 хоногийн дотор Захиалагчийн хүсэлтээр өгөгдлийг Excel эсвэл CSV хэлбэрээр хүлээлгэн өгч, 90 хоногийн дотор системээс устгана.',
        'Талууд Хүний хувийн мэдээлэл хамгаалах тухай хууль болон холбогдох бусад хууль тогтоомжийг дагаж мөрдөнө.',
      ],
    },
    {
      no: 8,
      title: 'Хариуцлага',
      clauses: [
        'Төлбөрөө хугацаанд нь төлөөгүй бол хэтэрсэн хоног тутамд төлөгдөөгүй дүнгийн 0.1 хувиар алданги тооцох ба алданги нь төлбөрийн дүнгийн 10 хувиас хэтрэхгүй.',
        'Гүйцэтгэгчийн буруугаас үйлчилгээ нэг сард нийт 72 цагаас дээш хугацаагаар тасалдвал тухайн сарын хураамжийг тооцохгүй.',
        'Захиалагчийн буруу оруулсан өгөгдлөөс үүдэн гарсан үр дагаврыг Гүйцэтгэгч хариуцахгүй.',
        'Талуудын хүлээх эд хөрөнгийн хариуцлагын хэмжээ нь сүүлийн 6 сард төлсөн төлбөрийн нийт дүнгээс хэтрэхгүй.',
        'Давагдашгүй хүчин зүйл (гал, үер, газар хөдлөлт, улсын хэмжээний цахилгаан, интернэтийн тасалдал, эрх бүхий байгууллагын шийдвэр)-ийн улмаас үүргээ биелүүлээгүй бол талууд хариуцлага хүлээхгүй.',
      ],
    },
    {
      no: 9,
      title: 'Гэрээний хугацаа, цуцлах',
      clauses: [
        `Гэрээ ${mnDate(input.date)}-ний өдрөөс эхлэн 1 жилийн хугацаанд хүчинтэй. Дуусахаас 30 хоногийн өмнө аль нэг тал бичгээр эсэргүүцээгүй бол дараагийн 1 жилээр сунгагдана.`,
        'Аль ч тал 30 хоногийн өмнө бичгээр мэдэгдэн гэрээг цуцалж болно.',
        'Гэрээ цуцлагдвал Захиалагчийн урьдчилж төлсөн, ашиглаагүй бүтэн саруудын төлбөрийг Гүйцэтгэгч 14 хоногийн дотор буцаана. Суурилуулалтын төлбөр буцаагдахгүй.',
        'Захиалагч 6.4-т заасан хоригийг зөрчсөн тохиолдолд Гүйцэтгэгч гэрээг нэн даруй цуцлах эрхтэй.',
      ],
    },
    {
      no: 10,
      title: 'Бусад нөхцөл',
      clauses: [
        'Гэрээнд оруулах нэмэлт, өөрчлөлтийг талууд бичгээр үйлдэж, гарын үсэг зурснаар хүчин төгөлдөр болно.',
        `Гэрээний салшгүй хэсэг: ${PROVIDER.website}/terms/admin хаягт нийтэлсэн Үйлчилгээний нөхцөл, ${PROVIDER.website}/privacy хаягт нийтэлсэн Нууцлалын бодлого. Зөрчилдвөл энэхүү гэрээ давуу үйлчилнэ.`,
        'Гэрээтэй холбоотой мэдэгдлийг доор заасан и-мэйл, утсаар илгээж болох ба хүлээн авсанд тооцно.',
        'Маргааныг талууд хэлэлцээрийн журмаар шийдвэрлэх ба эс бөгөөс Монгол Улсын шүүхээр шийдвэрлүүлнэ.',
        `Гэрээг хоёр хувь үйлдэж, тал бүр нэг хувийг хадгална. Хоёр хувь адил хүчинтэй. Гэрээний дугаар: ${input.number}.`,
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Хэвлэх / Word хувилбар
// ─────────────────────────────────────────────────────────────────────────

/** DB дэх нэр нь «СӨХ» гэдгээ агуулсан ч, агуулаагүй ч байдаг. Хоёр дахин
 *  бичихээс сэргийлж шалгана. */
function orgLegalName(name: string): string {
  const n = name.trim();
  return /СӨХ|холбоо/i.test(n) ? n : `«${n}» СӨХ`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface RenderOptions {
  /** Гүйцэтгэгчийн тамга, гарын үсгийг урьдчилан буулгана — data: URI хэлбэрээр
   *  ГАДНААС дамжуулна. Энэ репо public тул бэхний зургийг код дотор БҮҮ хадгал
   *  (`docs/contracts/assets/` нь .gitignore-д). Дамжуулаагүй бол өнөөгийнх
   *  шигээ цэгтэй мөр гарч, гараар тамгална. */
  seal?: { stamp: string; signature: string };
}

/** Гэрээний бүтэн HTML — хөтчид хэвлэхэд ч, Word-т нээхэд ч ижил гарна.
 *  Гадны файл (font, зураг) татдаггүй тул офлайн ч зөв харагдана. */
export function renderContractHtml(input: ContractInput, opts: RenderOptions = {}): string {
  const { org } = input;
  const sections = contractSections(input);

  const body = sections
    .map(
      s => `
  <h2>${s.no}. ${esc(s.title)}</h2>
${s.clauses
  .map((c, i) => `  <p class="cl">${s.no}.${i + 1}. ${esc(c)}</p>`)
  .join('\n')}`,
    )
    .join('\n');

  const line = (label: string, value: string) =>
    `<p class="rq"><span class="lb">${esc(label)}:</span> ${esc(value)}</p>`;

  // Гүйцэтгэгчийн гарын үсгийн хэсэг. Тамгалсан хувилбарт бэхний зураг
  // урьдчилан суусан байх тул СӨХ зөвхөн өөрийнхөө талыг бөглөнө.
  const signLine = `<p class="rq sg">${esc(PROVIDER.representativeTitle)}: ..............................</p>
      <p class="rq">/${esc(blank(PROVIDER.representative, 20))}/</p>`;

  const providerSign = opts.seal
    ? `<div class="ink">
        <img class="sig" src="${opts.seal.signature}" alt="">
        <img class="stamp" src="${opts.seal.stamp}" alt="">
        ${signLine}
      </div>`
    : `${signLine}
      <p class="rq">Тамга</p>`;

  return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8">
<title>${esc(`Үйлчилгээний гэрээ ${input.number}`)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Times New Roman', 'Cambria', serif; font-size: 11.5pt;
         line-height: 1.45; color: #000; margin: 0; padding: 24px; background: #fff; }
  h1 { font-size: 14pt; text-align: center; margin: 0 0 4pt; text-transform: uppercase; }
  .num { text-align: center; font-size: 10.5pt; margin: 0 0 14pt; }
  .head { display: flex; justify-content: space-between; font-size: 10.5pt; margin-bottom: 12pt; }
  h2 { font-size: 11.5pt; margin: 13pt 0 5pt; }
  p { margin: 0 0 4pt; }
  .cl { text-align: justify; }
  .intro { text-align: justify; margin-bottom: 8pt; }
  table.sign { width: 100%; border-collapse: collapse; margin-top: 16pt; page-break-inside: avoid; }
  table.sign td { width: 50%; vertical-align: top; padding: 0 10pt 0 0; font-size: 10.5pt; }
  table.sign th { text-align: left; font-size: 11pt; padding-bottom: 5pt; border-bottom: 1px solid #000; }
  .rq { margin: 0 0 3pt; }
  .lb { color: #444; }
  .sg { margin-top: 16pt; }
  /* Урьдчилан тамгалсан хувилбар — бэхийг гарын үсгийн мөрийн дээгүүр байрлуулна */
  .ink { position: relative; margin-top: 14pt; padding-top: 62pt; }
  .ink .sig { position: absolute; left: 60pt; top: 0; width: 112pt; }
  .ink .stamp { position: absolute; left: 2pt; top: 4pt; width: 58pt; }
  .ink .sg { margin-top: 0; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>Үйлчилгээний гэрээ</h1>
<p class="num">Дугаар: ${esc(input.number)}</p>
<div class="head">
  <span>${esc(mnDate(input.date))}-ны өдөр</span>
  <span>${esc(PROVIDER.address)}</span>
</div>

<p class="intro">Нэг талаас <b>${esc(PROVIDER.company)}</b>-ийг төлөөлж
${esc(PROVIDER.representativeTitle)} ${esc(blank(PROVIDER.representative, 18))} (цаашид «Гүйцэтгэгч» гэх),
нөгөө талаас <b>${esc(orgLegalName(org.name))}</b>-ийг төлөөлж дарга
${esc(blank(org.chairman, 18))} (цаашид «Захиалагч» гэх) нар харилцан тохиролцож
энэхүү гэрээг байгуулав.</p>
${body}

<table class="sign">
  <tr>
    <th>ГҮЙЦЭТГЭГЧ</th>
    <th>ЗАХИАЛАГЧ</th>
  </tr>
  <tr>
    <td>
      ${line('Байгууллага', PROVIDER.company)}
      ${line('Улсын бүртгэл', blank(PROVIDER.register, 14))}
      ${line('Хаяг', PROVIDER.address)}
      ${line('Утас', PROVIDER.phone)}
      ${line('И-мэйл', PROVIDER.email)}
      ${providerSign}
    </td>
    <td>
      ${line('Байгууллага', orgLegalName(org.name))}
      ${line('Улсын бүртгэл', blank(org.register, 14))}
      ${line('Хаяг', blank(org.address, 20))}
      ${line('Утас', blank(org.phone, 12))}
      ${line('И-мэйл', blank(org.email, 18))}
      <p class="rq sg">СӨХ-ийн дарга: ..............................</p>
      <p class="rq">/${esc(blank(org.chairman, 20))}/</p>
      <p class="rq">Тамга</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Татаж авах файлын нэр — Cyrillic агуулсан тул header-т RFC 5987-ээр өгнө */
export function contractFileName(input: ContractInput, ext: 'doc' | 'html'): string {
  const safe = input.org.name.replace(/[\\/:*?"<>|]/g, '').trim();
  return `Үйлчилгээний гэрээ - ${safe} - ${input.number}.${ext}`;
}
