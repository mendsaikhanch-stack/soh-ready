import Link from 'next/link';
import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';
import MetaBlock from '@/app/components/legal/MetaBlock';

export const metadata = {
  title: 'Бүртгэл устгах хүсэлт — Хотол',
  description:
    'Хотол дахь өөрийн бүртгэлээ устгуулах хүсэлт илгээх заавар, холбоо барих суваг, боловсруулах хугацаа.',
};

const SUPPORT_EMAIL = 'info@hotol.mn';
const PHONE = '7700-1122';

export default function AccountDeletePage() {
  const mailto =
    `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent('Хотол — Бүртгэл устгах хүсэлт')}` +
    `&body=${encodeURIComponent(
      [
        'Сайн байна уу.',
        '',
        'Би Хотол дахь өөрийн бүртгэлээ устгуулах хүсэлт гаргаж байна.',
        '',
        '— Бүртгэлтэй утасны дугаар: ',
        '— И-мэйл (хэрэв ашигладаг бол): ',
        '— Хэрэглэгчийн төрөл (оршин суугч / СӨХ админ): ',
        '— Хүсэлтийн шалтгаан (заавал биш): ',
        '',
        'Баярлалаа.',
      ].join('\n'),
    )}`;

  return (
    <LegalPage
      title="БҮРТГЭЛ УСТГАХ ХҮСЭЛТ"
      subtitle="Хотол дахь өөрийн бүртгэлээ устгуулах"
      accent="slate"
    >
      <MetaBlock version="1.0" updatedAt="2026-05-14" />

      <LegalSection number="1" title="Танилцуулга">
        <p>
          Хэрэв та Хотол дахь бүртгэлээ устгуулахыг хүсвэл доорх сувгаар хүсэлт илгээнэ үү. Бид таны
          хүсэлтийг шалгаж, хууль болон үйлчилгээний шаардлагын хүрээнд боловсруулна.
        </p>
        <p>
          Энэхүү хуудас нь Google Play / App Store-ын дэлгүүрийн шаардлагын дагуу хэрэглэгчийн
          бүртгэл устгуулах хүсэлт гаргах сувгийг ил тод нийтэлсэн болно.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Хэрхэн хүсэлт илгээх вэ">
        <p>Та доорхын аль нэгээр хүсэлтээ илгээнэ үү:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            И-мэйлээр:{' '}
            <a href={mailto} className="text-blue-600 underline break-all">
              {SUPPORT_EMAIL}
            </a>
          </li>
          <li>
            Утсаар:{' '}
            <a href={`tel:+976${PHONE.replace(/-/g, '')}`} className="text-blue-600 underline">
              {PHONE}
            </a>
          </li>
          <li>
            Холбоо барих хуудаснаас:{' '}
            <Link href="/contact" className="text-blue-600 underline">
              /contact
            </Link>
          </li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          Хүсэлт илгээхдээ бүртгэлтэй утас эсвэл и-мэйлээ заавал бичнэ үү. Үгүй бол баталгаажуулах
          боломжгүй.
        </p>
      </LegalSection>

      <LegalSection number="3" title="Ямар мэдээлэл устгагдах вэ">
        <p>Хүсэлт баталгаажсаны дараа бид дараах мэдээллийг устгана:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Бүртгэлийн хувийн мэдээлэл (нэр, утас, и-мэйл, нууц үгийн hash)</li>
          <li>Хэрэглэгчийн тохиргоо, профайл</li>
          <li>Push мэдэгдлийн token, төхөөрөмжийн холболт</li>
          <li>Хэрэглэгчийн илгээсэн хүсэлт, гомдол (хувь хүний мэдээллийг тогтоох хэсэг)</li>
        </ul>
      </LegalSection>

      <LegalSection number="4" title="Ямар мэдээлэл хадгалагдсаар байж болох вэ">
        <p>Дараах төрлийн мэдээллийг хууль, нягтлан бодох болон үйлчилгээний шаардлагаар тодорхой хугацаанд хадгалж болно:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>СӨХ-ийн төлбөр, нэхэмжлэл, гүйлгээний бичилт (нягтлан бодох хуулийн дагуу хадгалагдана)</li>
          <li>Систем дэх лог, аюулгүй байдлын мэдээлэл (зүй зохистой хугацаанд)</li>
          <li>СӨХ-ийн нийтлэг тайланд орсон, хувь хүнийг тогтооход ашиглагдахгүй нэгтгэсэн мэдээлэл</li>
          <li>Хуулийн байгууллагын шаардсан мэдээлэл</li>
        </ul>
        <p className="text-xs text-gray-500 mt-2">
          Дэлгэрэнгүйг{' '}
          <Link href="/privacy" className="text-blue-600 underline">
            Нууцлалын бодлого
          </Link>{' '}
          хэсгээс үзнэ үү.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Боловсруулах хугацаа">
        <p>Бид таны хүсэлтийг хүлээн авснаас хойш ердийн тохиолдолд <strong>7–30 хоногийн</strong> дотор боловсруулна.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Хүсэлт хүлээн авсныг 1–3 ажлын өдрийн дотор и-мэйл / утсаар баталгаажуулна.</li>
          <li>Шаардлагатай бол нэмэлт мэдээлэл асууж болно (бүртгэлийн өмчлөгчийг шалгах зорилгоор).</li>
          <li>Үндсэн устгалт хийгдсэний дараа та и-мэйлээр баталгаажуулалт хүлээн авна.</li>
        </ul>
      </LegalSection>

      <LegalSection number="6" title="Болзошгүй татгалзалт">
        <p>Дараах тохиолдолд хүсэлтийг буцаах эсвэл хойшлуулж болно:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Бүртгэлийн өмчлөгчийг баталгаажуулж чадахгүй байх</li>
          <li>Тухайн бүртгэл идэвхтэй хууль, санхүүгийн маргаантай холбоотой байх</li>
          <li>СӨХ-ийн админ бүртгэлийг устгахад тухайн СӨХ-ийн үйл ажиллагаа доголдох эрсдэлтэй (энэ тохиолдолд админ эрхийг өөр хүнд шилжүүлэх алхмыг урьдчилан зөвлөнө)</li>
        </ul>
      </LegalSection>

      <LegalSection number="7" title="Холбоо барих">
        <p>Хүсэлт, асуулт, баталгаажуулалттай холбоотой бүх харилцаа:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            И-мэйл:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 underline">
              {SUPPORT_EMAIL}
            </a>
          </li>
          <li>
            Утас:{' '}
            <a href={`tel:+976${PHONE.replace(/-/g, '')}`} className="text-blue-600 underline">
              {PHONE}
            </a>
          </li>
          <li>
            Холбоо барих хуудас:{' '}
            <Link href="/contact" className="text-blue-600 underline">
              /contact
            </Link>
          </li>
        </ul>
      </LegalSection>

      <div className="mt-6">
        <a
          href={mailto}
          className="block w-full text-center bg-gray-900 hover:bg-black text-white rounded-xl py-3.5 font-semibold text-sm"
        >
          И-мэйлээр устгах хүсэлт илгээх
        </a>
        <p className="text-xs text-gray-500 text-center mt-2">
          Дээрх товчлуур таны и-мэйл аппликэйшнийг урьдчилан бэлдсэн хүсэлтийн загвартай нээнэ.
        </p>
      </div>

      <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs">
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Нууцлалын бодлого
        </Link>
        <Link href="/help" className="text-blue-600 hover:underline">
          Тусламж / FAQ
        </Link>
        <Link href="/contact" className="text-blue-600 hover:underline">
          Холбоо барих
        </Link>
      </div>
    </LegalPage>
  );
}
