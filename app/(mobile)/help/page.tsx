import Link from 'next/link';
import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';
import MetaBlock from '@/app/components/legal/MetaBlock';

export const metadata = {
  title: 'Тусламж — Khotol',
};

export default function HelpPage() {
  return (
    <LegalPage
      title="KHOTOL АПП — ТУСЛАМЖ, FAQ, АШИГЛАХ ЗААВАР"
      subtitle="Хамгийн их асуугддаг асуултууд, ашиглах заавар"
      accent="slate"
    >
      <MetaBlock version="1.0" updatedAt="[он/сар/өдөр]" />

      <LegalSection number="1" title="Khotol гэж юу вэ?">
        <p>
          Khotol нь СӨХ-ийн өдөр тутмын ажлыг хялбарчилж, оршин суугч болон СӨХ-ийн хоорондын
          мэдээлэл, мэдэгдэл, төлбөр, хүсэлт, гомдлыг нэг дороос удирдах зориулалттай апп юм.
        </p>
        <p>Khotol-оор та:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>өөрийн СӨХ-өө хайж олох</li>
          <li>мэдэгдэл, зар харах</li>
          <li>төлбөр, үлдэгдэл шалгах</li>
          <li>хүсэлт, гомдол илгээх</li>
          <li>СӨХ-тэй илүү хурдан холбогдох боломжтой.</li>
        </ul>
      </LegalSection>

      <LegalSection number="2" title="Оршин суугчид зориулсан ашиглах заавар">
        <FaqItem q="2.1. Хэрхэн бүртгүүлэх вэ?">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Апп руу орно.</li>
            <li>Хот, дүүрэг, хороогоо сонгоно.</li>
            <li>СӨХ-ийн нэрээр хайна.</li>
            <li>Хэрэв СӨХ тань гарч ирвэл сонгоод бүртгэлээ үргэлжлүүлнэ.</li>
            <li>
              Хэрэв СӨХ тань жагсаалтад байхгүй бол «Гараар оруулах» сонголтоор:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>СӨХ-ийн нэр</li>
                <li>хот/дүүрэг/хороо</li>
                <li>хотхон/байр</li>
                <li>тоот</li>
                <li>утсаа</li>
              </ul>
              оруулж бүртгэлээ үргэлжлүүлж болно.
            </li>
          </ol>
        </FaqItem>

        <FaqItem q="2.2. Хэрэв миний СӨХ жагсаалтад байхгүй бол яах вэ?">
          <p>Та өөрөө СӨХ-ийн нэрээ оруулж бүртгүүлж болно. Энэ нь:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>таны бүртгэлийг хадгална,</li>
            <li>таны СӨХ дээр Khotol ашиглах хүсэлт үүсгэнэ,</li>
            <li>дараа нь албан ёсны жагсаалттай тулгагдахад таныг зөв СӨХ-тэй холбоход ашиглагдана.</li>
          </ul>
        </FaqItem>

        <FaqItem q="2.3. Би ямар мэдээлэл харах боломжтой вэ?">
          <p>Таны эрхээс хамааран:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>СӨХ-ийн зар, мэдэгдэл</li>
            <li>төлбөр, үлдэгдэл</li>
            <li>таны байр, тооттой холбоотой мэдээлэл</li>
            <li>өмнө нь илгээсэн хүсэлт, гомдлын төлөв</li>
          </ul>
          <p>зэргийг харж болно.</p>
        </FaqItem>

        <FaqItem q="2.4. Төлбөрийн мэдээлэл буруу байвал яах вэ?">
          <p>Хэрэв үлдэгдэл, төлбөрийн дүн буруу харагдаж байвал:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>апп дотор хүсэлт илгээх,</li>
            <li>СӨХ-тэй шууд холбогдох,</li>
            <li>шаардлагатай бол баримтаа хавсаргах</li>
          </ol>
          <p>замаар засварлуулах хүсэлт гаргана.</p>
        </FaqItem>

        <FaqItem q="2.5. Хэрхэн хүсэлт, гомдол илгээх вэ?">
          <ol className="list-decimal pl-5 space-y-1">
            <li>«Хүсэлт» эсвэл «Гомдол» хэсэг рүү орно.</li>
            <li>Асуудлаа товч тодорхой бичнэ.</li>
            <li>Боломжтой бол зураг хавсаргана.</li>
            <li>Илгээсний дараа төлөв нь систем дээр хадгалагдана.</li>
          </ol>
        </FaqItem>

        <FaqItem q="2.6. Мэдэгдэл авахгүй байвал яах вэ?">
          <ul className="list-disc pl-5 space-y-1">
            <li>Утасныхаа notification тохиргоог шалгана.</li>
            <li>Апп доторх мэдэгдлийн зөвшөөрлийг шалгана.</li>
            <li>Интернет холболтоо шалгана.</li>
            <li>Дахин нэвтэрч үзнэ.</li>
          </ul>
        </FaqItem>

        <FaqItem q="2.7. Нууц үгээ мартсан бол яах вэ?">
          <p>
            «Нууц үг сэргээх» эсвэл «Нэвтрэх асуудалтай байна» хэсгээр орж утас, и-мэйлээр сэргээж
            болно.
          </p>
        </FaqItem>
      </LegalSection>

      <LegalSection number="3" title="СӨХ / Админ хэрэглэгчид зориулсан ашиглах заавар">
        <FaqItem q="3.1. Анх юу хийх вэ?">
          <p>СӨХ-ийн админ анх нэвтрэхдээ:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>СӨХ-ийн үндсэн мэдээллээ шалгах</li>
            <li>блок, байр, тоотын мэдээллээ оруулах</li>
            <li>оршин суугчдын жагсаалтаа оруулах</li>
            <li>эхний зар, мэдэгдлээ туршиж нийтлэх</li>
            <li>төлбөр, үлдэгдлийн мэдээллээ оруулах</li>
            <li>хүсэлт, гомдлын урсгалаа шалгах</li>
          </ol>
        </FaqItem>

        <FaqItem q="3.2. Хуучин Excel, PDF файлаас мэдээлэл оруулж болох уу?">
          <p>Тийм. Систем нь:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>файлыг импортлох,</li>
            <li>багануудыг таних,</li>
            <li>урьдчилан шалгах,</li>
            <li>баталгаажуулсны дараа оруулах</li>
          </ul>
          <p>боломжтой байж болно. Гэхдээ эх файлын мэдээллийн үнэн зөвийг СӨХ өөрөө хариуцна.</p>
        </FaqItem>

        <FaqItem q="3.3. Оршин суугчдын бүртгэлийг яаж шинэчлэх вэ?">
          <p>Админ хэсгээс:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>шинэ айл нэмэх</li>
            <li>утас, нэр, байр, тоот шинэчлэх</li>
            <li>давхардсан мэдээлэл шалгах</li>
            <li>буруу холбоос засах</li>
          </ul>
          <p>боломжтой.</p>
        </FaqItem>

        <FaqItem q="3.4. Зар, мэдэгдлийг яаж нийтлэх вэ?">
          <ol className="list-decimal pl-5 space-y-1">
            <li>«Зар / Мэдэгдэл» хэсэгт орно</li>
            <li>Гарчиг, текстээ оруулна</li>
            <li>Хэнд харагдахыг сонгоно</li>
            <li>Нийтэлнэ</li>
          </ol>
          <p className="font-semibold mt-2">Жишээ:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>ус тасрах мэдэгдэл</li>
            <li>лифтний засвар</li>
            <li>төлбөрийн сануулга</li>
            <li>хурал, цэвэрлэгээний мэдэгдэл</li>
          </ul>
        </FaqItem>

        <FaqItem q="3.5. Хүсэлт, гомдлыг яаж удирдах вэ?">
          <p>Админ:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>шинэ хүсэлтүүдийг харах</li>
            <li>ангилах</li>
            <li>хариуцсан хүнд шилжүүлэх</li>
            <li>шийдвэрлэсэн төлөвт оруулах</li>
            <li>тайлбар нэмэх</li>
          </ul>
          <p>боломжтой.</p>
        </FaqItem>

        <FaqItem q="3.6. Demand буюу сонирхлын мэдээлэл гэж юу вэ?">
          <p>
            Хэрэв оршин суугчид СӨХ-өө олж чадахгүй, гараар оруулж бүртгүүлсэн бол тухайн СӨХ дээр
            Khotol ашиглах сонирхол, хүсэлтийн дохио бүртгэгдэнэ. Админ талаас үүнийг:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>хэдэн хүн хүсэлт өгсөн,</li>
            <li>аль дүүрэг, хороонд төвлөрсөн,</li>
            <li>аль СӨХ дээр нэвтрүүлэхэд бэлэн болсон</li>
          </ul>
          <p>гэдгээр нь харж болно.</p>
        </FaqItem>
      </LegalSection>

      <LegalSection number="4" title="Түгээмэл асуултууд">
        <FaqItem q="4.1. Khotol нь зөвхөн апп уу, эсвэл вебээр орж болдог уу?">
          <p>Khotol нь тохиргооноос хамааран веб болон мобайл хэлбэрээр ашиглагдаж болно.</p>
        </FaqItem>

        <FaqItem q="4.2. Миний СӨХ буруу холбогдсон байвал яах вэ?">
          <p>Апп дотор хүсэлт илгээх эсвэл дэмжлэгтэй холбогдож засварлуулна.</p>
        </FaqItem>

        <FaqItem q="4.3. Би өөр байр, өөр тоот руу шилжвэл яах вэ?">
          <p>Профайл эсвэл СӨХ-ийн админаар дамжуулан мэдээллээ шинэчилнэ.</p>
        </FaqItem>

        <FaqItem q="4.4. Миний оруулсан СӨХ дараа нь өөр нэртэй холбогдвол яах вэ?">
          <p>
            Систем нь албан ёсны жагсаалттай тулгаж, ойролцоо болон давхардсан СӨХ-үүдийг нэгтгэж, таны
            бүртгэлийг зөв СӨХ-тэй холбоно.
          </p>
        </FaqItem>

        <FaqItem q="4.5. Төлбөрөө апп-аар төлөх боломжтой юу?">
          <p>
            Энэ нь тухайн СӨХ дээр идэвхжүүлсэн функцээс хамаарна. Зарим СӨХ зөвхөн мэдээлэл харах,
            зарим нь төлбөрийн холболттой байж болно.
          </p>
        </FaqItem>

        <FaqItem q="4.6. Хүсэлт илгээсэн ч шийдэгдэхгүй байвал яах вэ?">
          <ul className="list-disc pl-5 space-y-1">
            <li>хүсэлтийн төлөвөө шалгана</li>
            <li>нэмэлт тайлбар оруулна</li>
            <li>СӨХ-ийн холбогдох сувгаар давхар мэдэгдэнэ</li>
          </ul>
        </FaqItem>

        <FaqItem q="4.7. Миний мэдээлэл аюулгүй юу?">
          <p>
            Khotol нь таны мэдээллийг нууцлалын бодлогын дагуу хамгаалахыг зорьдог. Дэлгэрэнгүйг{' '}
            <Link href="/privacy" className="text-blue-600 underline">
              «Нууцлалын бодлого»
            </Link>{' '}
            хэсгээс харна уу.
          </p>
        </FaqItem>

        <FaqItem q="4.8. Хэн миний мэдээллийг харах боломжтой вэ?">
          <p>
            Зөвхөн тухайн СӨХ-ийн эрх бүхий хэрэглэгчид болон системийн зөвшөөрөгдсөн техникийн түвшинд
            шаардлагатай мэдээлэл харагдана.
          </p>
        </FaqItem>

        <FaqItem q="4.9. СӨХ админ эрхийг хэн авах вэ?">
          <p>Тухайн СӨХ-ийн эрх бүхий удирдлага, ажилтан админ эрхтэй байна.</p>
        </FaqItem>

        <FaqItem q="4.10. Апп ажиллахгүй байвал яах вэ?">
          <ul className="list-disc pl-5 space-y-1">
            <li>интернетээ шалгах</li>
            <li>аппыг дахин нээх</li>
            <li>дахин нэвтрэх</li>
            <li>шинэчлэлт байгаа эсэхийг шалгах</li>
            <li>дэмжлэгтэй холбогдох</li>
          </ul>
        </FaqItem>
      </LegalSection>

      <LegalSection number="5" title="Дэмжлэг, холбоо барих">
        <p>Асуудал гарвал дараах сувгаар холбоо барина:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Утас: [________]</li>
          <li>И-мэйл: [________]</li>
          <li>Facebook хуудас: [________]</li>
          <li>Апп доторх тусламж: [________]</li>
        </ul>
      </LegalSection>

      <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs text-gray-500">
        <Link href="/terms/resident" className="text-blue-600 hover:underline">
          Оршин суугчийн нөхцөл
        </Link>
        <Link href="/terms/admin" className="text-blue-600 hover:underline">
          Админ нөхцөл
        </Link>
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Нууцлалын бодлого
        </Link>
      </div>
    </LegalPage>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="border rounded-lg group">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-gray-800 list-none flex items-center justify-between">
        <span>{q}</span>
        <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-3 pb-3 pt-0 text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </details>
  );
}
