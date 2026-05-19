import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Холбоо барих — Хотол',
  description: 'Хотолтой холбогдох утас, и-мэйл, хаяг. СӨХ админ, оршин суугч, апп дэлгүүрийн шалгагчдад зориулсан холбоо барих хуудас.',
};

const SUPPORT_EMAIL = 'tugsorchin@yahoo.com';
const ADMIN_EMAIL = 'tugsorchin@yahoo.com';
const PHONE = '9401-9927';
const FACEBOOK = 'https://www.facebook.com/[хуудас]';
const ADDRESS = 'Улаанбаатар хот';
const COMPANY = 'Хотол / Төгс Орчин ХХК';

export default function ContactPage() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Холбоо барих</h1>
          <p className="text-blue-100 max-w-xl mx-auto">
            СӨХ-ийн админ, оршин суугч, апп дэлгүүрийн шалгагчид доорх сувгаар бидэнтэй холбогдоно уу.
          </p>
        </div>
      </section>

      {/* Main */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Company card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
            <h2 className="text-lg font-bold mb-4">{COMPANY}</h2>
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-1">Утас</dt>
                <dd>
                  <a href={`tel:+976${PHONE.replace(/-/g, '')}`} className="text-blue-600 hover:underline font-medium">
                    {PHONE}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-1">И-мэйл</dt>
                <dd>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline font-medium">
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-1">Facebook</dt>
                <dd>
                  <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                    Хотол · Facebook хуудас
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-1">Хаяг</dt>
                <dd className="font-medium text-gray-700">{ADDRESS}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-400 mt-4">
              * Утас, и-мэйл, хаягийн зарим талбар одоогоор түр загвар бөгөөд албан ёсны мэдээллээр шинэчлэгдэх болно.
            </p>
          </div>

          {/* For SOH admins */}
          <div className="bg-white rounded-2xl border border-amber-200 p-6 md:p-8">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">СӨХ / Админ</p>
            <h2 className="text-lg font-bold mb-3">СӨХ админ холбогдох</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Та СӨХ-ийнхөө удирдлага, нягтлан, эсвэл хариуцсан ажилтан бол СӨХ-ийн өгөгдлөө цэгцлэх,
              оршин суугчдын бүртгэл оруулах, Хотолыг СӨХ-д нэвтрүүлэх талаар бидэнтэй холбогдоорой.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`mailto:${ADMIN_EMAIL}?subject=СӨХ%20админ%20-%20Хотол%20нэвтрүүлэх%20хүсэлт`}
                className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 transition"
              >
                {ADMIN_EMAIL} рүү бичих
              </a>
              <a
                href={`tel:+976${PHONE.replace(/-/g, '')}`}
                className="px-5 py-2.5 border border-amber-300 text-amber-700 rounded-lg font-semibold text-sm hover:bg-amber-50 transition"
              >
                {PHONE} рүү залгах
              </a>
            </div>
          </div>

          {/* For residents */}
          <div className="bg-white rounded-2xl border border-blue-200 p-6 md:p-8">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Оршин суугч</p>
            <h2 className="text-lg font-bold mb-3">Оршин суугчийн тусламж</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Бүртгэл, нэвтрэх, СӨХ-ийн жагсаалт, төлбөр, мэдэгдэлтэй холбоотой асуудлыг
              тусламж хэсгээс хайж олж эсвэл доорх сувгаар бидэнд мэдэгдээрэй.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/help"
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition"
              >
                Тусламж · FAQ
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Хотол%20-%20Оршин%20суугчийн%20тусламж`}
                className="px-5 py-2.5 border border-blue-300 text-blue-700 rounded-lg font-semibold text-sm hover:bg-blue-50 transition"
              >
                {SUPPORT_EMAIL} рүү бичих
              </a>
            </div>
          </div>

          {/* Account-related */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Бүртгэл</p>
            <h2 className="text-lg font-bold mb-3">Бүртгэл, мэдээллийн хүсэлт</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Та өөрийн бүртгэлээ устгуулах, мэдээллээ татах эсвэл засуулах хүсэлтэй бол доорх хуудаснаас үргэлжлүүлнэ үү.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/account/delete"
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition"
              >
                Бүртгэл устгах хүсэлт →
              </Link>
              <Link
                href="/privacy"
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition"
              >
                Нууцлалын бодлого
              </Link>
            </div>
          </div>

          {/* Compliance note */}
          <div className="text-center text-xs text-gray-500 pt-4">
            <p>
              Энэхүү хуудас нь Google Play / App Store-ын шаардлагын дагуу нийтийн дэмжлэгийн (support) сувгийг хангах
              зорилгоор үүсгэгдсэн. Албан ёсны дэлгүүрийн шалгагч нар <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 underline">{SUPPORT_EMAIL}</a> хаягаар холбогдоно уу.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
