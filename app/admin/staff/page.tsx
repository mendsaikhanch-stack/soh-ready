'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Staff {
  id: number;
  name: string;
  role: string;
  phone: string;
  schedule: string;
  status: string;
  created_at: string;
}

const roleOptions = [
  { value: 'manager', label: 'Менежер', icon: '👔' },
  { value: 'janitor', label: 'Цэвэрлэгч', icon: '🧹' },
  { value: 'security', label: 'Харуул', icon: '💂' },
  { value: 'plumber', label: 'Сантехникч', icon: '🔧' },
  { value: 'electrician', label: 'Цахилгаанчин', icon: '⚡' },
  { value: 'other', label: 'Бусад', icon: '👷' },
];

export default function AdminStaff() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form
  const [name, setName] = useState('');
  const [role, setRole] = useState('janitor');
  const [phone, setPhone] = useState('');
  const [schedule, setSchedule] = useState('');

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });

    setStaff(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setName(''); setRole('janitor'); setPhone(''); setSchedule('');
    setEditId(null); setShowForm(false);
  };

  const saveStaff = async () => {
    if (!name) return;
    setSaving(true);

    const sokhId = await getAdminSokhId();
    const record = { sokh_id: sokhId, name, role, phone, schedule, status: 'active' };

    if (editId) {
      await adminFrom('staff').update(record).eq('id', editId);
    } else {
      await adminFrom('staff').insert([record]);
    }

    resetForm();
    setSaving(false);
    await fetchStaff();
  };

  const editStaff = (s: Staff) => {
    setEditId(s.id);
    setName(s.name);
    setRole(s.role);
    setPhone(s.phone || '');
    setSchedule(s.schedule || '');
    setShowForm(true);
  };

  const toggleStatus = async (id: number, current: string) => {
    const newStatus = current === 'active' ? 'inactive' : 'active';
    await adminFrom('staff').update({ status: newStatus }).eq('id', id);
    await fetchStaff();
  };

  const deleteStaff = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('staff').delete().eq('id', id);
    await fetchStaff();
  };

  const getRole = (r: string) => roleOptions.find(o => o.value === r) || roleOptions[5];
  const active = staff.filter(s => s.status === 'active');
  const inactive = staff.filter(s => s.status !== 'active');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">👷 Ажилчдын удирдлага</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-xl font-bold text-green-700">{active.length}</p>
          <p className="text-xs text-gray-500">Идэвхтэй ажилтан</p>
        </div>
        <div className="rounded-xl border p-4 bg-gray-50">
          <p className="text-xl font-bold text-gray-500">{inactive.length}</p>
          <p className="text-xs text-gray-500">Идэвхгүй</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{staff.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
      </div>

      <button onClick={() => { resetForm(); setShowForm(!showForm); }}
        className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 mb-4">
        + Ажилтан нэмэх
      </button>

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">{editId ? 'Ажилтан засах' : 'Шинэ ажилтан'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Нэр" value={name} onChange={e => setName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <select value={role} onChange={e => setRole(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
            </select>
            <input placeholder="Утас" value={phone} onChange={e => setPhone(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Хуваарь (жнь: Даваа-Баасан 09:00-18:00)" value={schedule}
              onChange={e => setSchedule(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={saveStaff} disabled={saving || !name}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm disabled:opacity-50">
              {saving ? '...' : editId ? 'Хадгалах' : 'Нэмэх'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <div className="space-y-3">
          {staff.map(s => {
            const r = getRole(s.role);
            return (
              <div key={s.id} className={`bg-white border rounded-xl p-4 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">
                      {r.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{s.name}</h3>
                      <p className="text-xs text-amber-600">{r.label}</p>
                      {s.phone && <p className="text-xs text-gray-500">📞 {s.phone}</p>}
                      {s.schedule && <p className="text-xs text-gray-500">🕐 {s.schedule}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleStatus(s.id, s.status)}
                      className={`text-xs px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </button>
                    <button onClick={() => editStaff(s)} className="text-xs text-blue-500 hover:underline">Засах</button>
                    <button onClick={() => deleteStaff(s.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                  </div>
                </div>
              </div>
            );
          })}
          {staff.length === 0 && <p className="text-gray-400 text-center py-8">Ажилтан байхгүй</p>}
        </div>
      )}
    </div>
  );
}
