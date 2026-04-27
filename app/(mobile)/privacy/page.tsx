import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';
import MetaBlock from '@/app/components/legal/MetaBlock';

export const metadata = {
  title: 'Нууцлалын бодлого — Хотол',
};

// TODO: Жинхэнэ агуулгыг (бэлтгэсэн Монгол хэл дээрх текстээ) паст хийнэ үү.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Нууцлалын бодлого"
      subtitle="Хувийн мэдээлэл цуглуулах, ашиглах журам"
      accent="slate"
    >
      <MetaBlock version="1.0" effectiveDate="[он/сар/өдөр]" updatedAt="[он/сар/өдөр]" />

      <p className="text-gray-700">
        Хотол нь хэрэглэгчийн хувийн мэдээллийг хадгалахдаа Монгол Улсын Хүний хувийн мэдээллийг
        хамгаалах тухай хууль болон холбогдох бусад хууль тогтоомжид нийцүүлж ажиллана.
      </p>

      <LegalSection number="1" title="Цуглуулдаг мэдээлэл">
        <p>Бид дараах мэдээллийг цуглуулдаг:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Утасны дугаар</li>
          <li>Овог нэр</li>
          <li>Орон сууц / тоот мэдээлэл</li>
          <li>СӨХ-ийн харьяалал</li>
          <li>Төлбөрийн мэдээлэл (зөвхөн төлбөр гүйцэтгэхтэй холбоотой)</li>
        </ul>
        <p className="text-gray-400 italic">[Таны бэлдсэн нэмэлт агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="2" title="Мэдээлэл цуглуулах зорилго">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="3" title="Мэдээллийн хамгаалалт">
        <p>
          Бид хэрэглэгчийн нууц үгийг bcrypt-ээр шифрлэх, өгөгдлийн санд хатуу хандалтын
          хяналт (RLS) тавих зэргээр аюулгүй байдлыг хангадаг.
        </p>
        <p className="text-gray-400 italic">[Таны бэлдсэн нэмэлт агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="4" title="Мэдээллийг гуравдагч этгээдтэй хуваалцах">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="5" title="Хэрэглэгчийн эрх">
        <p>Та өөрийн мэдээллийг харах, засах, устгах хүсэлт гаргах эрхтэй.</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн нэмэлт агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="6" title="Cookie ба ижил төстэй технологи">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="7" title="Бодлого шинэчлэгдэх">
        <p>
          Энэхүү бодлого шинэчлэгдэх тохиолдолд хэрэглэгчийг урьдчилан мэдээлнэ.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Холбоо барих">
        <p>Хувийн мэдээлэлтэй холбоотой асуултаа дараах хаягаар илгээнэ үү:</p>
        <p>Утас: [утас]</p>
        <p>И-мэйл: [и-мэйл]</p>
      </LegalSection>
    </LegalPage>
  );
}
