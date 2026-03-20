'use client';

import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { icon: '📊', label: 'Хянах самбар', href: '/admin' },
  { icon: '👥', label: 'Оршин суугчид', href: '/admin/residents' },
  { icon: '💰', label: 'Төлбөр', href: '/admin/payments' },
  { icon: '📢', label: 'Зарлал', href: '/admin/announcements' },
  { icon: '🔧', label: 'Засвар', href: '/admin/maintenance' },
  { icon: '📋', label: 'Тайлан', href: '/admin/reports' },
  { icon: '🗳', label: 'Санал хураалт', href: '/admin/polls' },
  { icon: '💬', label: 'Мессеж', href: '/admin/messages' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex-shrink-0 min-h-screen">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold">🏢 СӨХ Админ</h1>
          <p className="text-xs text-gray-400 mt-1">Удирдлагын панел</p>
        </div>
        <nav className="p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left mb-0.5 transition ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
