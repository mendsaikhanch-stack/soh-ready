'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const problems = [
  {
    icon: '💸',
    title: 'Төлбөрийн мэдээлэл будилах',
    desc: 'Хэн юу төлсөн, хэдэн төгрөг үлдсэн нь тодорхойгүй. Гар бичмэл, Excel дамжсаар алдаатай болдог.',
  },
  {
    icon: '📵',
    title: 'Зар, мэдэгдэл хүрэхгүй',
    desc: 'Ус, дулааны мэдэгдэл хаалган дээр наасан цаас, Viber группээр дамждаг. Олон хүн харахгүй өнгөрдөг.',
  },
  {
    icon: '📝',
    title: 'Хүсэлт, гомдол алга болох',
    desc: 'Утсаар, амаар хэлсэн хүсэлтүүд бичигдэхгүй. Хариу хэзээ, хэн өгөх нь тодорхой бус.',
  },
  {
    icon: '🔎',
    title: 'Ил тод байдал сул',
    desc: 'СӨХ-ийн орлого, зарлагыг оршин суугч шалгах боломжгүй. Үүнээс итгэлцэл алдагддаг.',
  },
];

const solutions = [
  { icon: '🏢', title: 'СӨХ-өө олох', desc: 'Хот, дүүрэг, хороогоор өөрийн СӨХ-ийг хайж олно.' },
  { icon: '👤', title: 'Оршин суугчийн бүртгэл', desc: 'Утсаа баталгаажуулж байр, тооттойгоо холбоно.' },
  { icon: '📢', title: 'Зар, мэдэгдэл', desc: 'СӨХ-ийн мэдэгдлийг шуурхай, бүгдэд адил хүргэнэ.' },
  { icon: '💳', title: 'Төлбөр, үлдэгдэл', desc: 'Хувийн нэхэмжлэл, үлдэгдлээ ил тод харна.' },
  { icon: '🛠', title: 'Хүсэлт, гомдол', desc: 'Бичгээр илгээсэн хүсэлт төлөвтэйгөө хадгалагдана.' },
  { icon: '🚗', title: 'Зогсоол удирдлага', desc: 'Машин бүртгэл, хаалт нээх QR, хаагдсан машин мэдэгдэх, зочны машин.' },
  { icon: '📍', title: 'СӨХ жагсаалтад байхгүй бол', desc: 'Өөрөө мэдээллээ оруулж бүртгүүлээд СӨХ-д дохио өгнө.' },
];

const residentBenefits = [
  'Өөрийн СӨХ-өө олно',
  'Төлбөр, мэдэгдлээ нэг дороос харна',
  'Хүсэлт, гомдол бичгээр илгээж, төлөвийг нь дагана',
  'Машинаа бүртгэж, хаалт нээх QR, "хаагдсан" мэдэгдлийг гартаа хадгална',
  'СӨХ жагсаалтад байхгүй бол өөрөө бүртгүүлж, СӨХ-д дохио үүсгэнэ',
];

const adminBenefits = [
  'Оршин суугчдын бүрэн бүртгэл',
  'Зар, мэдэгдлийг нэг л удаа нийтлээд бүгдэд хүргэх',
  'Хүсэлт, гомдлыг төлөвтэй удирдах',
  'Зогсоол: машин, зогсоолын дугаар, зочин, хаалганы тохиргоо нэг дороос',
  'Санхүү, үйл ажиллагааны ил тод байдлыг сайжруулах',
  'СӨХ-д хэдэн оршин суугч сонирхож байгааг харах demand dashboard',
];

