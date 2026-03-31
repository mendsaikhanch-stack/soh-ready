'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface AdminUser {
  id: number;
  username: string;
  sokh_id: number | null;
  sokh_name: string | null;
  role: string;
  display_name: string;
  status: string;
  created_at: string;
}

interface SokhOrg {
  id: number;
  name: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: 'СӨХ Админ', color: 'bg-blue-100 text-blue-700' },
  superadmin: { label: 'Супер Админ', color: 'bg-purple-100 text-purple-700' },
  osnaa: { label: 'ОСНАА', color: 'bg-amber-100 text-amber-700' },
};

export default function AdminAccountsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sokhs, setSokhs] = useState<SokhOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPass, setResetPass] = useState('');

  // Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sokhId, setSokhId] = useState<string>('');
  const [role, setRole] = useState('admin');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [usersRes, sokhsRes] = await Promise.all([
      fetch('/api/admin/users').then(r => r.json()),
      supabase.from('sokh_organizations').select('id, name').order('name'),
    ]);
    setUsers(usersRes.users || []);
    setSokhs(sokhsRes.data || []);
    setLoading(false);
  };

  const createUser = async () => {
    if (!username || !password) return;
    setSaving(true);
    setError('');

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        sokh_id: sokhId ? Number(sokhId) : null,
        role,
        display_name: displayName || username,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setShowForm(false);
      setUsername(''); setPassword(''); setDisplayName(''); setSokhId(''); setRole('admin');
      await fetchData();
    }
    setSaving(false);
  };

  const toggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, status: newStatus }),
    });
    await fetchData();
  };

  const doResetPassword = async () => {
    if (!resetId || !resetPass) return;
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetId, password: resetPass }),
    });
    setResetId(null);
    setResetPass('');
    alert('Нууц үг шинэчлэгдлээ');
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) return;
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await fetchData();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🔑 Админ эрх удирдлага</h1>
          <p className="text-sm text-gray-500 mt-1">СӨХ бүрт тусдаа админ хэрэглэгч үүсгэх</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          + Шинэ админ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{users.filter(u => u.role === 'admin' && u.status === 'active').length}</p>
          <p className="text-xs text-gray-500">СӨХ Админ</p>
        </div>
        <div className="rounded-xl border p-4 bg-purple-50 border-purple-200">
          <p className="text-xl font-bold text-purple-700">{users.filter(u => u.role === 'superadmin').length}</p>
          <p className="text-xs text-gray-500">Супер Админ</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
          <p className="text-xl font-bold text-amber-700">{users.filter(u => u.role === 'osnaa').length}</p>
          <p className="text-xs text-gray-500">ОСНАА</p>
        </div>
        <div className="rounded-xl border p-4 bg-gray-50">
          <p className="text-xl font-bold text-gray-500">{users.filter(u => u.status === 'disabled').length}</p>
          <p className="text-xs text-gray-500">Идэвхгүй</p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-sm mb-3">Шинэ админ хэрэглэгч</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Нэвтрэх нэр" value={username}
              onChange={e => setUsername(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Нууц үг" type="password" value={password}
              onChange={e => setPassword(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Харуулах нэр" value={displayName}
              onChange={e => setDisplayName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              <option value="admin">СӨХ Админ</option>
              <option value="osnaa">ОСНАА Админ</option>
              <option value="superadmin">Супер Админ</option>
            </select>
            <select value={sokhId} onChange={e => setSokhId(e.target.value)}
              className="col-span-2 border rounded-lg px-3 py-2 text-sm">
              <option value="">-- СӨХ сонгох (супер админ бол хоосон) --</option>
              {sokhs.map(s => (
                <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={createUser} disabled={saving || !username || !password}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? '...' : 'Үүсгэх'}
            </button>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {users.map(u => {
          const rl = roleLabels[u.role] || roleLabels.admin;
          return (
            <div key={u.id} className={`bg-white border rounded-xl p-4 ${u.status === 'disabled' ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg font-bold text-gray-500">
                    {u.display_name?.charAt(0) || u.username.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{u.display_name || u.username}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${rl.color}`}>{rl.label}</span>
                      {u.status === 'disabled' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600">Идэвхгүй</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                    {u.sokh_name && <p className="text-xs text-blue-600">🏢 {u.sokh_name}</p>}
                    {!u.sokh_id && u.role !== 'superadmin' && <p className="text-xs text-orange-500">⚠ СӨХ тохируулаагүй</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleStatus(u)}
                    className={`text-xs px-3 py-1 rounded-lg ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.status === 'active' ? 'Идэвхтэй' : 'Идэвхжүүлэх'}
                  </button>
                  <button onClick={() => { setResetId(u.id); setResetPass(''); }}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-100 text-blue-700">
                    Нууц үг
                  </button>
                  {u.role !== 'superadmin' && (
                    <button onClick={() => deleteUser(u.id)}
                      className="text-xs px-3 py-1 rounded-lg bg-red-100 text-red-500">
                      Устгах
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Password reset modal */}
      {resetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setResetId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Нууц үг шинэчлэх</h3>
            <input type="password" placeholder="Шинэ нууц үг" value={resetPass}
              onChange={e => setResetPass(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setResetId(null)} className="flex-1 py-2 border rounded-lg text-sm">Цуцлах</button>
              <button onClick={doResetPassword} disabled={!resetPass}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Хадгалах</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
