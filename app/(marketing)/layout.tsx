'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HotolLogo from '@/app/components/HotolLogo';
import PWAInstallPrompt from '@/app/components/PWAInstallPrompt';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/')}>
            <HotolLogo size={108} />
          </button>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/find-hoa" className="text-gray-600 hover:text-gray-900 transition">СӨХ хайх</Link>
            <Link href="/help" className="text-gray-600 hover:text-gray-900 transition">Тусламж</Link>
            <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition">Холбоо барих</Link>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/login')} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Нэвтрэх
            </button>
            <button onClick={() => router.push('/find-hoa')} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              СӨХ-өө хайх
            </button>
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="mb-3">
                <HotolLogo size={96} textColor="text-white" />
              </div>
              <p className="text-gray-400 text-sm">Таны байрны бүх зүйл нэг дор</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Хотол</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/" className="hover:text-white transition">Нүүр</Link></li>
                <li><Link href="/find-hoa" className="hover:text-white transition">СӨХ хайх</Link></li>
                <li><Link href="/help" className="hover:text-white transition">Тусламж</Link></li>
                <li><Link href="/contact" className="hover:text-white transition">Холбоо барих</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Хууль ёсны мэдээлэл</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition">Нууцлалын бодлого</Link></li>
                <li><Link href="/terms/resident" className="hover:text-white transition">Оршин суугчийн нөхцөл</Link></li>
                <li><Link href="/terms/admin" className="hover:text-white transition">Админ нөхцөл</Link></li>
                <li><Link href="/account/delete" className="hover:text-white transition">Бүртгэл устгах хүсэлт</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Холбоо барих</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📞 7700-1122</li>
                <li>📧 info@hotol.mn</li>
                <li>📍 Улаанбаатар хот</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            © 2026 Хотол. Бүх эрх хуулиар хамгаалагдсан.
          </div>
        </div>
      </footer>

      <PWAInstallPrompt appName="Хотол" />
    </div>
  );
}
