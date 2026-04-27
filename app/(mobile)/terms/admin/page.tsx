import LegalPage from '@/app/components/legal/LegalPage';
import LegalSection from '@/app/components/legal/LegalSection';
import MetaBlock from '@/app/components/legal/MetaBlock';

export const metadata = {
  title: 'СӨХ / Админ үйлчилгээний нөхцөл — Хотол',
};

// TODO: Жинхэнэ агуулгыг (бэлтгэсэн Монгол хэл дээрх текстээ) паст хийнэ үү.
export default function AdminTermsPage() {
  return (
    <LegalPage
      title="СӨХ / Админ үйлчилгээний нөхцөл"
      subtitle="СӨХ-ийн дарга, нярав, удирдлагын баг"
      accent="amber"
    >
      <MetaBlock version="1.0" effectiveDate="[он/сар/өдөр]" updatedAt="[он/сар/өдөр]" />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        ℹ️ Энэхүү нөхцөл нь Хотол-той байгуулсан үндсэн үйлчилгээний гэрээтэй хамт хэрэглэгдэнэ.
      </div>

      <p className="text-gray-700">
        СӨХ-ийн дарга, нярав болон бусад удирдлагын ажилтан Хотол платформыг ашиглахдаа энэхүү
        нөхцөлийг дагах үүрэгтэй.
      </p>

      <LegalSection number="1" title="Нэр томъёоны тодорхойлолт">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="2" title="Үйлчилгээний хамрах хүрээ ба эрх олголт">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="3" title="Админ эрхийн идэвхжүүлэлт">
        <p>
          СӨХ-ийн админ эрх нь зөвхөн гэрээ байгуулсан СӨХ-нд олгогдох ба идэвхжүүлэлтийн код
          (6 оронтой) нь тодорхой утсаар л хүчинтэй байна.
        </p>
        <p className="text-gray-400 italic">[Таны бэлдсэн нэмэлт агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="4" title="Админы үүрэг хариуцлага">
        <p>Оршин суугчдын хувийн мэдээллийг хууль ёсны зорилгоор л ашиглана.</p>
        <p className="text-gray-400 italic">[Таны бэлдсэн нэмэлт агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="5" title="Үйлчилгээний хураамж, төлбөр">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="6" title="Гэрээний цуцлалт">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="7" title="Маргаан шийдвэрлэх">
        <p className="text-gray-400 italic">[Таны бэлдсэн агуулгыг энд оруулна уу]</p>
      </LegalSection>

      <LegalSection number="8" title="Холбоо барих">
        <p>Утас: [утас]</p>
        <p>И-мэйл: [и-мэйл]</p>
        <p>Хаяг: [хаяг]</p>
      </LegalSection>
    </LegalPage>
  );
}
