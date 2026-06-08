'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

const navItems = [
  { icon: '📊', label: 'Хянах самбар', href: '/mng-ctrl' },
  { icon: '🏢', label: 'СӨХ-үүд', href: '/mng-ctrl/organizations' },
  { icon: '📦', label: 'Багц & Зэрэглэл', href: '/mng-ctrl/plans' },
  { icon: '🏦', label: 'Данс', href: '/mng-ctrl/bank-accounts' },
  { icon: '🧾', label: 'eBarimt', href: '/mng-ctrl/ebarimt' },
  { icon: '💵', label: 'Платформ орлого', href: '/mng-ctrl/revenue' },
  { icon: '🏗️', label: 'ОСНАА орлого', href: '/mng-ctrl/osnaa-revenue' },
  { icon: '⚡', label: 'Цахилгаан орлого', href: '/mng-ctrl/tsah-revenue' },
  { icon: '👥', label: 'Хэрэглэгчид', href: '/mng-ctrl/users' },
  { icon: '📈', label: 'Аналитик', href: '/mng-ctrl/analytics' },
  { icon: '🔑', label: 'Админ эрх', href: '/mng-ctrl/admins' },
  { icon: '📞', label: 'Холбоо хүсэлтүүд', href: '/mng-ctrl/leads' },
  { icon: '📣', label: 'Маркетинг', href: '/mng-ctrl/marketing' },
  { icon: '🩺', label: 'Системийн эрүүл мэнд', href: '/mng-ctrl/system-health' },
  { icon: '🛠', label: 'Дэмжлэг', href: '/mng-ctrl/support' },
  { icon: '📍', label: 'Дүүрэг & Хороо', href: '/mng-ctrl/locations' },
  { icon: '⚙️', label: 'Тохиргоо', href: '/mng-ctrl/settings' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkMsg, setPkMsg] = useState('');

  // OTP state
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check?type=superadmin');
      const data = await res.json();
      if (data.authenticated) {
        setAuthed(true);
        // 2-р шат (OTP/passkey) баталгаажсан эсэхийг сервер талаас
        setOtpVerified(!!data.otpVerified);
      }
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
        body: JSON.stringify({ username, password, type: 'superadmin', remember }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthed(true);
        setUsername('');
        setPassword('');
        // OTP илгээх
        sendOtp();
      } else {
        setError(data.error || 'Нэвтрэх нэр эсвэл нууц үг буруу');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setLoading(false);
  };

  // Passkey-ээр нэвтрэх (хурууны хээ / Face ID)
  const loginWithPasskey = async () => {
    setError('');
    setPkBusy(true);
    try {
      const optRes = await fetch('/api/auth/passkey/authenticate/options', { method: 'POST' });
      const options = await optRes.json();
      if (!optRes.ok) {
        setError(options.error || 'Passkey бэлэн биш');
        setPkBusy(false);
        return;
      }
      const asseResp = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch('/api/auth/passkey/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: asseResp, remember }),
      });
      const data = await verRes.json();
      if (verRes.ok && data.verified) {
        setAuthed(true);
        setOtpVerified(true); // passkey = бүрэн нэвтрэлт
      } else {
        setError(data.error || 'Passkey нэвтрэлт амжилтгүй');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Passkey цуцлагдсан');
    }
    setPkBusy(false);
  };

  // Энэ төхөөрөмжийг passkey-ээр бүртгэх (нэвтэрсэн байх шаардлагатай)
  const registerPasskey = async () => {
    setPkMsg('');
    setPkBusy(true);
    try {
      const deviceName = (typeof window !== 'undefined'
        ? window.prompt('Энэ төхөөрөмжийн нэр (ж: Утас, Зөөврийн компьютер):', 'Төхөөрөмж')
        : 'Төхөөрөмж') || 'Төхөөрөмж';
      const optRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      const options = await optRes.json();
      if (!optRes.ok) {
        setPkMsg(options.error || 'Алдаа гарлаа');
        setPkBusy(false);
        return;
      }
      const attResp = await startRegistration({ optionsJSON: options });
      const verRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp, deviceName }),
      });
      const data = await verRes.json();
      setPkMsg(verRes.ok && data.verified
        ? '✓ Төхөөрөмж бүртгэгдлээ! Дараа нь хурууны хээ / Face ID-ээр нэвтэрнэ.'
        : (data.error || 'Бүртгэл амжилтгүй'));
    } catch (err) {
      setPkMsg(err instanceof Error ? err.message : 'Цуцлагдсан');
    }
    setPkBusy(false);
  };

  const sendOtp = async () => {
    setOtpSending(true);
    setError('');
    try {
      const res = await fetch('/api/mng-ctrl/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send' }),
      });
      const data = await res.json();
      if (data.sent) {
        setOtpEmail(data.email);
        setStep('otp');
      } else {
        setError(data.error || 'Код илгээхэд алдаа');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setOtpSending(false);
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/mng-ctrl/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: otpCode }),
      });
      const data = await res.json();
      if (data.verified) {
        setOtpVerified(true);
        setOtpCode('');
      } else {
        setError(data.error || 'Код буруу');
      }
    } catch {
      setError('Алдаа гарлаа');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'superadmin' }),
    });
    // OTP cookie устгах
    document.cookie = 'sa-otp-verified=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setAuthed(false);
    setOtpVerified(false);
    setStep('login');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Ачаалж байна...</p>
      </div>
    );
  }

  // OTP шалгалт (нууц үг зөв, код хэрэгтэй)
  if (authed && !otpVerified) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-3">🔐</div>
            <h1 className="text-xl font-bold text-white">Баталгаажуулалт</h1>
            <p className="text-sm text-gray-500 mt-1">
              {otpEmail ? `${otpEmail} руу код илгээлээ` : 'Мэйл рүү код илгээж байна...'}
            </p>
          </div>

          {step === 'otp' && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-400 block mb-1">6 оронтой код</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Шалгаж байна...' : 'Баталгаажуулах'}
              </button>

              <button
                type="button"
                onClick={sendOtp}
                disabled={otpSending}
                className="w-full text-sm text-gray-500 hover:text-gray-300 py-2"
              >
                {otpSending ? 'Илгээж байна...' : 'Дахин код илгээх'}
              </button>
            </form>
          )}

          {step === 'login' && (
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-3">Код илгээж байна...</p>
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">S</div>
            <h1 className="text-xl font-bold text-white">Super Admin</h1>
            <p className="text-sm text-gray-500 mt-1">Платформ удирдлага</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-1">Нэвтрэх нэр</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Нэвтрэх нэр"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-1">Нууц үг</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded-xl">
                {error}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800"
              />
              Энэ төхөөрөмжийг сана (30 хоног)
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">эсвэл</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <button
            type="button"
            onClick={loginWithPasskey}
            disabled={pkBusy}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 text-white py-3 rounded-xl font-semibold hover:bg-gray-700 transition disabled:opacity-50"
          >
            <span>🔑</span>
            <span>{pkBusy ? 'Хүлээж байна...' : 'Passkey-ээр нэвтрэх'}</span>
          </button>
          <p className="text-xs text-gray-600 text-center mt-2">Хурууны хээ / Face ID (бүртгэсэн төхөөрөмж дээр)</p>

          <div className="mt-4 p-3 bg-gray-800/50 rounded-xl">
            <p className="text-xs text-gray-500 text-center">
              🔒 Хамгаалагдсан — 5 удаа буруу оруулбал 15 минут түгжинэ
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
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
        <div className="p-4 border-t border-gray-800 space-y-1">
          <button
            onClick={registerPasskey}
            disabled={pkBusy}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition disabled:opacity-50"
            title="Энэ төхөөрөмж дээр хурууны хээ / Face ID-ээр нэвтрэх боломж нэмнэ"
          >
            <span>🔑</span>
            <span>{pkBusy ? 'Хүлээж байна...' : 'Энэ төхөөрөмжийг бүртгэх'}</span>
          </button>
          {pkMsg && <p className="px-3 text-xs text-gray-400">{pkMsg}</p>}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition"
          >
            <span>🚪</span>
            <span>Гарах</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-900 text-white">
        {children}
      </main>
    </div>
  );
}
