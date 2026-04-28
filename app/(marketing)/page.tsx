'use client';

import { useRouter } from 'next/navigation';

const features = [
  { icon: '💰', title: 'Төлбөрийн удирдлага', desc: 'Онлайн төлбөр, өрийн бүртгэл, автомат мэдэгдэл. Өр цуглуулалтыг 40%-иар нэмэгдүүлнэ.' },
  { icon: '📢', title: 'Зарлал мэдэгдэл', desc: 'Усны засвар, хурал, чухал мэдээллийг бүх оршин суугчдад шууд хүргэнэ.' },
  { icon: '🔧', title: 'Засвар үйлчилгээ', desc: 'Оршин суугчид хүсэлт гаргаж, засварын явцыг бодит цаг дээр хянана.' },
  { icon: '📋', title: 'Санхүүгийн тайлан', desc: 'Орлого зарлагын тайлан автомат үүснэ. Ил тод, найдвартай.' },
  { icon: '🗳', title: 'Санал хураалт', desc: 'Хурал хийхгүйгээр оршин суугчдын саналыг цахимаар авна.' },
  { icon: '👥', title: 'Оршин суугчдын бүртгэл', desc: 'Excel, CSV файлаас автомат импорт. Бүрэн мэдээллийн сан.' },
];

const steps = [
  { num: '01', title: 'Бүртгүүлэх', desc: 'СӨХ-ийн удирдлага системд бүртгүүлнэ. 2 минут болно.' },
  { num: '02', title: 'Өгөгдөл оруулах', desc: 'Оршин суугчдын жагсаалтыг Excel файлаар импортлоно.' },
  { num: '03', title: 'Ашиглаж эхлэх', desc: 'Оршин суугчид апп-руу нэвтэрч төлбөр төлж, мэдээлэл авна.' },
];

const pricing = [
  {
    name: 'Эхлэх',
    price: '1,000',
    period: ' /айл/сар',
    desc: '50–150 айлтай жижиг СӨХ-д. 3 сар үнэгүй.',
    features: ['QPay онлайн төлбөр', 'Зарлал/мэдэгдэл', 'Засварын хүсэлт', 'Оршин суугчдын бүртгэл'],
    missing: ['Push мэдэгдэл', 'Санхүүгийн тайлан', 'Аналитик', 'Тусгай дэмжлэг'],
    cta: 'Үнэгүй эхлэх',
    popular: false,
  },
  {
    name: 'Стандарт',
    price: '800',
    period: ' /айл/сар + 50,000₮ суурь',
    desc: '150–300 айлтай дундаж СӨХ-д. QPay комисс 0.7%.',
    features: ['Бүх үндсэн функц', 'Push мэдэгдэл', 'Санхүүгийн тайлан', 'Excel/CSV импорт', 'Санал хураалт', 'Имэйл дэмжлэг'],
    missing: ['Нарийвчилсан аналитик', '24/7 тусгай дэмжлэг'],
    cta: 'Эхлэх',
    popular: true,
  },
  {
    name: 'Дэвшилтэт',
    price: '500',
    period: ' /айл/сар + 150,000₮ суурь',
    desc: '300+ айлтай том СӨХ, хороололд. QPay комисс 0.5%.',
    features: ['Бүх функц', 'Нарийвчилсан аналитик', '24/7 тусгай дэмжлэг', 'Custom branding', 'Хязгааргүй айл', 'Онцгой тохиргоо'],
    missing: [],
    cta: 'Холбогдох',
    popular: false,
  },
];

