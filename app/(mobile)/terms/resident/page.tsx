import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';
import MetaBlock from '@/app/components/legal/MetaBlock';

export const metadata = {
  title: 'Оршин суугчийн үйлчилгээний нөхцөл — Хотол',
};

// TODO: Жинхэнэ агуулгыг (бэлтгэсэн Монгол хэл дээрх текстээ) доорх <p>...</p> блокуудыг
// орлуулан паст хийнэ үү. Бүтэц нь бэлэн байна.
export default function ResidentTermsPage() {
  return (
    <LegalPage
      title="Оршин суугчийн үйлчилгээний нөхцөл"
      subtitle="Хотол платформыг ашиглах"
      accent="blue"
    >
      <MetaBlock version="1.0" effectiveDate="[он/сар/өдөр]" updatedAt="[он/сар/өдөр]" />

      <p className="text-gray-700">
        Энэхүү нөхцөл нь Хотол платформыг (цаашид «Хотол» гэх) оршин суугч хэрэглэгчдийн ашиглах
        ерөнхий журмыг тодорхойлно. Бүртгүүлж, үйлчилгээг ашигласнаар та энэ нөхцөлтэй танилцаж,
        зөвшөөрсөн гэж тооцогдоно.
      </p>

      <LegalSection number="1" title="Нэр томъёоны тодорхойлолт">
        <p>{/* TODO: нэр томъёоны жагсаалтыг паст хийнэ. Жишээ: «Хэрэглэгч» гэдэг нь... */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="2" title="Үйлчилгээний хамрах хүрээ">
        <p>{/* TODO */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="3" title="Бүртгэл, хэрэглэгчийн мэдээлэл">
        <p>{/* TODO: утас, хувийн мэдээлэл цуглуулах хэсэг */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="4" title="Хэрэглэгчийн үүрэг">
        <p>{/* TODO */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="5" title="Төлбөр, хураамж">
        <p>{/* TODO: СӨХ хураамж, бусад төлбөр */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="6" title="Хариуцлагын хязгаарлалт">
        <p>{/* TODO */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="7" title="Гомдол, маргаан шийдвэрлэх">
        <p>{/* TODO */}</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="8" title="Нөхцөл шинэчлэгдэх">
        <p>
          Хотол энэхүү нөхцөлийг шаардлагатай үед шинэчилж болох ба шинэчилсэн нөхцөл нь хуудсанд
          байршуулсан өдрөөс эхлэн хүчинтэй болно.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Холбоо барих">
        <p>Утас: [утас]</p>
        <p>И-мэйл: [и-мэйл]</p>
        <p>Хаяг: [хаяг]</p>
      </LegalSection>
    </LegalPage>
  );
}
