import Link from 'next/link';

// СӨХ-ийн даргад илгээх «Khotol SMS Bridge» суулгах заавар — khotol.com/sms-app
// (mobile) бүлгээс гадна: PWA «Хотол суулгах» санал «Апп татах»-тай андуурагдахгүйн тулд.
// Банкны гүйлгээний SMS-ийг Хотол руу дамжуулах хувийн Android апп (Play Store-д байхгүй).
// APK: public/downloads/ — шинэ хувилбар гаргахад APK, APK_SHA256, APK_VERSION-ийг шинэчилнэ.
const APK_VERSION = '1.0.0';
const APK_URL = `/downloads/khotol-sms-bridge-${APK_VERSION}.apk`;
const APK_SIZE = '3 MB';
const APK_SHA256 = 'cf82b615ae0e5235304678d2e38ef6c6ad8928186fd539047aecf806bbf83473';

export const metadata = {
  title: 'Банкны SMS дамжуулагч суулгах заавар — Хотол',
  description: 'СӨХ-ийн дансны банкны гүйлгээний SMS-ийг Хотол руу автоматаар дамжуулах апп суулгах заавар.',
  robots: { index: false, follow: false },
};

const STEPS: { t: string; d: React.ReactNode }[] = [
  {
    t: 'Аппыг татаж суулгана',
    d: (
      <>
        Банкны SMS ирдэг утсаараа энэ хуудсыг нээж, доорх <b>«Апп татах»</b> товчийг дарна. Татаж дуусаад
        файлыг нээнэ. «Энэ эх сурвалжаас суулгахыг зөвшөөрөх үү?» гэвэл <b>Тохиргоо → Зөвшөөрөх</b>, дараа нь
        <b> Суулгах</b>. Google Play Protect анхааруулбал <b>«Ямартай ч суулгах»</b> (Install anyway) дарна —
        Хотолын хувийн апп тул Play Store-д байхгүй.
      </>
    ),
  },
  {
    t: 'Нууцлалын мэдэгдлийг зөвшөөрнө',
    d: (
      <>
        <b>Khotol SMS Bridge</b> аппыг нээж, мэдэгдлийг уншаад доорх чагтыг тэмдэглэнэ. Серверийн хаяг
        (https://www.khotol.com), илгээгч (131888) аль хэдийн бөглөгдсөн байгаа — өөрчлөх шаардлагагүй.
      </>
    ),
  },
  {
    t: 'Хотолоос токен авна',
    d: (
      <>
        Утасныхаа хөтчөөр <b>khotol.com/admin</b> руу даргын эрхээр нэвтэрнэ → цэс (☰) →{' '}
        <b>«Банкны SMS гүйлгээ»</b> → <b>«Дамжуулагч утас»</b>. Нэр (жишээ: «Даргын Samsung»), илгээгч{' '}
        <b>131888</b>, дансны маск (банкны SMS дээрх <i>5006***029</i> гэх мэт хэсэг; мэдэхгүй бол хоосон
        орхиж болно) бөглөөд{' '}
        <b>«Төхөөрөмж бүртгэж токен авах»</b> дарна. Шар хайрцагт гарсан токеныг <b>«Хуулах»</b>.
      </>
    ),
  },
  {
    t: 'Токеноо апп-д оруулна',
    d: (
      <>
        Апп руу буцаж «Төхөөрөмжийн токен» талбарт удаан дарж <b>Буулгах</b> (Paste) → <b>«Хадгалах»</b>.
        Токен зөвхөн нэг удаа харагдана — алдвал админ дээр «Токен шинэчлэх» дарна.
      </>
    ),
  },
  {
    t: 'SMS хүлээн авах зөвшөөрөл өгнө',
    d: (
      <>
        <b>«SMS хүлээн авах зөвшөөрөл өгөх»</b> → <b>Зөвшөөрөх</b>. Зөвшөөрөл саарал, идэвхгүй байвал: утасны{' '}
        <b>Тохиргоо → Апп → Khotol SMS Bridge → баруун дээд ⋮ → «Хязгаарлагдсан тохиргоог зөвшөөрөх»</b>{' '}
        (Allow restricted settings), дараа нь дахин оролдоно.
      </>
    ),
  },
  {
    t: 'Батарейн хязгаарлалтаас чөлөөлнө',
    d: (
      <>
        <b>«Батарейн хязгаарлалтаас чөлөөлөх»</b> → Khotol SMS Bridge → <b>«Хязгаарлахгүй»</b>. Samsung дээр мөн:{' '}
        <b>Тохиргоо → Батарей → Арын дэвсгэрийн хэрэглээний хязгаар → «Хэзээ ч унтуулахгүй апп»</b>-д нэмнэ. Эс
        бөгөөс утас хэдэн цагийн дараа аппыг унтуулж, SMS дамжуулахаа болино.
      </>
    ),
  },
  {
    t: 'Холболтоо шалгана',
    d: (
      <>
        <b>«Холболт шалгах»</b> → «✓ Холбогдлоо» гарна. Дээд хэсэгт <b>«● Ажиллаж байна»</b> гэж харагдвал
        бэлэн. Админ дээр утас <b>«● Холбогдсон»</b> болно.
      </>
    ),
  },
  {
    t: 'Туршилтын гүйлгээ хийнэ',
    d: (
      <>
        СӨХ-ийн данс руу бага дүн (жишээ 100₮) шилжүүлж, гүйлгээний утгад тоотоо бичнэ. 1–2 минутын дотор
        админы «Банкны SMS гүйлгээ» хэсэгт гарч ирэх ёстой. Гарч ирсэн эсэхийг Хотолд мэдэгдэнэ үү.
      </>
    ),
  },
];

export default function SmsAppPage() {
  return (
    <div className="flex justify-center bg-gray-200 min-h-screen">
      <div className="w-full max-w-[430px] min-h-screen bg-gray-50 shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white px-5 pt-7 pb-8">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-8 h-8 rounded-lg bg-white/20 grid place-items-center font-extrabold">Х</span>
            <span className="font-extrabold text-lg">Хотол</span>
          </div>
          <h1 className="text-[26px] leading-tight font-extrabold mb-2.5">Банкны SMS дамжуулагч суулгах</h1>
          <p className="text-emerald-50 text-sm leading-relaxed">
            СӨХ-ийн данс руу орсон төлбөрийн SMS-ийг Хотол руу автоматаар дамжуулж, хэн, аль тоот төлснийг танд
            харуулна. Гараар хуулга тулгах шаардлагагүй болно.
          </p>
        </div>
  
        <div className="px-5 py-6 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
            <p className="font-bold text-gray-800 mb-1">Эхлэхээс өмнө</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                СӨХ-ийн дансны <b>ХасБанкны SMS мэдэгдэл ирдэг Android утас</b> (Samsung г.м.) хэрэгтэй. iPhone дээр
                ажиллахгүй.
              </li>
              <li>Утас байнга асаалттай, интернэттэй (Wi-Fi эсвэл дата) байх ёстой.</li>
              <li>Даргын эрхээр khotol.com/admin руу нэвтрэх боломжтой байх.</li>
              <li>15 орчим минут зарцуулна.</li>
            </ul>
          </div>
  
          <a
            href={APK_URL}
            download
            className="block w-full bg-emerald-600 text-white text-center py-4 rounded-2xl font-bold text-base shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition"
          >
            Апп татах (Android, {APK_SIZE})
          </a>
          <p className="-mt-4 text-center text-xs text-gray-400">Khotol SMS Bridge · хувилбар {APK_VERSION}</p>
  
          <ol className="space-y-5">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-3.5">
                <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-sm grid place-items-center">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="font-bold text-[15px] text-gray-800">{s.t}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-0.5">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
  
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-gray-700 leading-relaxed">
            <p className="text-sm font-bold text-blue-700 mb-1.5">Эхний 1–2 долоо хоног</p>
            Төлбөр айлын өрөөс <b>автоматаар хасагдахгүй</b>. Гүйлгээ бүр «Банкны SMS гүйлгээ» хэсэгт «Шалгах»
            төлөвтэй гарна — тоот зөв танигдсан эсэхийг харж <b>«Баталгаажуулах»</b> дарна. Зөв ажиллаж байгаа нь
            батлагдсаны дараа автомат бүртгэлийг асаана.
          </div>
  
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900/90 leading-relaxed">
            <p className="font-bold text-amber-800 mb-1">Аюулгүй байдал</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Зөвхөн <b>131888</b>-аас ирсэн, дүнтэй гүйлгээний SMS дамжуулагдана. Хувийн мессеж, нууц код (OTP)
                утаснаас гарахгүй.
              </li>
              <li>Апп банкны нууц үг, PIN, нууц код хэзээ ч асуухгүй. Асуувал бүү оруул.</li>
              <li>Токеноо хэнд ч бүү илгээ. Утсаа солих, алдах бол админ дээр «Цуцлах» дарна.</li>
              <li>Аппыг зөвхөн энэ хуудаснаас (khotol.com/sms-app) татна.</li>
            </ul>
          </div>
  
          <details className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700">
            <summary className="font-bold text-gray-800 cursor-pointer">Асуудал гарвал</summary>
            <ul className="list-disc pl-5 space-y-2 mt-3 leading-relaxed">
              <li>
                <b>«ТОХИРГОО ДУТУУ»</b> — нууцлалын чагт, токен, SMS зөвшөөрлийн аль нэг нь дутуу.
              </li>
              <li>
                <b>«Сервер токеныг хүлээж авсангүй»</b> — админ дээр «Токен шинэчлэх» дарж шинэ токеноо оруулна.
              </li>
              <li>
                <b>SMS ирсэн ч админ дээр гарахгүй</b> — апп дээрх «Сүүлд шүүгдсэн илгээгч» мөрийг зураг дарж
                (screenshot) Хотолд илгээнэ үү.
              </li>
              <li>
                <b>«Дараалалд хүлээгдэж буй» тоо өсөөд байна</b> — интернэтээ шалгаад «Хүлээгдэж буйг одоо илгээх»
                дарна. Интернэт тасарсан үеийн SMS алдагдахгүй, холбогдмогц илгээгдэнэ.
              </li>
            </ul>
          </details>
  
          <p className="text-[11px] text-gray-400 break-all leading-relaxed">
            Файлын хяналтын код (SHA-256): {APK_SHA256}
          </p>
  
          <p className="text-center text-xs text-gray-400 pb-2">
            <Link href="/privacy" className="hover:text-gray-600">
              Нууцлалын бодлого
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
