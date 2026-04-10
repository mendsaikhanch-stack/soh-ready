'use client';

import { useRouter } from 'next/navigation';
import TootLogo from '@/app/components/TootLogo';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/')}>
            <TootLogo size={108} />
          </button>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition">Боломжууд</a>
            <a href="#how" className="text-gray-600 hover:text-gray-900 transition">Хэрхэн ажилладаг</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Үнэ</a>
            <button onClick={() => router.push('/demo')} className="text-blue-600 font-medium hover:text-blue-700">Demo</button>
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/app')} className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2">
              Нэвтрэх
            </button>
            <button onClick={() => router.push('/app')} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Үнэгүй эхлэх
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
                <TootLogo size={96} textColor="text-white" />
              </div>
              <p className="text-gray-400 text-sm">Таны байрны бүх зүйл нэг дор</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Платформ</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition">Боломжууд</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Үнийн мэдээлэл</a></li>
                <li><button onClick={() => router.push('/demo')} className="hover:text-white transition">Demo үзэх</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Холбоо барих</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📞 7700-1122</li>
                <li>📧 info@toot.mn</li>
                <li>📍 Улаанбаатар хот</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Дагах</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Facebook</a></li>
                <li><a href="#" className="hover:text-white transition">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
            © 2026 Хотол. Бүх эрх хуулиар хамгаалагдсан.
          </div>
        </div>
      </footer>
    </div>
  );
}
