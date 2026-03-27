'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Resident {
  id: number;
  name: string;
  apartment: string;
  phone: string;
  debt: number;
  sokh_id: number;
}

export default function AdminResidents() {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', apartment: '', phone: '', debt: '0' });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchResidents(); }, []);

  const fetchResidents = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await supabase.from('residents').select('*').eq('sokh_id', sokhId).order('apartment');
    setResidents(data || []);
    setLoading(false);
  };

  const filtered = residents.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.apartment.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', apartment: '', phone: '', debt: '0' });
    setShowForm(true);
  };

  const openEdit = (r: Resident) => {
    setEditId(r.id);
    setForm({ name: r.name, apartment: r.apartment, phone: r.phone || '', debt: String(r.debt) });
    setShowForm(true);
  };

  const saveResident = async () => {
    if (!form.name || !form.apartment) return;
    setSaving(true);

    const payload = {
      name: form.name,
      apartment: form.apartment,
      phone: form.phone || null,
      debt: Number(form.debt) || 0,
    };

    if (editId) {
      await adminFrom('residents').update(payload).eq('id', editId);
    } else {
      await adminFrom('residents').insert([payload]);
    }

    setShowForm(false);
    setSaving(false);
    await fetchResidents();
  };

  const deleteResident = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('residents').delete().eq('id', id);
    await fetchResidents();
  };

  // Excel/CSV импорт
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());

    // CSV формат: name,apartment,phone,debt
    const newResidents = lines.slice(1).map(line => {
      const [name, apartment, phone, debt] = line.split(',').map(s => s.trim().replace(/"/g, ''));
      return { name, apartment, phone: phone || null, debt: Number(debt) || 0 };
    }).filter(r => r.name && r.apartment);

    if (newResidents.length === 0) {
      alert('Файлд өгөгдөл олдсонгүй. CSV формат: name,apartment,phone,debt');
      return;
    }

    const { error } = await adminFrom('residents').insert(newResidents);
    if (error) {
      alert('Алдаа: ' + error);
    } else {
      alert(`${newResidents.length} оршин суугч амжилттай нэмэгдлээ!`);
      await fetchResidents();
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const exportCSV = () => {
    const header = 'name,apartment,phone,debt\n';
    const rows = residents.map(r => `"${r.name}","${r.apartment}","${r.phone || ''}",${r.debt}`).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'residents.csv';
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">👥 Оршин суугчид</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-4 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300">
            📥 Экспорт CSV
          </button>
          <label className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm cursor-pointer hover:bg-green-200">
            📤 Импорт CSV
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
          </label>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            + Нэмэх
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        placeholder="Нэр эсвэл тоотоор хайх..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-2 mb-4 text-sm"
      />

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-3">{editId ? 'Засах' : 'Шинэ оршин суугч'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <input placeholder="Нэр" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Тоот (жнь: A-101)" value={form.apartment} onChange={e => setForm({...form, apartment: e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Утас" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Өр" type="number" value={form.debt} onChange={e => setForm({...form, debt: e.target.value})} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Цуцлах</button>
            <button onClick={saveResident} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Ачаалж байна...</p>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">Нэр</th>
                <th className="px-4 py-3">Тоот</th>
                <th className="px-4 py-3">Утас</th>
                <th className="px-4 py-3 text-right">Өр</th>
                <th className="px-4 py-3 text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm">{r.apartment}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.phone || '-'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${r.debt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {r.debt > 0 ? `${r.debt.toLocaleString()}₮` : '0₮'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(r)} className="text-blue-500 text-sm mr-2 hover:underline">Засах</button>
                    <button onClick={() => deleteResident(r.id)} className="text-red-400 text-sm hover:underline">Устгах</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-gray-400 text-center py-6">Өгөгдөл байхгүй</p>
          )}
        </div>
      )}
    </div>
  );
}
