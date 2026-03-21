'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import TootLogo from '@/app/components/TootLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Имэйл, нууц үг бөглөнө үү');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Имэйл эсвэл нууц үг буруу байна');
      setLoading(false);
      return;
    }

    router.replace('/select');
  };

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
          <p className="text-sm text-gray-500">Тоот апп-д нэвтрэх</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Имэйл хаяг</label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
