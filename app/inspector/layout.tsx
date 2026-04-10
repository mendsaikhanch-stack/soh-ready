'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import PWAInstallPrompt from '@/app/components/PWAInstallPrompt';

interface InspectorUser { id: number; name: string; kontorNumber: number | null; }
const InspectorCtx = createContext<InspectorUser | null>(null);
export const useInspector = () => useContext(InspectorCtx);

const tabs = [
  { icon: '🏠', label: 'Нүүр', href: '/inspector' },
  { icon: '🗺️', label: 'Маршрут', href: '/inspector/route' },
  { icon: '📷', label: 'Скан', href: '/inspector/scan' },
  { icon: '⚠️', label: 'Зөрчил', href: '/inspector/violations' },
  { icon: '📋', label: 'Тайлан', href: '/inspector/reports' },
];

export default function InspectorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [inspector, setInspector] = useState<InspectorUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Админ PWA manifest солих (байцаагч = Хотол Удирдлага апп)
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.setAttribute('href', '/manifest-admin.json');
    const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (meta) meta.setAttribute('content', 'Хотол Удирдлага');
    return () => {
      if (link) link.setAttribute('href', '/manifest.json');
      if (meta) meta.setAttribute('content', 'Хотол');
    };
  }, []);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check?type=inspector');
      const data = await res.json();
      if (data.authenticated) {
        try {
          const saved = localStorage.getItem('inspector_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed.id === 'number' && typeof parsed.name === 'string') {
              setInspector(parsed);
            } else {
              localStorage.removeItem('inspector_user');
              setInspector({ id: 0, name: 'Байцаагч', kontorNumber: null });
            }
          } else {
            setInspector({ id: 0, name: 'Байцаагч', kontorNumber: null });
          }
        } catch {
          localStorage.removeItem('inspector_user');
          setInspector({ id: 0, name: 'Байцаагч', kontorNumber: null });
        }
      }
    } catch {
      setInspector(null);
    }
    setChecking(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, type: 'inspector' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const user = { id: data.inspectorId, name: data.name, kontorNumber: data.kontorNumber || null };
        setInspector(user);
        localStorage.setItem('inspector_user', JSON.stringify(user));
      } else {
        setError(data.error || 'Нэвтрэх нэр эсвэл нууц үг буруу');
      }
    } catch { setError('Сервертэй холбогдож чадсангүй'); }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'inspector' }),
    });
    localStorage.removeItem('inspector_user');
    setInspector(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  if (!inspector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl mx-auto mb-3">🔍</div>
            <h1 className="text-xl font-bold">Байцаагч</h1>
            <p className="text-sm text-gray-500 mt-1">ОСНААК шалгалтын апп</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Нэвтрэх нэр" autoFocus autoComplete="username"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Нууц үг" autoComplete="current-password"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <InspectorCtx.Provider value={inspector}>
      <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto relative pb-16">
        {/* Top bar */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-lg font-bold">
              {inspector.kontorNumber || '?'}
            </div>
            <div>
              <p className="text-sm font-bold">№{inspector.kontorNumber} контор</p>
              <p className="text-[10px] text-indigo-200">{inspector.name}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-xs text-indigo-200 hover:text-white px-2 py-1 rounded-lg hover:bg-indigo-500">
            Гарах
          </button>
        </div>

        {/* Content */}
        {children}

        <PWAInstallPrompt appName="Хотол Удирдлага" />

        {/* Bottom tabs */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t flex z-50">
          {tabs.map(tab => {
            const isActive = pathname === tab.href;
            return (
              <button key={tab.href} onClick={() => router.push(tab.href)}
                className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition ${
                  isActive ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </InspectorCtx.Provider>
  );
}
