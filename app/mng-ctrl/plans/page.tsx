'use client';

import { useState, useEffect } from 'react';
import type { PlatformPlan, PlanType, SokhTier } from '@/app/lib/types/billing';
import { PLAN_TYPE_LABELS } from '@/app/lib/types/billing';

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: 'fixed_monthly', label: 'Тогтмол сарын' },
  { value: 'per_apartment', label: 'Айл тутамд' },
  { value: 'per_transaction', label: 'Гүйлгээний комисс' },
  { value: 'one_time', label: 'Нэг удаагийн' },
  { value: 'hybrid', label: 'Хосолсон' },
];

const FEATURES = [
  { key: 'basic', label: 'Үндсэн' },
  { key: 'qpay', label: 'QPay төлбөр' },
  { key: 'push', label: 'Push мэдэгдэл' },
  { key: 'reports', label: 'Тайлан' },
  { key: 'analytics', label: 'Аналитик' },
  { key: 'priority_support', label: 'Тусгай дэмжлэг' },
];

const emptyPlan = {
  name: '', type: 'fixed_monthly' as PlanType, base_fee: 0, per_unit_fee: 0,
  commission_percent: 0, billing_cycle: 'monthly' as string, features: ['basic'] as string[],
  description: '', sort_order: 0,
};

