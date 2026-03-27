'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/auth-context';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { profile, user } = useAuth();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const hasChanges = name !== profile?.name || phone !== profile?.phone;

  const handleSave = async () => {
    if (!profile || !hasChanges) return;
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/residents/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentId: profile.id, name: name.trim(), phone: phone.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Алдаа гарлаа');
      } else {
        setSuccess(true);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/sokh/${params.id}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Миний мэдээлэл</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {profile?.name?.charAt(0) || '?'}
          </div>
          <p className="text-sm text-gray-500 mt-2">Тайлбар: {profile?.apartment}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Нэр</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="Нэрээ оруулна уу"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Утасны дугаар</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="99001122"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Байр / Тоот</label>
            <input
              type="text"
              value={profile?.apartment || ''}
              disabled
              className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">Байр/тоот өөрчлөхийг СӨХ админд хандана уу</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имэйл</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-400"
            />
          </div>
        </div>

        {/* Debt info */}
        {profile && profile.debt > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Төлөгдөөгүй өр</p>
                <p className="text-2xl font-bold text-red-600">{Number(profile.debt).toLocaleString()}₮</p>
              </div>
              <button
                onClick={() => router.push(`/sokh/${params.id}/payments`)}
                className="bg-red-600 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-red-700 transition"
              >
                Төлөх
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-600">
            Амжилттай хадгалагдлаа!
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`w-full py-3.5 rounded-xl text-sm font-bold transition ${
            hasChanges
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>

        {/* Account info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Бүртгэлийн мэдээлэл</h3>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>СӨХ ID</span>
              <span className="font-medium text-gray-700">{profile?.sokh_id}</span>
            </div>
            <div className="flex justify-between">
              <span>Оршин суугч ID</span>
              <span className="font-medium text-gray-700">{profile?.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