const faqs = [
  {
    q: 'СӨХ жагсаалтад байхгүй бол яах вэ?',
    a: 'Та өөрөө СӨХ-ийнхээ нэр, байршил, тоотоо оруулж бүртгүүлж болно. Энэ нь СӨХ дээр Хотол ашиглах сонирхлын дохио үүсгэнэ.',
  },
  {
    q: 'Апп татах шаардлагатай юу?',
    a: 'Үгүй. Хотол нь вебээр ажилладаг бөгөөд гар утсандаа PWA болгож суулгах боломжтой. Цаашид Play Store / App Store-д гаргахаар бэлдэж байна.',
  },
  {
    q: 'СӨХ админ яаж холбогдох вэ?',
    a: 'Холбоо барих хуудаснаас СӨХ админд зориулсан утас, и-мэйлийг ашиглана уу. Бид таны СӨХ-д Хотол нэвтрүүлэхэд туслана.',
  },
  {
    q: 'Мэдээлэл аюулгүй юу?',
    a: 'Нууцлалын бодлогын дагуу таны мэдээллийг зөвхөн өөрийн СӨХ-ийн эрх бүхий хэрэглэгчид харж болно. Дэлгэрэнгүйг "Нууцлалын бодлого"-оос харна уу.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />

        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center text-white">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-green-400/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs mb-6 border border-green-300/40">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-green-50">Pilot үе шат · эхний 3-5 СӨХ үнэгүй туршина</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
              Хотол — СӨХ-ийн <span className="text-yellow-300">зар, төлбөр, хүсэлт, тайлан</span> нэг дор
            </h1>
            <p className="text-blue-100 text-base md:text-lg mb-8 leading-relaxed max-w-xl mx-auto md:mx-0">
              СӨХ, хотхон, оршин суугчдын өдөр тутмын мэдээлэл, харилцааг цэгцлэх систем.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center md:justify-start">
              <button
                onClick={() => router.push('/find-hoa')}
                className="px-7 py-3.5 bg-white text-blue-700 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
              >
                СӨХ-өө хайх →
              </button>
              <Link
                href="/demo-admin"
                className="px-7 py-3.5 bg-yellow-300 text-blue-900 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all text-center"
              >
                🎬 Demo харах
              </Link>
              <Link
                href="/contact"
                className="px-7 py-3.5 bg-white/10 backdrop-blur border border-white/25 text-white rounded-xl font-semibold text-sm hover:bg-white/20 transition text-center"
              >
                СӨХ админ бол холбогдох
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-white/10 rounded-3xl blur-2xl" />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20">
              <Image
                src="/hero/landing-couch.png"
                alt="Хотол апп ашиглаж буй гэр бүл — Улаанбаатарын орон сууцны үзэмж"
                width={1376}
                height={768}
                priority
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-red-600 tracking-wide uppercase mb-2">Асуудал</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">СӨХ-ийн өдөр тутамд тулгардаг бэрхшээл</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Ихэнх СӨХ Excel, цаас, чатын бүлгэмээр ажилладаг. Үүнээс үүдэн дараах асуудлууд гардаг:
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {problems.map(p => (
              <div key={p.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex gap-4">
                <span className="text-2xl shrink-0">{p.icon}</span>
                <div>
                  <h3 className="font-semibold mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-2">Шийдэл</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Хотол юу хийдэг вэ?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              СӨХ ба оршин суугчийг холбож, мэдээлэл, төлбөр, хүсэлтийг нэг газар цэгцэлнэ.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {solutions.map(s => (
              <div key={s.title} className="bg-white rounded-2xl p-5 border border-gray-100">
                <span className="text-2xl block mb-2">{s.icon}</span>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mockup strip — UI preview */}
      <section className="py-16 md:py-20 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-2">Дэлгэцийн харагдац</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Аппын дотор ийм харагдана</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Оршин суугч төлбөр, мэдэгдэл, хүсэлтээ нэг газраас удирдана. Доорх жишээ дэлгэцүүд.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Mockup 1: Payment */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-4 border border-blue-100">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-3">
                  <p className="text-xs opacity-80">Төлбөр</p>
                  <p className="font-semibold text-sm">2026/05 сар</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Үлдэгдэл</span>
                    <span className="font-bold text-blue-700">84,500₮</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Цэвэр ус</span>
                    <span>32,000₮</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Дулаан</span>
                    <span>52,500₮</span>
                  </div>
                  <button className="w-full mt-2 bg-blue-600 text-white text-xs py-2 rounded-lg">QPay-ээр төлөх</button>
                </div>
              </div>
            </div>

            {/* Mockup 2: Announcement */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-4 border border-amber-100">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-amber-500 text-white px-4 py-3">
                  <p className="text-xs opacity-90">Мэдэгдэл</p>
                  <p className="font-semibold text-sm">Шинэ зар (2)</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="border-l-2 border-red-400 pl-2">
                    <p className="text-xs font-semibold">🚨 Усны засвар</p>
                    <p className="text-[11px] text-gray-500">Маргааш 10:00–14:00 ус хаагдана</p>
                  </div>
                  <div className="border-l-2 border-blue-400 pl-2">
                    <p className="text-xs font-semibold">📅 Хурал</p>
                    <p className="text-[11px] text-gray-500">5/22 19:00 — 1-р давхарт</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-2">
                    <p className="text-xs font-semibold">ℹ️ Зогсоолын дүрэм</p>
                    <p className="text-[11px] text-gray-500">Машинтай айлуудад</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup 3: Maintenance request */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-4 border border-green-100">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-emerald-600 text-white px-4 py-3">
                  <p className="text-xs opacity-90">Засварын хүсэлт</p>
                  <p className="font-semibold text-sm">Миний хүсэлт</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Лифт засвар</p>
                      <p className="text-[11px] text-gray-500">Хүлээгдэж буй · 2 өдөр</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Орцны гэрэл</p>
                      <p className="text-[11px] text-gray-500">Хийгдэж байна</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">Хогийн савны цэвэрлэгээ</p>
                      <p className="text-[11px] text-gray-500">Шийдэгдсэн</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup 4: SOH dashboard */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-4 border border-purple-100">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-purple-600 text-white px-4 py-3">
                  <p className="text-xs opacity-90">СӨХ хяналт</p>
                  <p className="font-semibold text-sm">Нарантуул СӨХ</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div>
                    <p className="text-[11px] text-gray-500">Цуглуулалт</p>
                    <p className="text-lg font-bold text-purple-700">72%</p>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full w-[72%] bg-purple-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg py-1.5">
                      <p className="text-[10px] text-gray-500">Айл</p>
                      <p className="text-xs font-bold">124</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg py-1.5">
                      <p className="text-[10px] text-gray-500">Хүсэлт</p>
                      <p className="text-xs font-bold">8</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup 5: Parking */}
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 rounded-3xl p-4 border border-indigo-100">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-indigo-600 text-white px-4 py-3">
                  <p className="text-xs opacity-90">Зогсоол</p>
                  <p className="font-semibold text-sm">Миний машинууд</p>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-2">
                    <span className="text-xl">🚗</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-blue-700">0123 УБА</p>
                      <p className="text-[10px] text-gray-500">Toyota Prius · Цагаан</p>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">QR</span>
                  </div>
                  <button className="w-full bg-green-600 text-white text-xs font-semibold py-2 rounded-lg">
                    🚧 Хаалт нээх хүсэлт
                  </button>
                  <div className="grid grid-cols-5 gap-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                      <div key={i} className={`text-[8px] text-center rounded py-0.5 ${i % 3 === 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        P{i}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link
              href="/demo-admin"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
            >
              🎬 Demo бүтнээр харах →
            </Link>
          </div>
        </div>
      </section>

      {/* For residents */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-2">Оршин суугчдад</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Өөрийн СӨХ-ийн мэдээллийг гартаа</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Та төлбөрөө хаанаас харах, мэдэгдэл хэн нийтэлсэн, гомдол хэн авсныг тодорхой мэдэх эрхтэй.
              Хотол үүнийг нэг газар, бичгээр, төлөвтэйгөөр харуулна.
            </p>
            <ul className="space-y-2 mb-6">
              {residentBenefits.map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => router.push('/find-hoa')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
            >
              СӨХ-өө хайх →
            </button>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-100">
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-3">
              <p className="text-xs text-gray-400 mb-1">Шинэ мэдэгдэл</p>
              <p className="text-sm font-medium">Маргааш 10:00–14:00 ус хаагдана</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-3">
              <p className="text-xs text-gray-400 mb-1">Үлдэгдэл</p>
              <p className="text-sm font-medium">2025/04 — 84,500₮</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Миний хүсэлт</p>
              <p className="text-sm font-medium">Лифт засвар — Хүлээгдэж буй</p>
            </div>
          </div>
        </div>
      </section>

      {/* For SOH / admins */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-100">
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-3">
              <p className="text-xs text-gray-400 mb-1">СӨХ-ийн нийт оршин суугч</p>
              <p className="text-2xl font-bold">— айл</p>
              <p className="text-xs text-gray-400 mt-1">Бодит тоо нь СӨХ дээр харагдана</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-3">
              <p className="text-xs text-gray-400 mb-1">Шинэ хүсэлт</p>
              <p className="text-sm font-medium">Лифт · Хог · Орц</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Demand</p>
              <p className="text-sm font-medium">Хотол ашиглахыг хүссэн оршин суугчид</p>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-semibold text-amber-700 tracking-wide uppercase mb-2">СӨХ / Админд</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Өдөр тутмын ажлыг цэгцэлнэ</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Excel, цаас, чатын бүлгэм оронд оршин суугчдын бүртгэл, мэдэгдэл, хүсэлт, төлбөр —
              бүгд нэг систем дотор. Demand dashboard-аар хэдэн оршин суугч сонирхож байгааг шууд хараарай.
            </p>
            <ul className="space-y-2 mb-6">
              {adminBenefits.map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-amber-500 mt-0.5">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition"
            >
              СӨХ админ бол холбогдох →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust / compliance */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">Итгэлцэл</p>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ил тод нөхцөл, хамгаалагдсан мэдээлэл</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Хотол нь оршин суугч болон СӨХ-ийн нөхцөл, нууцлалын бодлогыг ил тод нийтэлдэг.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/privacy"
              className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-2xl p-5 text-center"
            >
              <span className="text-2xl block mb-2">🔒</span>
              <p className="font-semibold text-sm">Нууцлалын бодлого</p>
            </Link>
            <Link
              href="/terms/resident"
              className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-2xl p-5 text-center"
            >
              <span className="text-2xl block mb-2">📄</span>
              <p className="font-semibold text-sm">Оршин суугчийн нөхцөл</p>
            </Link>
            <Link
              href="/terms/admin"
              className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-2xl p-5 text-center"
            >
              <span className="text-2xl block mb-2">📋</span>
              <p className="font-semibold text-sm">Админ нөхцөл</p>
            </Link>
            <Link
              href="/help"
              className="bg-gray-50 hover:bg-gray-100 transition border border-gray-200 rounded-2xl p-5 text-center"
            >
              <span className="text-2xl block mb-2">❓</span>
              <p className="font-semibold text-sm">Тусламж / FAQ</p>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Түгээмэл асуулт</h2>
            <p className="text-gray-500">Дэлгэрэнгүй хариултыг тусламж хэсгээс үзнэ үү.</p>
          </div>
          <div className="space-y-3">
            {faqs.map(f => (
              <details key={f.q} className="group bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900 list-none flex items-center justify-between">
                  <span>{f.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/help" className="text-sm text-blue-600 font-semibold hover:underline">
              Бүх асуулт, заавартай танилцах →
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Одоо СӨХ-өө хайж үзээрэй</h2>
          <p className="text-blue-100 mb-8">
            Хот, дүүрэг, хороогоо сонгоод СӨХ-ийнхээ нэрээр хайна. Жагсаалтад байхгүй бол өөрөө бүртгүүлж болно.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/find-hoa')}
              className="px-8 py-3.5 bg-white text-blue-700 rounded-xl font-bold text-sm shadow-lg"
            >
              Одоо СӨХ-өө хайж үзэх →
            </button>
            <Link
              href="/contact"
              className="px-8 py-3.5 border border-white/30 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition"
            >
              Холбоо барих
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