export default function PlansPage() {
  const [tab, setTab] = useState<'tariff' | 'plans' | 'tiers'>('tariff');
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [tiers, setTiers] = useState<SokhTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);

  // Тариф — БҮХ СӨХ-д ижил үйлчилдэг ганц бүртгэл (багц шиг олон биш)
  const [tariff, setTariff] = useState({
    setup_per_unit: 1500, monthly_per_unit: 1000,
    free_months_threshold: 150, free_months_below: 1, free_months_above: 2,
  });
  const [tariffMigrated, setTariffMigrated] = useState(true);
  const [tariffSaving, setTariffSaving] = useState(false);
  const [tariffMsg, setTariffMsg] = useState('');

  // Зэрэглэл state
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<SokhTier | null>(null);
  const [tierForm, setTierForm] = useState({ name: '', code: '', per_unit_fee: 0, description: '' });

  const fetchPlans = async () => {
    const res = await fetch('/api/superadmin/plans');
    const data = await res.json();
    setPlans(Array.isArray(data) ? data : []);
  };

  const fetchTiers = async () => {
    const res = await fetch('/api/superadmin/tiers');
    const data = await res.json();
    setTiers(Array.isArray(data) ? data : []);
  };

  const fetchTariff = async () => {
    const res = await fetch('/api/superadmin/tariff');
    const data = await res.json();
    if (data && !data.error) {
      const { migrated, ...values } = data;
      setTariffMigrated(migrated !== false);
      setTariff(t => ({ ...t, ...values }));
    }
  };

  const saveTariff = async () => {
    setTariffSaving(true);
    setTariffMsg('');
    const res = await fetch('/api/superadmin/tariff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tariff),
    });
    const data = await res.json();
    setTariffSaving(false);
    if (data.error) { setTariffMsg(data.error); return; }
    setTariffMsg('Хадгаллаа ✓');
    await fetchTariff();
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchPlans(), fetchTiers(), fetchTariff()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyPlan);
    setShowModal(true);
  };

  const openEdit = (plan: PlatformPlan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      type: plan.type,
      base_fee: plan.base_fee,
      per_unit_fee: plan.per_unit_fee,
      commission_percent: plan.commission_percent,
      billing_cycle: plan.billing_cycle as 'monthly' | 'yearly',
      features: plan.features || ['basic'],
      description: plan.description || '',
      sort_order: plan.sort_order,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;

    await fetch('/api/superadmin/plans', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setShowModal(false);
    setSaving(false);
    fetchPlans();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Энэ багцыг идэвхгүй болгох уу?')) return;
    await fetch(`/api/superadmin/plans?id=${id}`, { method: 'DELETE' });
    fetchPlans();
  };

  const toggleFeature = (key: string) => {
    setForm(f => ({
      ...f,
      features: f.features.includes(key)
        ? f.features.filter(k => k !== key)
        : [...f.features, key],
    }));
  };

  const showBase = form.type !== 'per_transaction';
  const showPerUnit = form.type === 'per_apartment' || form.type === 'hybrid';
  const showCommission = form.type === 'per_transaction' || form.type === 'hybrid';

  const fmt = (n: number) => n.toLocaleString('mn-MN') + '₮';

  if (loading) {
    return <div className="p-8"><p className="text-gray-400">Ачаалж байна...</p></div>;
  }

  const openCreateTier = () => {
    setEditingTier(null);
    setTierForm({ name: '', code: '', per_unit_fee: 0, description: '' });
    setShowTierModal(true);
  };

  const openEditTier = (tier: SokhTier) => {
    setEditingTier(tier);
    setTierForm({ name: tier.name, code: tier.code, per_unit_fee: tier.per_unit_fee, description: tier.description || '' });
    setShowTierModal(true);
  };

  const handleSaveTier = async () => {
    setSaving(true);
    const method = editingTier ? 'PUT' : 'POST';
    const body = editingTier ? { id: editingTier.id, ...tierForm } : tierForm;
    await fetch('/api/superadmin/tiers', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowTierModal(false);
    setSaving(false);
    fetchTiers();
  };

  const handleDeleteTier = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    const res = await fetch(`/api/superadmin/tiers?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    fetchTiers();
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Багц & Зэрэглэл</h1>
          <p className="text-sm text-gray-500 mt-1">Төлбөрийн багцууд болон СӨХ-ийн зэрэглэл</p>
        </div>
        {tab !== 'tariff' && (
          <button onClick={tab === 'plans' ? openCreate : openCreateTier}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">
            + {tab === 'plans' ? 'Багц нэмэх' : 'Зэрэглэл нэмэх'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('tariff')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'tariff' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Тариф
        </button>
        <button onClick={() => setTab('plans')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'plans' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Багцууд
        </button>
        <button onClick={() => setTab('tiers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'tiers' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          Зэрэглэлүүд
        </button>
      </div>

      {/* Тариф — Хотол → СӨХ-өөс авах төлбөр */}
      {tab === 'tariff' && (
        <div className="max-w-2xl">
          {!tariffMigrated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-amber-800">⚠️ Тарифын хүснэгт үүсээгүй байна</p>
              <p className="text-xs text-amber-700 mt-1">
                Доорх нь үндсэн утга. Хадгалахын тулд{' '}
                <code className="bg-amber-100 px-1 rounded">supabase-platform-tariff-migration.sql</code>-ийг
                Supabase → SQL Editor дээр ажиллуулна уу.
              </p>
            </div>
          )}

          <div className="bg-white border rounded-2xl p-5">
            <h2 className="font-bold mb-1">Хотолын тариф</h2>
            <p className="text-xs text-gray-500 mb-5">
              Бүх СӨХ-д ижил үйлчилнэ. Энд өөрчилсөн дүн шинээр үүсэх нэхэмжлэлд шууд тусна —
              өмнө үүссэн нэхэмжлэл хэвээр үлдэнэ.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Суурилуулалт — нэг айлд (₮)
                </label>
                <input type="number" min={0} value={tariff.setup_per_unit}
                  onChange={e => setTariff(t => ({ ...t, setup_per_unit: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">Нэг удаа авна</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Сарын хураамж — нэг айлд (₮)
                </label>
                <input type="number" min={0} value={tariff.monthly_per_unit}
                  onChange={e => setTariff(t => ({ ...t, monthly_per_unit: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-[11px] text-gray-400 mt-1">Сар бүр авна</p>
              </div>
            </div>

            <div className="border-t mt-5 pt-5">
              <p className="text-xs font-medium text-gray-600 mb-3">Үнэгүй ашиглах хугацаа</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Айлын хязгаар</label>
                  <input type="number" min={1} value={tariff.free_months_threshold}
                    onChange={e => setTariff(t => ({ ...t, free_months_threshold: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Хязгаараас доош (сар)</label>
                  <input type="number" min={0} value={tariff.free_months_below}
                    onChange={e => setTariff(t => ({ ...t, free_months_below: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Түүнээс их (сар)</label>
                  <input type="number" min={0} value={tariff.free_months_above}
                    onChange={e => setTariff(t => ({ ...t, free_months_above: Number(e.target.value) }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                {tariff.free_months_threshold} айлаас доош бол {tariff.free_months_below} сар,
                түүнээс их бол {tariff.free_months_above} сар үнэгүй. Идэвхжсэн өдрөөс тоолно.
              </p>
            </div>

            {/* Жишээ тооцоо — тоо солиход шууд хэрхэн өөрчлөгдөхийг харуулна */}
            <div className="bg-gray-50 rounded-xl p-3 mt-5">
              <p className="text-[11px] font-semibold text-gray-600 mb-2">Жишээ</p>
              {[43, 111, 332].map(n => (
                <div key={n} className="flex justify-between text-xs text-gray-600 py-0.5">
                  <span>{n} айлтай СӨХ</span>
                  <span>
                    суурилуулалт <b>{(n * tariff.setup_per_unit).toLocaleString()}₮</b> ·
                    сард <b>{(n * tariff.monthly_per_unit).toLocaleString()}₮</b> ·
                    үнэгүй {n < tariff.free_months_threshold ? tariff.free_months_below : tariff.free_months_above} сар
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button onClick={saveTariff} disabled={tariffSaving}
                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {tariffSaving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
              {tariffMsg && (
                <span className={`text-sm ${tariffMsg.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                  {tariffMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Зэрэглэлүүд */}
      {tab === 'tiers' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tiers.map(tier => (
              <div key={tier.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{tier.name}</h3>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{tier.code}</span>
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600 my-3">{fmt(tier.per_unit_fee)}<span className="text-sm text-gray-400 font-normal">/айл</span></p>
                {tier.description && <p className="text-xs text-gray-400 mb-3">{tier.description}</p>}
                <div className="flex gap-2">
                  <button onClick={() => openEditTier(tier)} className="flex-1 text-sm text-blue-600 hover:bg-blue-50 py-2 rounded-lg">Засах</button>
                  <button onClick={() => handleDeleteTier(tier.id)} className="flex-1 text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg">Устгах</button>
                </div>
              </div>
            ))}
            {tiers.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl border p-8 text-center">
                <p className="text-gray-400">Зэрэглэл бүртгэгдээгүй</p>
                <button onClick={openCreateTier} className="mt-2 text-blue-600 text-sm font-semibold hover:underline">Эхний зэрэглэл нэмэх</button>
              </div>
            )}
          </div>

          {/* Tier Modal */}
          {showTierModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold mb-4">{editingTier ? 'Зэрэглэл засах' : 'Шинэ зэрэглэл'}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Нэр</label>
                    <input value={tierForm.name} onChange={e => setTierForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Жишээ: Төв бүс, А зэрэглэл" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Код</label>
                    <input value={tierForm.code} onChange={e => setTierForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Жишээ: A, B, C" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Айл тутмын төлбөр (₮)</label>
                    <input type="number" value={tierForm.per_unit_fee} onChange={e => setTierForm(f => ({ ...f, per_unit_fee: +e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Тайлбар</label>
                    <input value={tierForm.description} onChange={e => setTierForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Нэмэлт тайлбар..." />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowTierModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Болих</button>
                  <button onClick={handleSaveTier} disabled={saving || !tierForm.name || !tierForm.code}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Багцууд */}
      {tab === 'plans' && (<>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.filter(p => p.is_active).map(plan => (
          <div key={plan.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {PLAN_TYPE_LABELS[plan.type]}
                </span>
              </div>
              <span className="text-xs text-gray-400">#{plan.id}</span>
            </div>

            <div className="space-y-1 text-sm text-gray-600 mb-3">
              {plan.base_fee > 0 && <p>Суурь: <strong>{fmt(plan.base_fee)}</strong>/сар</p>}
              {plan.per_unit_fee > 0 && <p>Айл тутам: <strong>{fmt(plan.per_unit_fee)}</strong></p>}
              {plan.commission_percent > 0 && <p>Комисс: <strong>{plan.commission_percent}%</strong></p>}
              {plan.billing_cycle === 'yearly' && <p className="text-orange-600">Жилийн төлбөр</p>}
            </div>

            {plan.description && (
              <p className="text-xs text-gray-400 mb-3">{plan.description}</p>
            )}

            <div className="flex flex-wrap gap-1 mb-4">
              {(plan.features || []).map(f => (
                <span key={f} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {FEATURES.find(x => x.key === f)?.label || f}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => openEdit(plan)} className="flex-1 text-sm text-blue-600 hover:bg-blue-50 py-2 rounded-lg">
                Засах
              </button>
              <button onClick={() => handleDelete(plan.id)} className="flex-1 text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg">
                Устгах
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Багц засах' : 'Шинэ багц'}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Нэр</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Жишээ: Стандарт" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Төрөл</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as PlanType }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm">
                  {PLAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {showBase && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Суурь төлбөр (₮)</label>
                  <input type="number" value={form.base_fee} onChange={e => setForm(f => ({ ...f, base_fee: +e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              )}

              {showPerUnit && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Айл тутмын төлбөр (₮)</label>
                  <input type="number" value={form.per_unit_fee} onChange={e => setForm(f => ({ ...f, per_unit_fee: +e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              )}

              {showCommission && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Комисс хувь (%)</label>
                  <input type="number" step="0.1" value={form.commission_percent}
                    onChange={e => setForm(f => ({ ...f, commission_percent: +e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm" />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Тооцооны давтамж</label>
                <select value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value as 'monthly' | 'yearly' }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm">
                  <option value="monthly">Сар бүр</option>
                  <option value="yearly">Жил бүр</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Тодорхойлолт</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Богино тайлбар..." />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Боломжууд</label>
                <div className="flex flex-wrap gap-2">
                  {FEATURES.map(f => (
                    <button key={f.key} onClick={() => toggleFeature(f.key)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        form.features.includes(f.key)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                Болих
              </button>
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
