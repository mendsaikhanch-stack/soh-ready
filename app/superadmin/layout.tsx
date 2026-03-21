'use client';

import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { icon: '📊', label: 'Хянах самбар', href: '/superadmin' },
  { icon: '🏢', label: 'СӨХ-үүд', href: '/superadmin/organizations' },
  { icon: '💵', label: 'Орлого', href: '/superadmin/revenue' },
  { icon: '👥', label: 'Хэрэглэгчид', href: '/superadmin/users' },
  { icon: '📈', label: 'Аналитик', href: '/superadmin/analytics' },
  { icon: '🛠', label: 'Дэмжлэг', href: '/superadmin/support' },
  { icon: '⚙️', label: 'Тохиргоо', href: '/superadmin/settings' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-950 border-r border-gray-800 flex-shrink-0 min-h-screen flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">S</div>
            <div>
              <h1 className="text-white text-sm font-bold">Super Admin</h1>
              <p className="text-gray-500 text-xs">Платформ удирдлага</p>
            </div>
          </div>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left mb-0.5 transition ${
                  isActive ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs">М</div>
            <div>
              <p className="text-white text-xs font-medium">Мэндсайхан</p>
              <p className="text-gray-500 text-xs">Эзэмшигч</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-900 text-white">
        {children}
      </main>
    </div>
  );
}
