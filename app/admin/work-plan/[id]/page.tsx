'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { compressImage } from '@/app/lib/compress-image';
import BoardReportFiles from '@/app/components/BoardReportFiles';
import {
  CATEGORIES,
  ITEM_STATUS,
  PLAN_STATUS,
  QUARTER_LABEL,
  RATING_LABEL,
  WORK_PLAN_BUCKET,
  planTotals,
  type ItemOut,
  type ItemStatus,
  type PlanOut,
} from '@/app/lib/work-plan/shared';

// Дарга — нэг төлөвлөгөө: ажил нэмэх/засах (ноорог), ТУЗ-д илгээх, санал харах,
// гүйцэтгэл тайлагнах + зураг/баримт (батлагдсан), жилийн дүгнэлт.

const money = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString()}₮`;
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm';
const ACCEPT = 'image/*,.pdf,.xlsx,.xls,.docx,.doc';

async function api(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch('/api/admin/work-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

async function prepare(file: File): Promise<{ blob: Blob; name: string; type: string }> {
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
    const blob = await compressImage(file);
    if (blob !== file) return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
  }
  return { blob: file, name: file.name, type: file.type || 'application/octet-stream' };
}

interface ItemForm { title: string; quarter: number; category: string; owner: string; budget: string; description: string }
const emptyForm = (quarter = 1): ItemForm => ({ title: '', quarter, category: 'repair', owner: '', budget: '', description: '' });

export default function AdminWorkPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const planId = Number(id);
  const router = useRouter();
  const [plan, setPlan] = useState<PlanOut | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [head, setHead] = useState({ title: '', intro: '' });
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState<ItemForm | null>(null);
  const [editing, setEditing] = useState<{ id: number; f: ItemForm } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/work-plan?id=${planId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Ачаалж чадсангүй'); return; }
    const p = data.plan as PlanOut;
    setPlan(p);
    setHead({ title: p.title, intro: p.intro || '' });
    setSummary(p.summary || '');
  }, [planId]);
  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return false;
    setBusy(true); setError('');
    const { ok, data } = await api({ planId, ...body });
    setBusy(false);
    if (!ok) { setError(String(data.error || 'Алдаа гарлаа')); return false; }
    await load();
    return true;
  };

  if (!plan) {
    return (
      <div className="p-6">
        <Link href="/admin/work-plan" className="text-sm text-blue-600">← Ажлын төлөвлөгөө</Link>
        <p className="text-gray-400 mt-4">{error || 'Ачаалж байна...'}</p>
      </div>
    );
  }

  const isDraft = plan.status === 'draft';
  const isApproved = plan.status === 'approved';
  const st = PLAN_STATUS[plan.status];
  const t = planTotals(plan.items);
  const approvals = (plan.reviews || []).filter((r) => r.decision === 'approve').length;
  const need = Math.floor((plan.board_size || 0) / 2) + 1;

  const saveItem = async (f: ItemForm, itemId?: number) => {
    const ok = await act({ action: itemId ? 'update_item' : 'add_item', itemId, ...f });
    if (ok) { setAdding(null); setEditing(null); }
  };

  return (
    <div className="p-6 max-w-4xl">
      <Link href="/admin/work-plan" className="text-sm text-blue-600">← Ажлын төлөвлөгөө</Link>

      <div className="flex items-start gap-3 mt-2">
        <h1 className="text-2xl font-bold flex-1">{plan.title}</h1>
        <span className={`text-xs font-semibold px-2 py-1 rounded ${st.cls}`}>{st.label}</span>
      </div>
      <p className="text-sm text-gray-500 mt-1">
        {t.count} ажил · {t.done} хийгдсэн · төсөв {money(t.budget)} · бодит зардал {money(t.actual)}
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mt-4">{error}</div>}

      {/* ---------- Төлөвийн удирдлага ---------- */}
      <div className="bg-white border rounded-xl p-4 mt-4 space-y-3">
        {isDraft && (
          <>
            <input className={inputCls} value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} placeholder="Гарчиг" />
            <textarea className={inputCls} rows={3} value={head.intro} onChange={(e) => setHead({ ...head, intro: e.target.value })}
              placeholder="Танилцуулга: энэ жилийн гол зорилго, тэргүүлэх чиглэл (оршин суугчдад харагдана)" />
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act({ action: 'update_plan', title: head.title, intro: head.intro })}
                className="px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50">Хадгалах</button>
              <button disabled={busy || plan.items.length === 0}
                onClick={() => act({ action: 'submit' }, 'Төлөвлөгөөг ТУЗ-д батлуулахаар илгээх үү? Илгээсний дараа засахын тулд буцааж ноорог болгоно.')}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50">ТУЗ-д илгээх →</button>
              {plan.revision === 0 && (
                <button disabled={busy}
                  onClick={async () => { if (await act({ action: 'delete_plan' }, 'Ноорог төлөвлөгөөг бүхэлд нь устгах уу?')) router.push('/admin/work-plan'); }}
                  className="px-4 py-2 rounded-lg text-sm text-red-600 ml-auto">Устгах</button>
              )}
            </div>
            {plan.revision > 0 && <p className="text-xs text-amber-700">Засварласны дараа дахин «ТУЗ-д илгээх» дарна. ТУЗ шинэ хувилбарт дахин санал өгнө.</p>}
          </>
        )}

        {plan.status === 'review' && (
          <>
            <p className="text-sm font-semibold">ТУЗ-ийн санал: {approvals}/{need} батлах санал хэрэгтэй (ТУЗ {plan.board_size || 0} гишүүн)</p>
            {(plan.board_size || 0) === 0 && (
              <p className="text-xs text-amber-700">ТУЗ-ийн гишүүн бүртгэгдээгүй байна — <Link href="/admin/board" className="underline">Цахим ТУЗ</Link>-ээс нэмнэ үү, эсвэл доор хурлаар баталсныг тэмдэглэнэ үү.</p>
            )}
            {(plan.reviews || []).length === 0 ? (
              <p className="text-xs text-gray-400">Одоогоор санал ирээгүй. ТУЗ-ийн гишүүд апп-ын «🏛 Зөвлөл → 📅 Төлөвлөгөө»-өөс санал өгнө.</p>
            ) : (
              <div className="space-y-1">
                {(plan.reviews || []).map((r, i) => (
                  <p key={i} className="text-sm"><b>{r.member_name || 'Гишүүн'}</b>: {r.decision === 'approve' ? '✅ Баталсан' : '✏️ Засвар хэрэгтэй'}{r.comment ? ` — ${r.comment}` : ''}</p>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs text-gray-500">ТУЗ хурлаараа баталсан бол:</p>
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Жишээ нь: 2026-11-20 ТУЗ-ийн хурлын тогтоол №5" />
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => act({ action: 'approve_manual', note }, 'ТУЗ-ийн хурлаар баталсан гэж тэмдэглэх үү? Оршин суугчдад нээгдэнэ.')}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50">Хурлаар баталсан</button>
                <button disabled={busy} onClick={() => act({ action: 'check_approval' })} className="px-4 py-2 rounded-lg border text-sm">Олонхыг дахин шалгах</button>
                <button disabled={busy} onClick={() => act({ action: 'reopen' }, 'Буцааж ноорог болгох уу? Засаад дахин илгээхэд ТУЗ шинээр санал өгнө.')}
                  className="px-4 py-2 rounded-lg text-sm text-amber-700 ml-auto">← Буцааж засварлах</button>
              </div>
            </div>
          </>
        )}

        {(isApproved || plan.status === 'archived') && (
          <>
            <p className="text-sm text-green-700">
              ✅ {plan.approved_at ? new Date(plan.approved_at).toLocaleDateString('mn-MN') : ''}-нд {plan.approved_via === 'meeting' ? 'ТУЗ-ийн хурлаар' : 'ТУЗ апп-аар'} баталсан
              {plan.approved_note ? ` · ${plan.approved_note}` : ''}. Оршин суугчид апп дээрээ харж байна.
            </p>
            <textarea className={inputCls} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)}
              placeholder="Жилийн дүгнэлт: юу хийгдсэн, юу хоцорсон, дараа жилд юуг анхаарах (оршин суугчдад харагдана)" />
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act({ action: 'update_plan', summary })} className="px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50">Дүгнэлт хадгалах</button>
              {isApproved && (
                <>
                  <button disabled={busy} onClick={() => act({ action: 'archive' }, 'Жилийг хааж, төлөвлөгөөг архивлах уу? Цаашид гүйцэтгэл тайлагнахгүй.')}
                    className="px-4 py-2 rounded-lg border text-sm">Жилийг хаах</button>
                  <button disabled={busy} onClick={() => act({ action: 'reopen' }, 'Ажил нэмэх/засахын тулд ноорог болгох уу? Оршин суугчдаас нуугдаж, ТУЗ дахин батална. Гүйцэтгэлийн тайлан хадгалагдана.')}
                    className="px-4 py-2 rounded-lg text-sm text-amber-700 ml-auto">Ажил нэмэх / засах</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- Ажлууд ---------- */}
      {[1, 2, 3, 4].map((q) => {
        const list = plan.items.filter((i) => i.quarter === q);
        if (!isDraft && list.length === 0) return null;
        return (
          <div key={q} className="mt-6">
            <div className="flex items-center mb-2">
              <h2 className="font-bold text-gray-700 flex-1">{QUARTER_LABEL[q]}</h2>
              {isDraft && <button onClick={() => { setEditing(null); setAdding(emptyForm(q)); }} className="text-sm text-blue-600 font-semibold">+ Ажил нэмэх</button>}
            </div>
            <div className="space-y-2">
              {list.map((i) => editing?.id === i.id ? (
                <ItemEditor key={i.id} value={editing.f} busy={busy} onChange={(f) => setEditing({ id: i.id, f })}
                  onSave={() => saveItem(editing.f, i.id)} onCancel={() => setEditing(null)} />
              ) : (
                <ItemRow key={i.id} item={i} draft={isDraft} approved={isApproved} busy={busy} act={act}
                  onEdit={() => { setAdding(null); setEditing({ id: i.id, f: {
                    title: i.title, quarter: i.quarter, category: i.category, owner: i.owner || '',
                    budget: i.budget == null ? '' : String(i.budget), description: i.description || '',
                  } }); }}
                  onReload={load} setError={setError} />
              ))}
              {adding?.quarter === q && (
                <ItemEditor value={adding} busy={busy} onChange={setAdding} onSave={() => saveItem(adding)} onCancel={() => setAdding(null)} />
              )}
              {list.length === 0 && adding?.quarter !== q && <p className="text-xs text-gray-400">Ажил алга.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemEditor({ value: f, onChange, onSave, onCancel, busy }: {
  value: ItemForm; onChange: (f: ItemForm) => void; onSave: () => void; onCancel: () => void; busy: boolean;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
      <input className={inputCls} value={f.title} onChange={(e) => onChange({ ...f, title: e.target.value })} placeholder="Ажлын нэр (жишээ нь: 2-р орцны дээврийн засвар)" autoFocus />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select className={inputCls} value={f.quarter} onChange={(e) => onChange({ ...f, quarter: Number(e.target.value) })}>
          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}-р улирал</option>)}
        </select>
        <select className={inputCls} value={f.category} onChange={(e) => onChange({ ...f, category: e.target.value })}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className={inputCls} value={f.owner} onChange={(e) => onChange({ ...f, owner: e.target.value })} placeholder="Хариуцагч" />
        <input className={inputCls} value={f.budget} onChange={(e) => onChange({ ...f, budget: e.target.value })} placeholder="Төсөв ₮" inputMode="numeric" />
      </div>
      <textarea className={inputCls} rows={2} value={f.description} onChange={(e) => onChange({ ...f, description: e.target.value })} placeholder="Тайлбар (заавал биш)" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={onSave} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50">Хадгалах</button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-500">Болих</button>
      </div>
    </div>
  );
}

function ItemRow({ item, draft, approved, busy, act, onEdit, onReload, setError }: {
  item: ItemOut; draft: boolean; approved: boolean; busy: boolean;
  act: (body: Record<string, unknown>, confirmText?: string) => Promise<boolean>;
  onEdit: () => void; onReload: () => Promise<void>; setError: (s: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [r, setR] = useState({
    status: item.status as ItemStatus,
    progress: String(item.progress),
    report: item.report || '',
    actual_cost: item.actual_cost == null ? '' : String(item.actual_cost),
  });
  const [uploading, setUploading] = useState('');
  const st = ITEM_STATUS[item.status];

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setError('');
    try {
      setUploading('Бэлтгэж байна...');
      const prepared = await Promise.all(files.map(prepare));
      const sign = await api({ action: 'sign_upload', files: prepared.map((p) => ({ name: p.name, size: p.blob.size })) });
      if (!sign.ok) throw new Error(String(sign.data.error || 'Upload бэлтгэхэд алдаа'));
      const uploads = sign.data.uploads as { path: string; token: string }[];
      const done: { path: string; file_name: string; size_bytes: number }[] = [];
      for (let i = 0; i < prepared.length; i++) {
        setUploading(`Хуулж байна ${i + 1}/${prepared.length}...`);
        const { error } = await supabase.storage.from(WORK_PLAN_BUCKET)
          .uploadToSignedUrl(uploads[i].path, uploads[i].token, prepared[i].blob, { contentType: prepared[i].type });
        if (error) throw new Error(`«${prepared[i].name}» хуулахад алдаа: ${error.message}`);
        done.push({ path: uploads[i].path, file_name: prepared[i].name, size_bytes: prepared[i].blob.size });
      }
      const att = await api({ action: 'attach_files', itemId: item.id, files: done });
      if (!att.ok) throw new Error(String(att.data.error || 'Хавсаргахад алдаа'));
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    }
    setUploading('');
  };

  const rated = item.ratings.done + item.ratings.partial + item.ratings.not_done;

  return (
    <div className="bg-white border rounded-xl p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{item.title}</p>
          <p className="text-xs text-gray-500">
            {CATEGORIES[item.category] || item.category}
            {item.owner ? ` · ${item.owner}` : ''}
            {item.budget != null ? ` · төсөв ${money(item.budget)}` : ''}
            {item.actual_cost != null ? ` · зарцуулсан ${money(item.actual_cost)}` : ''}
          </p>
          {item.description && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{item.description}</p>}
        </div>
        {!draft && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${st.cls}`}>{st.label} · {item.progress}%</span>}
        {draft && (
          <div className="flex gap-2 text-xs">
            <button onClick={onEdit} className="text-blue-600">Засах</button>
            <button disabled={busy} onClick={() => act({ action: 'delete_item', itemId: item.id }, `«${item.title}» ажлыг устгах уу?`)} className="text-red-600">Устгах</button>
          </div>
        )}
      </div>

      {item.report && !reporting && <p className="text-xs text-gray-700 bg-blue-50 rounded-lg p-2 mt-2 whitespace-pre-wrap">{item.report}</p>}
      {item.files.length > 0 && (
        <div className="mt-2">
          <BoardReportFiles files={item.files} />
          {approved && (
            <div className="flex flex-wrap gap-2 mt-1">
              {item.files.map((f) => (
                <button key={f.id} disabled={busy} onClick={() => act({ action: 'delete_file', fileId: f.id }, `«${f.file_name}» файлыг устгах уу?`)}
                  className="text-[11px] text-red-500">✕ {f.file_name}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {rated > 0 && (
        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
          <p className="font-semibold">ТУЗ-ийн дүгнэлт: ✅ {item.ratings.done} · 🟡 {item.ratings.partial} · ❌ {item.ratings.not_done}</p>
          {(item.rating_list || []).map((x, i) => (
            <p key={i}>{x.member_name || 'Гишүүн'}: {RATING_LABEL[x.rating]}{x.comment ? ` — ${x.comment}` : ''}</p>
          ))}
        </div>
      )}

      {approved && !reporting && (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <button onClick={() => setReporting(true)} className="text-sm text-blue-600 font-semibold">
            {item.reported_at ? 'Гүйцэтгэл шинэчлэх' : 'Гүйцэтгэл тайлагнах'}
          </button>
          <label className="text-sm text-blue-600 font-semibold cursor-pointer">
            {uploading || '📎 Зураг / баримт'}
            <input type="file" multiple accept={ACCEPT} className="hidden" disabled={!!uploading}
              onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; upload(fs); }} />
          </label>
        </div>
      )}

      {reporting && (
        <div className="bg-gray-50 rounded-xl p-3 mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select className={inputCls} value={r.status} onChange={(e) => setR({ ...r, status: e.target.value as ItemStatus })}>
              {Object.entries(ITEM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input className={inputCls} value={r.progress} onChange={(e) => setR({ ...r, progress: e.target.value })} placeholder="Гүйцэтгэл %" inputMode="numeric" />
            <input className={inputCls} value={r.actual_cost} onChange={(e) => setR({ ...r, actual_cost: e.target.value })} placeholder="Бодит зардал ₮" inputMode="numeric" />
          </div>
          <textarea className={inputCls} rows={3} value={r.report} onChange={(e) => setR({ ...r, report: e.target.value })}
            placeholder="Юу хийгдсэн, хэн гүйцэтгэсэн, үлдсэн ажил (ТУЗ, оршин суугчдад харагдана)" />
          <div className="flex gap-2">
            <button disabled={busy} onClick={async () => { if (await act({ action: 'report_item', itemId: item.id, ...r })) setReporting(false); }}
              className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50">Хадгалах</button>
            <button onClick={() => setReporting(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500">Болих</button>
          </div>
        </div>
      )}
    </div>
  );
}
