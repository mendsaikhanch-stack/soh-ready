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
  salary: number;
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
  const [activeTab, setActiveTab] = useState<'list' | 'salary'>('list');
  const [name, setName] = useState('');
  const [role, setRole] = useState('janitor');
  const [phone, setPhone] = useState('');
  const [schedule, setSchedule] = useState('');
  const [salary, setSalary] = useState('');

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
    setName(''); setRole('janitor'); setPhone(''); setSchedule(''); setSalary('');
    setEditId(null); setShowForm(false);
  };

  const saveStaff = async () => {
    if (!name) return;
    setSaving(true);

    const sokhId = await getAdminSokhId();
    const record = { sokh_id: sokhId, name, role, phone, schedule, salary: Number(salary) || 0, status: 'active' };

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
    setSalary(s.salary ? String(s.salary) : '');
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
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-xl font-bold text-green-700">{active.length}</p>
          <p className="text-xs text-gray-500">Идэвхтэй</p>
        </div>
        <div className="rounded-xl border p-4 bg-gray-50">
          <p className="text-xl font-bold text-gray-500">{inactive.length}</p>
          <p className="text-xs text-gray-500">Идэвхгүй</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{staff.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
          <p className="text-xl font-bold text-amber-700">{active.reduce((s, st) => s + (st.salary || 0), 0).toLocaleString()}₮</p>
          <p className="text-xs text-gray-500">Сарын цалин</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        <button onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
          Ажилчид
        </button>
        <button onClick={() => setActiveTab('salary')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'salary' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>
          Цалингийн тооцоо
        </button>
      </div>

      {activeTab === 'salary' && (
        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-gray-500">САРЫН ЦАЛИНГИЙН ТООЦОО</h2>
          {active.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Идэвхтэй ажилтан байхгүй</p>
          ) : (
            <>
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Нэр</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">Албан тушаал</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">Цалин</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">НДШ (12.5%)</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">ХХОАТ (10%)</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">Гарт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map(s => {
                      const sal = s.salary || 0;
                      const ndsh = Math.round(sal * 0.125);
                      const taxable = sal - ndsh;
                      const hhuat = Math.round(taxable * 0.1);
                      const net = sal - ndsh - hhuat;
                      const r = getRole(s.role);
                      return (
                        <tr key={s.id} className="border-t">
                          <td className="px-4 py-2.5 font-medium">{s.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{r.icon} {r.label}</td>
                          <td className="px-4 py-2.5 text-right">{sal.toLocaleString()}₮</td>
                          <td className="px-4 py-2.5 text-right text-red-500">-{ndsh.toLocaleString()}₮</td>
                          <td className="px-4 py-2.5 text-right text-red-500">-{hhuat.toLocaleString()}₮</td>
                          <td className="px-4 py-2.5 text-right font-bold text-green-600">{net.toLocaleString()}₮</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold">
                    <tr className="border-t-2">
                      <td className="px-4 py-2.5" colSpan={2}>Нийт</td>
                      <td className="px-4 py-2.5 text-right">{active.reduce((s, st) => s + (st.salary || 0), 0).toLocaleString()}₮</td>
                      <td className="px-4 py-2.5 text-right text-red-500">-{active.reduce((s, st) => s + Math.round((st.salary || 0) * 0.125), 0).toLocaleString()}₮</td>
                      <td className="px-4 py-2.5 text-right text-red-500">-{active.reduce((s, st) => { const ndsh = Math.round((st.salary || 0) * 0.125); return s + Math.round(((st.salary || 0) - ndsh) * 0.1); }, 0).toLocaleString()}₮</td>
                      <td className="px-4 py-2.5 text-right text-green-600">{active.reduce((s, st) => { const sal = st.salary || 0; const ndsh = Math.round(sal * 0.125); return s + sal - ndsh - Math.round((sal - ndsh) * 0.1); }, 0).toLocaleString()}₮</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-gray-400">* НДШ 12.5%, ХХОАТ 10% — ойролцоо тооцоо</p>
            </>
          )}
        </div>
      )}

      {activeTab === 'list' && (
      <button onClick={() => { resetForm(); setShowForm(!showForm); }}
        className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 mb-4">
        + Ажилтан нэмэх
      </button>
      )}

      {/* Form */}
      {activeTab === 'list' && showForm && (
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
            <input placeholder="Сарын цалин (₮)" type="number" value={salary}
              onChange={e => setSalary(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
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
      {activeTab === 'list' && loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : activeTab === 'list' ? (
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
                      {s.salary > 0 && <p className="text-xs text-gray-500">💰 {s.salary.toLocaleString()}₮/сар</p>}
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
      ) : null}
    </div>
  );
}
