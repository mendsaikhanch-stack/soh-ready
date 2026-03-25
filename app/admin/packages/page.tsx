'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface Package {
  id: number; resident_name: string; unit_number: string; carrier: string;
  description: string; pickup_code: string; status: string; delivered_at: string; picked_up_at: string | null;
}

export default function AdminPackages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [carrier, setCarrier] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => { fetch(); }, []);
  const fetch = async () => {
    const { data } = await supabase.from('packages').select('*').order('delivered_at', { ascending: false });
    setPackages(data || []); setLoading(false);
  };

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const addPackage = async () => {
    if (!name || !unit) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('packages').insert([{
      sokh_id: sokhId, resident_name: name, unit_number: unit, carrier, description: desc,
      pickup_code: generateCode(), status: 'delivered', delivered_at: new Date().toISOString(),
    }]);
    setName(''); setUnit(''); setCarrier(''); setDesc('');
    setShowForm(false); setSaving(false);
    await fetch();
  };

  const markPickedUp = async (id: number) => {
    await adminFrom('packages').update({ status: 'picked_up', picked_up_at: new Date().toISOString() }).eq('id', id);
    await fetch();
  };

  const del = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('packages').delete().eq('id', id);
    await fetch();
  };

  const filtered = filter === 'all' ? packages : packages.filter(p => p.status === filter);
  const pending = packages.filter(p => p.status === 'delivered').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📦 Илгээмж удирдлага</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`rounded-xl border-2 p-4 ${pending > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-2xl font-bold text-orange-600">{pending}</p>
          <p className="text-xs text-gray-500">Хүлээгдэж буй</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-2xl font-bold text-green-600">{packages.filter(p => p.status === 'picked_up').length}</p>
          <p className="text-xs text-gray-500">Авсан</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-2xl font-bold text-blue-700">{packages.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <button onClick={() => setShowForm(!showForm)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          + Илгээмж бүртгэх
        </button>
        <div className="flex gap-2 ml-auto">
          {[['all','Бүгд'],['delivered','Хүлээгдэж буй'],['picked_up','Авсан']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === v ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}>{l}</button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <div className="grid grid-cols-5 gap-3">
            <input placeholder="Хүлээн авагч нэр" value={name} onChange={e => setName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Тоот" value={unit} onChange={e => setUnit(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Хүргэлтийн компани" value={carrier} onChange={e => setCarrier(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Тайлбар" value={desc} onChange={e => setDesc(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={addPackage} disabled={saving || !name || !unit}
                className="flex-1 py-2 rounded-lg bg-orange-600 text-white text-sm disabled:opacity-50">{saving ? '...' : 'Бүртгэх'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Хүлээн авагч</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Тоот</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Компани</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Код</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Ирсэн</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500">Төлөв</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{p.resident_name}</td>
                  <td className="px-4 py-3">{p.unit_number}</td>
                  <td className="px-4 py-3">{p.carrier || '-'}</td>
                  <td className="px-4 py-3 font-mono font-bold">{p.pickup_code}</td>
                  <td className="px-4 py-3 text-xs">{new Date(p.delivered_at).toLocaleString('mn-MN')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'delivered' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {p.status === 'delivered' ? 'Хүлээгдэж буй' : 'Авсан'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    {p.status === 'delivered' && (
                      <button onClick={() => markPickedUp(p.id)} className="text-xs text-green-600 hover:underline">✅ Авсан</button>
                    )}
                    <button onClick={() => del(p.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Илгээмж байхгүй</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
