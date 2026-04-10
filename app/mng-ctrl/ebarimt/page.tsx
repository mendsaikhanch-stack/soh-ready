'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

interface EbarimtConfig {
  id: number;
  entity_type: string;
  entity_id: number | null;
  merchant_tin: string;
  pos_no: string;
  branch_id: string;
  client_id: string;
  client_secret: string;
  auth_url: string;
  api_url: string;
  is_active: boolean;
  entity_name?: string;
}

const ENTITY_TYPES = [
  { value: 'platform', label: 'Хотол платформ', icon: '🏠' },
  { value: 'sokh', label: 'СӨХ', icon: '🏢' },
  { value: 'osnaa', label: 'ОСНАА', icon: '🏗️' },
  { value: 'tsah', label: 'Цахилгаан', icon: '⚡' },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  platform: 'Хотол платформ',
  sokh: 'СӨХ',
  osnaa: 'ОСНАА',
  tsah: 'Цахилгаан',
};

export default function EbarimtPage() {
  const [configs, setConfigs] = useState<EbarimtConfig[]>([]);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entity_type: 'sokh',
    entity_id: '' as string,
    merchant_tin: '',
    pos_no: '',
    branch_id: '',
    client_id: '',
    client_secret: '',
    auth_url: 'https://auth.itc.gov.mn/auth/realms/Production/protocol/openid-connect/token',
    api_url: 'https://api.ebarimt.mn',
  });

  const fetchData = async () => {
    const [configRes, orgRes] = await Promise.all([
      fetch('/api/superadmin/ebarimt').then(r => r.json()),
      supabase.from('sokh_organizations').select('id, name').order('name'),
    ]);
    setConfigs(Array.isArray(configRes) ? configRes : []);
    setOrgs(orgRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/superadmin/ebarimt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        entity_id: form.entity_id ? parseInt(form.entity_id, 10) : null,
      }),
    });
    setShowForm(false);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Идэвхгүй болгох уу?')) return;
    await fetch(`/api/superadmin/ebarimt?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const needsEntityId = form.entity_type === 'sokh';

  if (loading) {
    return <div className="p-8"><p className="text-gray-400">Ачаалж байна...</p></div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">eBarimt тохиргоо</h1>
          <p className="text-sm text-gray-500 mt-1">СӨХ, ОСНАА, ЦАХ тус бүрийн НӨАТ баримтын тохиргоо</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
          + Тохиргоо нэмэх
        </button>
      </div>

      {/* Тайлбар */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Хэрхэн ажиллах:</strong> QPay-р төлбөр төлөгдмөгц тухайн байгууллагын eBarimt тохиргоогоор автоматаар НӨАТ баримт үүсч, хэрэглэгчид QR код харагдана.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Байгууллага бүр өөрийн ТТД, POS бүртгэлтэй байна. Тохиргоо хийгдээгүй байгууллагад баримт үүсэхгүй (төлбөр хэвийн ажиллана).
        </p>
      </div>

      {/* Жагсаалт */}
      {configs.length === 0 ? (
        <div className="bg-white rounded-2xl border p-8 text-center">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-gray-500">eBarimt тохиргоо бүртгэгдээгүй</p>
          <p className="text-xs text-gray-400 mt-1">POS бүртгэл бэлэн болмогц энд нэмнэ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.filter(c => c.is_active).map(config => {
            const typeInfo = ENTITY_TYPES.find(t => t.value === config.entity_type);
            return (
              <div key={config.id} className="bg-white rounded-2xl border p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
                    {typeInfo?.icon || '🧾'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{ENTITY_TYPE_LABELS[config.entity_type] || config.entity_type}</p>
                      {config.entity_name && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{config.entity_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">ТТД: {config.merchant_tin} &middot; POS: {config.pos_no}</p>
                    <p className="text-xs text-gray-400">Client: {config.client_id}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(config.id)} className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                  Устгах
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">eBarimt тохиргоо нэмэх</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Байгууллагын төрөл</label>
                <select value={form.entity_type} onChange={e => setForm(f => ({ ...f, entity_type: e.target.value, entity_id: '' }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm">
                  {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
              </div>

              {needsEntityId && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">СӨХ сонгох</label>
                  <select value={form.entity_id} onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm">
                    <option value="">-- Сонгох --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">ТТД (Татвар төлөгчийн дугаар)</label>
                <input value={form.merchant_tin} onChange={e => setForm(f => ({ ...f, merchant_tin: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="1234567" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">POS дугаар</label>
                  <input value={form.pos_no} onChange={e => setForm(f => ({ ...f, pos_no: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Салбарын дугаар</label>
                  <input value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Client ID</label>
                <input value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Client Secret</label>
                <input type="password" value={form.client_secret} onChange={e => setForm(f => ({ ...f, client_secret: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" />
              </div>

              <details className="text-sm">
                <summary className="text-gray-500 cursor-pointer">Нэмэлт тохиргоо (API URL)</summary>
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Auth URL</label>
                    <input value={form.auth_url} onChange={e => setForm(f => ({ ...f, auth_url: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">API URL</label>
                    <input value={form.api_url} onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-xs" />
                  </div>
                </div>
              </details>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Болих</button>
              <button onClick={handleSave} disabled={saving || !form.merchant_tin || !form.client_id || !form.client_secret}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
