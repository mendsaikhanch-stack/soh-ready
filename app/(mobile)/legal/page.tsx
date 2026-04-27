import Link from 'next/link';
import LegalPage from '@/app/components/legal/LegalPage';

export const metadata = {
  title: 'Хууль зүйн мэдээлэл — Хотол',
};

const items = [
  {
    href: '/help',
    icon: '❓',
    title: 'Тусламж · FAQ',
    desc: 'Хамгийн их асуугддаг асуултууд, ашиглах заавар',
  },
  {
    href: '/terms/resident',
    icon: '📄',
    title: 'Оршин суугчийн үйлчилгээний нөхцөл',
    desc: 'Хэрэглэгчийн эрх, үүрэг, ерөнхий журам',
  },
  {
    href: '/terms/admin',
    icon: '🔑',
    title: 'СӨХ / Админ үйлчилгээний нөхцөл',
    desc: 'СӨХ-ийн дарга, нярав, удирдлагын баг',
  },
  {
    href: '/privacy',
    icon: '🔒',
    title: 'Нууцлалын бодлого',
    desc: 'Хувийн мэдээлэл цуглуулах, ашиглах журам',
  },
];

export default function LegalIndexPage() {
  return (
    <LegalPage title="Хууль зүйн мэдээлэл" subtitle="Үйлчилгээний нөхцөл, нууцлал, тусламж" accent="slate">
      <p className="text-sm text-gray-700">
        Хотол платформын хууль зүйн баримт бичиг, ашиглах заавар, тусламжийн материалуудтай
        энд танилцана уу.
      </p>

      <div className="space-y-2 mt-2">
        {items.map(it => (
          <Link
            key={it.href}
            href={it.href}
            className="block border rounded-2xl p-3.5 hover:bg-gray-50 active:bg-gray-100 transition"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{it.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900">{it.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{it.desc}</p>
              </div>
              <span className="text-gray-400 text-xl">›</span>
            </div>
          </Link>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 pt-4">© Хотол · Бүх эрх хуулиар хамгаалагдсан</p>
    </LegalPage>
  );
}
