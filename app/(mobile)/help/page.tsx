import Link from 'next/link';
import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';

export const metadata = {
  title: 'Тусламж — Хотол',
};

// TODO: Жинхэнэ FAQ агуулгыг (бэлтгэсэн Монгол хэл дээрх текстээ) паст хийнэ үү.
export default function HelpPage() {
  return (
    <LegalPage
      title="Тусламж · FAQ · Ашиглах заавар"
      subtitle="Хамгийн их асуугддаг асуултууд"
      accent="slate"
    >
      <p className="text-gray-700">
        Хотол платформ ашиглахтай холбоотой түгээмэл асуултын хариултыг доор оруулсан байна.
        Хариулт олдохгүй бол доорх холбоо барих хаягаар бичээрэй.
      </p>

      <LegalSection title="🚀 Эхлэх">
        <FaqItem q="Хотол гэж юу вэ?">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Яаж бүртгүүлэх вэ?">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Миний СӨХ жагсаалтад байхгүй байна. Юу хийх вэ?">
          Та <Link href="/find-hoa" className="text-blue-600 underline">СӨХ хайх</Link> хуудсаар
          орж нэрээ бичээд олдохгүй бол гараар оруулах боломжтой. Эсвэл СӨХ-ийн дарга/нярав бол{' '}
          <Link href="/sokh-leadership-contact" className="text-blue-600 underline">бидэнтэй холбогдох</Link>{' '}
          форм бөглөнө үү.
        </FaqItem>
      </LegalSection>

      <LegalSection title="💰 Төлбөр">
        <FaqItem q="Төлбөрөө хэрхэн хийх вэ?">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="QPay ажиллахгүй байна">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Төлбөр харагдахгүй байна">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
      </LegalSection>

      <LegalSection title="🔑 Эрх / Нэвтрэлт">
        <FaqItem q="Нууц үгээ мартсан">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Утас солигдсон бол яах вэ?">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="СӨХ-н админ эрх яаж авах вэ?">
          СӨХ-ийн дарга/нярав <Link href="/sokh-leadership-contact" className="text-blue-600 underline">холбогдох</Link>{' '}
          форм бөглөж, гэрээ байгуулсны дараа идэвхжүүлэх кодоор <Link href="/activate" className="text-blue-600 underline">/activate</Link>{' '}
          хуудсаар орж эрх үүсгэнэ.
        </FaqItem>
      </LegalSection>

      <LegalSection title="📢 Зарлал, мэдээлэл">
        <FaqItem q="Зарлал ирэхгүй байна">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Push notification идэвхжүүлэх">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
      </LegalSection>

      <LegalSection title="🛠 Засвар, гомдол">
        <FaqItem q="Засварын хүсэлт гаргах">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
        <FaqItem q="Гомдол гаргах">
          [Таны бэлдсэн агуулгыг энд оруулна уу]
        </FaqItem>
      </LegalSection>

      <LegalSection title="📞 Холбоо барих">
        <p>Хариулт олдохгүй бол доорх хаягаар бидэнтэй холбогдоно уу:</p>
        <p>Утас: [утас]</p>
        <p>И-мэйл: [и-мэйл]</p>
        <p>Цаг: [Даваа–Баасан, 09:00–18:00]</p>
      </LegalSection>

      <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs text-gray-500">
        <Link href="/terms/resident" className="text-blue-600 hover:underline">Оршин суугчийн нөхцөл</Link>
        <Link href="/terms/admin" className="text-blue-600 hover:underline">Админ нөхцөл</Link>
        <Link href="/privacy" className="text-blue-600 hover:underline">Нууцлалын бодлого</Link>
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
      <div className="px-3 pb-3 pt-0 text-sm text-gray-600 leading-relaxed">
        {children}
      </div>
    </details>
  );
}