const testimonials = [
  { name: 'Б. Батболд', role: 'Нарантуул СӨХ-ийн дарга', text: 'Өр цуглуулалт маш хүнд байсан. Одоо системээр дамжуулан оршин суугчид өрөө цаг тухайд нь төлдөг боллоо.' },
  { name: 'Д. Сараа', role: 'Оршин суугч, Баянгол дүүрэг', text: 'Апп дээрээс СӨХ-ийн зарлал, төлбөрийн мэдээллээ шалгаж байгаа нь маш тохиромжтой.' },
  { name: 'Г. Ганбаатар', role: 'Алтан гадас СӨХ', text: 'Тайлан автомат гардаг болсон. Өмнө нь Excel дээр гараар хийдэг байсан. Маш их цаг хэмнэнэ.' },
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

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center text-white">
          <div className="inline-block bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6 border border-white/20">
            Таны байрны бүх зүйл нэг дор
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4 max-w-3xl mx-auto">
            Байрны бүх төлбөр,<br />мэдээлэл <span className="text-yellow-300">нэг дор</span>
          </h1>
          <p className="text-blue-200 text-base md:text-lg max-w-xl mx-auto mb-8">
            Төлбөр цуглуулах, тайлан гаргах, оршин суугчидтай харилцах — бүгдийг нэг системээр.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/demo')}
              className="px-8 py-3.5 bg-white text-blue-700 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
            >
              Demo үзэх →
            </button>
            <button
              onClick={() => router.push('/register')}
              className="px-8 py-3.5 bg-white/10 backdrop-blur border border-white/25 text-white rounded-xl font-semibold text-sm hover:bg-white/20 transition"
            >
              Үнэгүй эхлэх
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-8 flex justify-center gap-12 md:gap-20">
          {[
            { val: '500+', label: 'Айл өрх' },
            { val: '50+', label: 'СӨХ' },
            { val: '3', label: 'Хот' },
            { val: '99%', label: 'Хэрэглэгчийн сэтгэл ханамж' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-gray-900">{s.val}</p>
              <p className="text-xs md:text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Бүх боломж нэг дор</h2>
            <p className="text-gray-500 max-w-lg mx-auto">СӨХ-ийн өдөр тутмын үйл ажиллагааг автоматжуулж, цаг хүч хэмнэнэ</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <span className="text-3xl block mb-3">{f.icon}</span>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Хэрхэн ажилладаг вэ?</h2>
            <p className="text-gray-500">3 энгийн алхамаар эхлэх</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < 2 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-blue-100" />}
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10">
                  <span className="text-blue-600 font-bold text-lg">{s.num}</span>
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Энгийн, ил тод үнэ</h2>
            <p className="text-gray-500">СӨХ-ийн хэмжээнд тохирсон 3 багц</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {pricing.map(p => (
              <div key={p.name} className={`rounded-2xl p-6 ${p.popular ? 'bg-blue-600 text-white ring-4 ring-blue-200 scale-105' : 'bg-white border border-gray-200'}`}>
                {p.popular && <div className="text-xs bg-yellow-400 text-yellow-900 font-bold rounded-full px-3 py-1 inline-block mb-3">Хамгийн их сонголт</div>}
                <h3 className={`text-lg font-bold ${p.popular ? '' : 'text-gray-900'}`}>{p.name}</h3>
                <p className={`text-sm mt-1 ${p.popular ? 'text-blue-200' : 'text-gray-500'}`}>{p.desc}</p>
                <div className="my-4">
                  <span className="text-3xl font-bold">{p.price}₮</span>
                  <span className={`text-sm ${p.popular ? 'text-blue-200' : 'text-gray-400'}`}>{p.period}</span>
                </div>
                <button
                  onClick={() => {
                    if (p.cta === 'Холбогдох') window.location.href = 'tel:+97677001122';
                    else router.push('/register');
                  }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm mb-4 transition ${
                    p.popular ? 'bg-white text-blue-600 hover:bg-gray-100' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {p.cta}
                </button>
                <ul className="space-y-2">
                  {p.features.map(f => (
                    <li key={f} className={`text-sm flex items-center gap-2 ${p.popular ? 'text-blue-100' : 'text-gray-600'}`}>
                      <span className="text-green-400">✓</span> {f}
                    </li>
                  ))}
                  {p.missing.map(f => (
                    <li key={f} className={`text-sm flex items-center gap-2 ${p.popular ? 'text-blue-300/50' : 'text-gray-300'}`}>
                      <span>✕</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Хэрэглэгчдийн сэтгэгдэл</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.name} className="bg-gray-50 rounded-2xl p-6 border">
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Таны байранд шинэ түвшний удирдлага</h2>
          <p className="text-blue-200 mb-8">Өнөөдөр бүртгүүлж, 3 сар үнэгүй ашиглаарай. Банкны карт шаардахгүй.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push('/register')} className="px-8 py-3.5 bg-white text-blue-700 rounded-xl font-bold text-sm shadow-lg">
              Үнэгүй эхлэх →
            </button>
            <button onClick={() => router.push('/demo')} className="px-8 py-3.5 border border-white/30 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition">
              Demo үзэх
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
