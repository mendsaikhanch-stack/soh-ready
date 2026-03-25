'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

interface Entity {
  id: number;
  name: string;
  type: string;
  address: string;
  phone: string;
  email: string;
  director: string;
  contract_number: string;
  contract_date: string;
  resident_count: number;
  building_count: number;
  status: string;
  notes: string;
  created_at: string;
}

interface SokhOrg {
  id: number;
  name: string;
  osnaa_entity_id: number | null;
}

const typeOptions = [
  { value: 'kontrol', label: 'Орон сууцны контор', icon: '🏗️' },
  { value: 'khut', label: 'ХҮТ (Хэрэглэгчид Үйлчлэх Төв)', icon: '🏛️' },
  { value: 'sokh', label: 'СӨХ', icon: '🏢' },
  { value: 'other', label: 'Бусад', icon: '🏪' },
];

export default function OsnaaOrganizations() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [sokhOrgs, setSokhOrgs] = useState<SokhOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState('kontrol');
  const [fAddress, setFAddress] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fDirector, setFDirector] = useState('');
  const [fContract, setFContract] = useState('');
  const [fContractDate, setFContractDate] = useState('');
  const [fResidents, setFResidents] = useState('');
  const [fBuildings, setFBuildings] = useState('');
  const [fNotes, setFNotes] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: ent }, { data: sokh }] = await Promise.all([
      supabase.from('osnaa_entities').select('*').order('name'),
      supabase.from('sokh_organizations').select('id, name, osnaa_entity_id').order('name'),
    ]);
    setEntities(ent || []);
    setSokhOrgs(sokh || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFName(''); setFType('kontrol'); setFAddress(''); setFPhone('');
    setFEmail(''); setFDirector(''); setFContract(''); setFContractDate('');
    setFResidents(''); setFBuildings(''); setFNotes('');
    setEditId(null); setShowForm(false);
  };

  const saveEntity = async () => {
    if (!fName) return;
    setSaving(true);

    const record = {
      name: fName,
      type: fType,
      address: fAddress,
      phone: fPhone,
      email: fEmail,
      director: fDirector,
      contract_number: fContract,
      contract_date: fContractDate || null,
      resident_count: Number(fResidents) || 0,
      building_count: Number(fBuildings) || 0,
      notes: fNotes,
      status: 'active',
    };

    if (editId) {
      await adminFrom('osnaa_entities').update(record).eq('id', editId);
    } else {
      await adminFrom('osnaa_entities').insert([record]);
    }

    resetForm();
    setSaving(false);
    await fetchData();
  };

  const editEntity = (e: Entity) => {
    setEditId(e.id);
    setFName(e.name);
    setFType(e.type);
    setFAddress(e.address || '');
    setFPhone(e.phone || '');
    setFEmail(e.email || '');
    setFDirector(e.director || '');
    setFContract(e.contract_number || '');
    setFContractDate(e.contract_date || '');
    setFResidents(String(e.resident_count || ''));
    setFBuildings(String(e.building_count || ''));
    setFNotes(e.notes || '');
    setShowForm(true);
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await adminFrom('osnaa_entities').update({ status: newStatus }).eq('id', id);
    await fetchData();
  };

  const deleteEntity = async (id: number) => {
    if (!confirm('Энэ байгууллагыг устгах уу?')) return;
    await adminFrom('osnaa_entities').delete().eq('id', id);
    await fetchData();
  };

  // СӨХ-г байгууллагад холбох
  const linkSokh = async (sokhId: number, entityId: number | null) => {
    await adminFrom('sokh_organizations').update({ osnaa_entity_id: entityId }).eq('id', sokhId);
    await fetchData();
  };

  const filtered = filterType === 'all' ? entities : entities.filter(e => e.type === filterType);
  const getTypeLabel = (t: string) => typeOptions.find(o => o.value === t) || typeOptions[3];

  const activeCount = entities.filter(e => e.status === 'active').length;
  const totalResidents = entities.reduce((s, e) => s + (e.resident_count || 0), 0);
  const totalBuildings = entities.reduce((s, e) => s + (e.building_count || 0), 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🏢 Байгууллагууд</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-2xl font-bold">{entities.length}</p>
          <p className="text-xs text-gray-500">Нийт байгууллага</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-gray-500">Идэвхтэй</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-2xl font-bold">{totalBuildings}</p>
          <p className="text-xs text-gray-500">Нийт барилга</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-2xl font-bold">{totalResidents.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Нийт айл өрх</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700">
          + Байгууллага нэмэх
        </button>

        <div className="flex gap-1 ml-auto">
          <button onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm ${filterType === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
            Бүгд ({entities.length})
          </button>
          {typeOptions.map(t => {
            const count = entities.filter(e => e.type === t.value).length;
            return (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm ${filterType === t.value ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>
                {t.icon} {t.label.split('(')[0].trim()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-4">
          <h3 className="font-semibold mb-3">{editId ? 'Байгууллага засах' : 'Шинэ байгууллага'}</h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="text" placeholder="Нэр *" value={fName}
              onChange={e => setFName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm col-span-2" />
            <select value={fType} onChange={e => setFType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {typeOptions.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="text" placeholder="Хаяг" value={fAddress}
              onChange={e => setFAddress(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" placeholder="Утас" value={fPhone}
              onChange={e => setFPhone(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" placeholder="И-мэйл" value={fEmail}
              onChange={e => setFEmail(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="text" placeholder="Захирал/Дарга" value={fDirector}
              onChange={e => setFDirector(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" placeholder="Гэрээний дугаар" value={fContract}
              onChange={e => setFContract(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="date" placeholder="Гэрээний огноо" value={fContractDate}
              onChange={e => setFContractDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input type="number" placeholder="Барилгын тоо" value={fBuildings}
              onChange={e => setFBuildings(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="number" placeholder="Айлын тоо" value={fResidents}
              onChange={e => setFResidents(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input type="text" placeholder="Тэмдэглэл" value={fNotes}
              onChange={e => setFNotes(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={saveEntity} disabled={saving || !fName}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm disabled:opacity-50">
              {saving ? 'Хадгалж байна...' : editId ? 'Хадгалах' : 'Нэмэх'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">
          Байгууллага бүртгэлгүй
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const tp = getTypeLabel(e.type);
            const linkedSokhs = sokhOrgs.filter(s => s.osnaa_entity_id === e.id);
            const isExpanded = expandedId === e.id;

            return (
              <div key={e.id} className={`bg-white border rounded-xl overflow-hidden ${e.status === 'inactive' ? 'opacity-60' : ''}`}>
                {/* Header */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                  <span className="text-2xl">{tp.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{e.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {e.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">
                        {tp.label.split('(')[0].trim()}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                      {e.director && <span>👤 {e.director}</span>}
                      {e.phone && <span>📞 {e.phone}</span>}
                      {e.building_count > 0 && <span>🏢 {e.building_count} барилга</span>}
                      {e.resident_count > 0 && <span>👥 {e.resident_count} айл</span>}
                      {linkedSokhs.length > 0 && <span>🔗 {linkedSokhs.length} СӨХ холбогдсон</span>}
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Хаяг</p>
                        <p>{e.address || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">И-мэйл</p>
                        <p>{e.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Гэрээ</p>
                        <p>{e.contract_number || '-'} {e.contract_date ? `(${e.contract_date})` : ''}</p>
                      </div>
                    </div>

                    {e.notes && (
                      <div className="mb-4 text-sm">
                        <p className="text-xs text-gray-400">Тэмдэглэл</p>
                        <p>{e.notes}</p>
                      </div>
                    )}

                    {/* Холбогдсон СӨХ-үүд */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-400 mb-2">Холбогдсон СӨХ-үүд</p>
                      {linkedSokhs.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {linkedSokhs.map(s => (
                            <span key={s.id} className="px-3 py-1 bg-white border rounded-lg text-sm flex items-center gap-1">
                              🏢 {s.name}
                              <button onClick={() => linkSokh(s.id, null)} className="text-red-400 ml-1 text-xs">✕</button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">СӨХ холбогдоогүй</p>
                      )}

                      {/* Холбох */}
                      {sokhOrgs.filter(s => !s.osnaa_entity_id).length > 0 && (
                        <div className="mt-2">
                          <select
                            onChange={ev => { if (ev.target.value) { linkSokh(Number(ev.target.value), e.id); ev.target.value = ''; } }}
                            className="border rounded-lg px-3 py-1.5 text-sm"
                            defaultValue=""
                          >
                            <option value="">+ СӨХ холбох...</option>
                            {sokhOrgs.filter(s => !s.osnaa_entity_id).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => editEntity(e)}
                        className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                        Засах
                      </button>
                      <button onClick={() => toggleStatus(e.id, e.status)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                        {e.status === 'active' ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
                      </button>
                      <button onClick={() => deleteEntity(e.id)}
                        className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium">
                        Устгах
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
