import Link from 'next/link';

// Оршин суугчдад шууд илгээх нээлттэй заавар хуудас — khotol.com/zaavar
// СӨХ-ийн нэр агуулаагүй тул аль ч СӨХ-д ижил линкийг тараана.
export const metadata = {
  title: 'Оршин суугчийн заавар — Хотол',
  description:
    'Гар утсаараа СӨХ-ийн апп-даа нэвтэрч, өрийн үлдэгдэл, зарлал, засварын хүсэлтээ нэг дороос хараарай.',
  openGraph: {
    title: 'Байрныхаа мэдээллийг гар утаснаасаа',
    description:
      'Утасны дугаараараа нэвтэрч, өрийн үлдэгдэл, зарлал, гомдол, засварын хүсэлтээ нэг дороос хараарай.',
    url: '/zaavar',
  },
};

const STEPS = [
  {
    t: 'Дээрх «Нэвтрэх» товчийг дарна',
    d: 'Утсаараа энэ хуудсыг үзэж байгаа бол шууд дарна. Компьютерээс үзэж байгаа бол доорх QR кодыг утасныхаа камераар уншуулна.',
  },
  {
    t: 'Утасны дугаараараа нэвтэрнэ',
    d: 'Утасны дугаар, нууц үгээ оруулна. Бүртгэлгүй бол «Бүртгүүлэх» дарна — доорх 2 тохиолдлыг үзнэ үү.',
  },
  {
    t: 'Нууц үгээ солино',
    d: 'Эхний удаа нэвтэрсний дараа «Миний мэдээлэл» → «Нууц үг солих»-оос өөрийн нууц үгээ тавина.',
  },
  {
    t: 'Апп болгож суулгана',
    d: 'Хөтчийн цэснээс «Нүүр дэлгэцэнд нэмэх» дарж, апп шиг байнга ашиглаж болно.',
  },
];

export default function ZaavarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-5 pt-7 pb-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-lg bg-white/20 grid place-items-center font-extrabold">Х</span>
          <span className="font-extrabold text-lg">Хотол</span>
        </div>
        <h1 className="text-[26px] leading-tight font-extrabold mb-2.5">
          Гар утсаараа СӨХ-ийн апп-даа нэвтэрнэ үү
        </h1>
        <p className="text-blue-100 text-sm leading-relaxed">
          Өрийн үлдэгдэл, зарлал мэдээ, санал хүсэлт, гомдол, засварын хүсэлт — байрныхаа бүх
          зүйлийг нэг дороос хараарай.
        </p>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Гол товч */}
        <Link
          href="/login"
          className="block w-full bg-blue-600 text-white text-center py-4 rounded-2xl font-bold text-base shadow-lg shadow-blue-600/25 active:scale-[0.98] transition"
        >
          Нэвтрэх
        </Link>

        {/* Алхмууд */}
        <ol className="space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="flex gap-3.5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm grid place-items-center">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="font-bold text-[15px] text-gray-800">{s.t}</p>
                <p className="text-sm text-gray-500 leading-relaxed mt-0.5">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Хоёр тохиолдол */}
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-[11px] font-bold tracking-wider text-blue-700 uppercase mb-1.5">
              СӨХ тань бүртгэсэн бол
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              <b>Нэвтрэх нэр:</b> таны утасны дугаар
              <br />
              <b>Эхний нууц үг:</b> мөн таны утасны дугаар
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-[11px] font-bold tracking-wider text-blue-700 uppercase mb-1.5">
              Бүртгэлгүй бол
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              <Link href="/register" className="text-blue-600 font-semibold underline">
                Бүртгүүлэх
              </Link>{' '}
              дарж дүүрэг → хороо → СӨХ-өө сонгоод, байр, тоотоо оруулна.
            </p>
          </div>
        </div>

        {/* QR — компьютерээс үзэж байгаа хүнд */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
          <p className="text-sm font-bold text-gray-700 mb-3">Компьютерээс үзэж байна уу?</p>
          <div className="bg-white inline-block rounded-xl p-2 ring-1 ring-gray-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="180"
              height="180"
              viewBox="0 0 27 27"
              shapeRendering="crispEdges"
              role="img"
              aria-label="khotol.com/login QR код"
            >
              <path fill="#ffffff" d="M0 0h27v27H0z" />
              <path
                stroke="#0e1b30"
                d="M1 1.5h7m1 0h1m3 0h1m1 0h1m3 0h7M1 2.5h1m5 0h1m1 0h1m4 0h1m2 0h1m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h2m3 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m2 0h3m1 0h4m1 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h2m1 0h4m1 0h1m1 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m2 0h2m1 0h3m3 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M11 8.5h4m1 0h1M1 9.5h1m2 0h7m1 0h1m2 0h4m2 0h1m1 0h3M3 10.5h3m2 0h3m1 0h1m1 0h3m3 0h5M2 11.5h1m3 0h3m3 0h2m2 0h1m1 0h1m1 0h1m1 0h1m2 0h1M1 12.5h2m1 0h2m3 0h1m1 0h1m4 0h1m1 0h2m1 0h5M1 13.5h1m3 0h4m1 0h2m5 0h1m1 0h2m4 0h1M1 14.5h3m4 0h1m1 0h2m1 0h1m1 0h2m4 0h1m2 0h1M1 15.5h2m4 0h1m2 0h1m4 0h4m2 0h5M1 16.5h1m1 0h1m1 0h2m1 0h1m1 0h1m2 0h1m4 0h1m1 0h1m1 0h2m1 0h1M1 17.5h1m1 0h1m1 0h1m1 0h1m1 0h6m2 0h5m1 0h2M9 18.5h4m4 0h1m3 0h1m1 0h2M1 19.5h7m1 0h3m1 0h1m3 0h1m1 0h1m1 0h1m3 0h1M1 20.5h1m5 0h1m1 0h4m1 0h1m1 0h2m3 0h1m3 0h1M1 21.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h7M1 22.5h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h4m1 0h2m4 0h2M1 23.5h1m1 0h3m1 0h1m3 0h3m1 0h1m1 0h1m3 0h5M1 24.5h1m5 0h1m3 0h1m3 0h1m3 0h3m1 0h3M1 25.5h7m1 0h3m1 0h1m3 0h3m2 0h1m2 0h1"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Утасныхаа камерыг QR код руу чиглүүлнэ.
            <br />
            Эсвэл хөтчөөр <b className="text-gray-700">khotol.com/login</b> хаягаар орно.
          </p>
        </div>

        {/* Нууц үг мартсан */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-amber-800 mb-1">Нууц үгээ мартсан уу?</p>
          <p className="text-sm text-amber-900/80 leading-relaxed">
            СӨХ-ийнхөө даргад хандана уу. Дарга таны нууц үгийг утасны дугаар болгож сэргээж өгнө.
            Дараа нь нэвтрээд «Миний мэдээлэл»-ээс өөрийн нууц үгээ тавина.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 pb-2">
          <Link href="/help" className="hover:text-gray-600">
            Тусламж
          </Link>
          <span className="mx-1.5">·</span>
          <Link href="/privacy" className="hover:text-gray-600">
            Нууцлал
          </Link>
          <span className="mx-1.5">·</span>
          <Link href="/contact" className="hover:text-gray-600">
            Холбоо барих
          </Link>
        </p>
      </div>
    </div>
  );
}
