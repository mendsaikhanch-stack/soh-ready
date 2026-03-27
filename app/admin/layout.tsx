'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TootLogo from '@/app/components/TootLogo';
import { supabase } from '@/app/lib/supabase';
import Image from 'next/image';

const navItems = [
  { icon: '📊', label: 'Хянах самбар', href: '/admin' },
  { icon: '👥', label: 'Оршин суугчид', href: '/admin/residents' },
  { icon: '💰', label: 'Төлбөр', href: '/admin/payments' },
  { icon: '📢', label: 'Зарлал', href: '/admin/announcements' },
  { icon: '🔧', label: 'Засвар', href: '/admin/maintenance' },
  { icon: '📋', label: 'Тайлан', href: '/admin/reports' },
  { icon: '📝', label: 'Гомдол / Санал', href: '/admin/complaints' },
  { icon: '📊', label: 'Ашиглалт', href: '/admin/utilities' },
  { icon: '👷', label: 'Ажилчид', href: '/admin/staff' },
  { icon: '🚨', label: 'Яаралтай', href: '/admin/emergency' },
  { icon: '🗳', label: 'Санал хураалт', href: '/admin/polls' },
  { icon: '💬', label: 'Мессеж', href: '/admin/messages' },
  { icon: '🏪', label: 'Хөрш маркет', href: '/admin/marketplace' },
  { icon: '🏢', label: 'Зай захиалга', href: '/admin/booking' },
  { icon: '💰', label: 'Санхүү', href: '/admin/finance' },
  { icon: '📦', label: 'Илгээмж', href: '/admin/packages' },
  { icon: '🏪', label: 'Дэлгүүр & Автомат', href: '/admin/shops' },
  { icon: '🚗', label: 'Зогсоол', href: '/admin/parking' },
  { icon: '📹', label: 'Камер (CCTV)', href: '/admin/cctv' },
  { icon: '📤', label: 'Файл импорт', href: '/admin/import' },
  { icon: '🛗', label: 'Лифт засвар', href: '/admin/elevator' },
  { icon: '🎨', label: 'Брэнд тохиргоо', href: '/admin/branding' },
  { icon: '🎛', label: 'Үйлчилгээ тохиргоо', href: '/admin/features' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    checkAuth();
    const fetchOrg = async () => {
      const { data } = await supabase
        .from('sokh_organizations')
        .select('name, logo_url')
        .limit(1)
        .single();
      if (data) {
        setOrgLogo(data.logo_url || null);
        setOrgName(data.name || '');
      }
    };
    fetchOrg();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check?type=admin');
      const data = await res.json();
      setAuthed(data.authenticated);
    } catch {
      setAuthed(false);
    }
    setChecking(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, type: 'admin' }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAuthed(true);
        setUsername('');
        setPassword('');
      } else {
        setError(data.error || 'Нэвтрэх нэр эсвэл нууц үг буруу');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'admin' }),
    });
    setAuthed(false);
    setUsername('');
    setPassword('');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2"><TootLogo size={144} showText={false} /></div>
            <h1 className="text-xl font-bold">Тоот Админ</h1>
            <p className="text-sm text-gray-500 mt-1">Удирдлагын панелд нэвтрэх</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Нэвтрэх нэр</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Нэвтрэх нэр"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Нууц үг</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 text-center">
              🔒 Нэвтрэлт серверээр хамгаалагдсан
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-56 bg-gray-900 text-white flex-shrink-0 min-h-screen flex flex-col">
        <div className="p-4 border-b border-gray-700">
          {orgLogo ? (
            <div className="flex items-center gap-2">
              <Image src={orgLogo} alt={orgName} width={40} height={40} className="w-10 h-10 rounded-lg object-contain" />
              <div>
                <p className="text-sm font-bold text-white truncate">{orgName}</p>
                <p className="text-xs text-gray-400">Удирдлагын панел</p>
              </div>
            </div>
          ) : (
            <>
              <TootLogo size={84} textColor="text-white" />
              <p className="text-xs text-gray-400 mt-1">Удирдлагын панел</p>
            </>
          )}
        </div>
        <nav className="p-2 flex-1 overflow-y-auto">
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
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <span>🚪</span>
            <span>Гарах</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
