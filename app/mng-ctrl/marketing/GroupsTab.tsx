'use client';

import { useState, useEffect, useCallback } from 'react';
import { mkt } from '@/app/lib/marketing-client';
import {
  GROUP_TYPES,
  PRIORITIES,
  GROUP_STATUSES,
  groupTypeMeta,
  priorityMeta,
  groupStatusMeta,
} from '@/app/lib/marketing/constants';
import type { FbGroup } from '@/app/lib/marketing/constants';

export default function GroupsTab() {
  const [groups, setGroups] = useState<FbGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // single form
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [groupType, setGroupType] = useState('general');
  const [priority, setPriority] = useState('B');
  const [status, setStatus] = useState('active');
  const [memberCount, setMemberCount] = useState('');
  const [notes, setNotes] = useState('');

  // bulk
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('general');
  const [bulkPrio, setBulkPrio] = useState('B');

  // filter
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async () => {
    const res = await mkt.groups.list();
    setGroups(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetForm = () => {
    setName(''); setUrl(''); setGroupType('general'); setPriority('B');
    setStatus('active'); setMemberCount(''); setNotes(''); setEditId(null); setShowForm(false); setErr('');
  };

  const save = async () => {
    if (!name || !url) return;
    setSaving(true); setErr('');
    const payload = {
      name, url, group_type: groupType as FbGroup['group_type'],
      priority: priority as FbGroup['priority'], status: status as FbGroup['status'],
      member_count: memberCount ? Number(memberCount) : null, notes: notes || null,
    };
    const res = editId
      ? await mkt.groups.update(editId, payload)
      : await mkt.groups.create(payload);
    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    resetForm();
    await load();
  };

  const saveBulk = async () => {
    if (!bulkText.trim()) return;
    setSaving(true); setErr('');
    const res = await mkt.groups.bulk(bulkText, bulkType, bulkPrio);
    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    setBulkText(''); setShowBulk(false);
    await load();
  };

  const edit = (g: FbGroup) => {
    setEditId(g.id); setName(g.name); setUrl(g.url); setGroupType(g.group_type);
    setPriority(g.priority); setStatus(g.status);
    setMemberCount(g.member_count ? String(g.member_count) : ''); setNotes(g.notes || '');
    setShowForm(true); setShowBulk(false);
  };

  const remove = async (id: number) => {
    if (!confirm('Группийг устгах уу? (Холбоотой постын дараалал, лидийн холбоос арилна)')) return;
    await mkt.groups.remove(id);
    await load();
  };

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('mn-MN') : '—');
  const filtered = filterType ? groups.filter((g) => g.group_type === filterType) : groups;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => { resetForm(); setShowForm(true); setShowBulk(false); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Групп нэмэх
        </button>
        <button onClick={() => { setShowBulk(!showBulk); setShowForm(false); setErr(''); }}
          className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          📋 Бөөнөөр оруулах
        </button>
        <div className="flex-1" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Бүх төрөл ({groups.length})</option>
          {GROUP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.icon} {t.label} ({groups.filter((g) => g.group_type === t.value).length})
            </option>
          ))}
        </select>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-3">{err}</div>}

      {/* Bulk paste */}
      {showBulk && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Бөөнөөр оруулах</h3>
          <p className="text-xs text-gray-500 mb-2">
            Мөр бүрд нэг групп. Зүгээр URL эсвэл &quot;Нэр | URL&quot; хэлбэрээр. Давхардсан URL автоматаар алгасна.
          </p>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6}
            placeholder={'СӨХ нийгэмлэг | https://facebook.com/groups/123\nhttps://facebook.com/groups/456'}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            <span className="text-xs text-gray-500">Бүгдэд:</span>
            <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
              {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <select value={bulkPrio} onChange={(e) => setBulkPrio(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div className="flex-1" />
            <button onClick={() => setShowBulk(false)} className="px-3 py-1.5 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={saveBulk} disabled={saving || !bulkText.trim()}
              className="px-4 py-1.5 rounded-lg bg-gray-700 text-white text-sm disabled:opacity-50">
              {saving ? '...' : 'Оруулах'}
            </button>
          </div>
        </div>
      )}

      {/* Single form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">{editId ? 'Групп засах' : 'Шинэ групп'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Группийн нэр" value={name} onChange={(e) => setName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Facebook URL" value={url} onChange={(e) => setUrl(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm" />
            <select value={groupType} onChange={(e) => setGroupType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              {GROUP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input placeholder="Гишүүдийн тоо (заавал биш)" type="number" value={memberCount}
              onChange={(e) => setMemberCount(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Тэмдэглэл" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm col-span-2" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={save} disabled={saving || !name || !url}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
              {saving ? '...' : editId ? 'Хадгалах' : 'Нэмэх'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Групп байхгүй. Дээрээс нэмнэ үү.</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Групп</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Төрөл</th>
                <th className="text-center px-3 py-2 text-xs text-gray-500">Зэрэг</th>
                <th className="text-center px-3 py-2 text-xs text-gray-500">Төлөв</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Пост</th>
                <th className="text-right px-3 py-2 text-xs text-gray-500">Лид</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500">Сүүлд постолсон</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const t = groupTypeMeta(g.group_type);
                const p = priorityMeta(g.priority);
                const s = groupStatusMeta(g.status);
                return (
                  <tr key={g.id} className="border-t">
                    <td className="px-3 py-2.5">
                      <a href={g.url} target="_blank" rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline">{g.name}</a>
                      {g.notes && <p className="text-xs text-gray-400">{g.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{t.icon} {t.label}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.cls}`}>{g.priority}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{g.posts_count}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-purple-600">{g.leads_count}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{fmtDate(g.last_posted_at)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => edit(g)} className="text-xs text-blue-500 hover:underline mr-2">Засах</button>
                      <button onClick={() => remove(g.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
