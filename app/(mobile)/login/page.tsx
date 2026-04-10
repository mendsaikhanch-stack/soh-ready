'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';
import TootLogo from '@/app/components/TootLogo';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Аль хэдийн нэвтэрсэн бол sokh руу шилжих
  useEffect(() => {
    if (!authLoading && user && profile?.sokh_id) {
      router.replace(`/sokh/${profile.sokh_id}`);
    }
  }, [authLoading, user, profile, router]);

  const handleLogin = async () => {
    setError('');

    if (!phone || !password) {
      setError('Утас, нууц үг бөглөнө үү');
      return;
    }

    if (!/^\d{8}$/.test(phone.trim())) {
      setError('Утасны дугаар 8 оронтой байна');
      return;
    }

    setLoading(true);

    // Утаснаас имэйл үүсгэж нэвтрэх
    const email = `${phone.trim()}@toot.app`;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Утас эсвэл нууц үг буруу байна');
      setLoading(false);
      return;
    }

    // Resident мэдээлэл авах
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    if (loggedInUser) {
      const userPhone = loggedInUser.user_metadata?.phone || phone.trim();
      const { data: resident } = await supabase
        .from('residents')
        .select('sokh_id')
        .eq('phone', userPhone)
        .limit(1)
        .single();

      if (resident?.sokh_id) {
        router.replace(`/sokh/${resident.sokh_id}`);
        return;
      }
    }

    router.replace('/select');
  };

  // Аль хэдийн нэвтэрсэн бол loading харуулна
  if (authLoading || (user && profile)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.push('/app')} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">Нэвтрэх</h1>
      </div>

      <div className="px-4 py-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2"><TootLogo size={168} showText={false} /></div>
          <p className="text-sm text-gray-500">Хотол апп-д нэвтрэх</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Утасны дугаар</label>
            <input
              type="tel"
              placeholder="99001122"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Нууц үг</label>
            <input
              type="password"
              placeholder="Нууц үг"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-white"
            />
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-sm mt-6 disabled:opacity-50 active:bg-blue-700 transition"
        >
          {loading ? 'Нэвтэрж байна...' : 'Нэвтрэх'}
        </button>

        {/* QR кодоор нэвтрэх */}
        <div className="mt-6 pt-6 border-t">
          <p className="text-center text-xs text-gray-400 mb-3">ЭСВЭЛ</p>
          <button
            onClick={() => router.push('/qr-login')}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 py-3.5 rounded-xl text-sm font-medium text-gray-600 active:bg-gray-50 transition"
          >
            <span className="text-lg">📷</span>
            QR кодоор нэвтрэх
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Бүртгэлгүй юу?{' '}
          <button onClick={() => router.push('/register')} className="text-blue-600 font-medium">
            Бүртгүүлэх
          </button>
        </p>
      </div>
    </div>
  );
}
