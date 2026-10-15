'use client';

import { useState } from 'react';
import { VOTE_WEIGHT_LABEL, type MeetingKind, type VoteWeightMode } from '@/app/lib/meetings/labels';

export interface AgendaRow {
  title: string;
  description: string;
  decision_draft: string;
  pass_threshold_pct: string;
  pass_threshold_strict: boolean;
  prevote_enabled: boolean;
}

export interface MeetingFormValue {
  kind: MeetingKind;
  title: string;
  description: string;
  scheduled_at: string; // datetime-local утга
  location: string;
  online_url: string;
  convened_by_name: string;
  convened_basis: string;
  vote_weight_mode: VoteWeightMode | '';
  quorum_required_pct: string;
  quorum_strict: boolean;
  min_notice_days: string;
  prevote_counts_as_attendance: '' | 'yes' | 'no';
  agenda: AgendaRow[];
}

export const emptyAgendaRow = (): AgendaRow => ({
  title: '',
  description: '',
  decision_draft: '',
  pass_threshold_pct: '',
  pass_threshold_strict: true,
  prevote_enabled: true,
});

export const emptyMeeting = (): MeetingFormValue => ({
  kind: 'regular',
  title: '',
  description: '',
  scheduled_at: '',
  location: '',
  online_url: '',
  convened_by_name: '',
  convened_basis: '',
  vote_weight_mode: '',
  quorum_required_pct: '',
  quorum_strict: false,
  min_notice_days: '',
  prevote_counts_as_attendance: '',
  agenda: [emptyAgendaRow()],
});

// ISO → datetime-local (хөтчийн цагийн бүс)
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toPayload(v: MeetingFormValue) {
  return {
    kind: v.kind,
    title: v.title,
    description: v.description,
    scheduled_at: v.scheduled_at ? new Date(v.scheduled_at).toISOString() : '',
    location: v.location,
    online_url: v.online_url,
    convened_by_name: v.convened_by_name,
    convened_basis: v.convened_basis,
    vote_weight_mode: v.vote_weight_mode || null,
    quorum_required_pct: v.quorum_required_pct === '' ? null : Number(v.quorum_required_pct),
    quorum_strict: v.quorum_strict,
    min_notice_days: v.min_notice_days === '' ? null : Number(v.min_notice_days),
    prevote_counts_as_attendance: v.prevote_counts_as_attendance === '' ? null : v.prevote_counts_as_attendance === 'yes',
    agenda: v.agenda
      .filter((a) => a.title.trim())
      .map((a) => ({
        title: a.title,
        description: a.description,
        decision_draft: a.decision_draft,
        pass_threshold_pct: a.pass_threshold_pct === '' ? null : Number(a.pass_threshold_pct),
        pass_threshold_strict: a.pass_threshold_strict,
        prevote_enabled: a.prevote_enabled,
      })),
  };
}

// Батлагдах босгын түгээмэл сонголт. Аль нь хамаарахыг СӨХ-ийн дүрэм, хуулиас
// дарга өөрөө шалгаж сонгоно — систем анхдагч утга тавихгүй.
const THRESHOLD_PRESETS = [
  { label: 'Энгийн олонх (50%-иас дээш)', pct: '50', strict: true },
  { label: 'Гуравны хоёр (67%-иас багагүй)', pct: '66.67', strict: false },
  { label: 'Дөрөвний гурав (75%-иас багагүй)', pct: '75', strict: false },
];

export default function MeetingForm({
  value,
  onChange,
}: {
  value: MeetingFormValue;
  onChange: (v: MeetingFormValue) => void;
}) {
  const [openAgenda, setOpenAgenda] = useState<number | null>(0);
  const set = <K extends keyof MeetingFormValue>(k: K, val: MeetingFormValue[K]) => onChange({ ...value, [k]: val });
  const setRow = (i: number, patch: Partial<AgendaRow>) =>
    set('agenda', value.agenda.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-5">
      {/* ===== Үндсэн мэдээлэл ===== */}
      <section className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Хурлын мэдээлэл</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Хурлын нэр *</label>
            <input className={inputCls} value={value.title} onChange={(e) => set('title', e.target.value)} placeholder="Жишээ: 2026 оны ээлжит хурал" />
          </div>
          <div>
            <label className={labelCls}>Төрөл</label>
            <select className={inputCls} value={value.kind} onChange={(e) => set('kind', e.target.value as MeetingKind)}>
              <option value="regular">Ээлжит</option>
              <option value="extraordinary">Ээлжит бус</option>
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Огноо, цаг *</label>
            <input type="datetime-local" className={inputCls} value={value.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Хуралдах газар</label>
            <input className={inputCls} value={value.location} onChange={(e) => set('location', e.target.value)} placeholder="Жишээ: 1-р орцны үүдний танхим" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Цахим холбоос (заавал биш)</label>
          <input className={inputCls} value={value.online_url} onChange={(e) => set('online_url', e.target.value)} placeholder="https://..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Хурал зарлан хуралдуулагч</label>
            <input className={inputCls} value={value.convened_by_name} onChange={(e) => set('convened_by_name', e.target.value)} placeholder="Нэр, албан тушаал" />
          </div>
          <div>
            <label className={labelCls}>Хэний санаачилгаар</label>
            <input className={inputCls} value={value.convened_basis} onChange={(e) => set('convened_basis', e.target.value)} placeholder="Жишээ: ТУЗ-ийн шийдвэрээр" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Тайлбар</label>
          <textarea className={inputCls} rows={3} value={value.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </section>

      {/* ===== Дүрэм ===== */}
      <section className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Хурлын дүрэм</h2>
          <p className="text-xs text-amber-800 mt-1">
            Эдгээр тоог СӨХ-ийн дүрэм болон «Сууц өмчлөгчдийн холбооны тухай» хуулиас шалгаж оруулна уу.
            Хурал зарласны дараа өөрчлөх боломжгүй.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Саналыг хэрхэн тоолох *</label>
            <select className={inputCls} value={value.vote_weight_mode} onChange={(e) => set('vote_weight_mode', e.target.value as VoteWeightMode | '')}>
              <option value="">— Сонгоно уу —</option>
              {(Object.keys(VOTE_WEIGHT_LABEL) as VoteWeightMode[]).map((k) => (
                <option key={k} value={k}>{VOTE_WEIGHT_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Зар хүргэх хамгийн бага хугацаа (хоног) *</label>
            <input inputMode="numeric" className={inputCls} value={value.min_notice_days} onChange={(e) => set('min_notice_days', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Хурлаас хэд хоногийн өмнө" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Хурал хүчинтэй болох ирц (%) *</label>
            <div className="flex gap-2">
              <input inputMode="decimal" className={`${inputCls} w-28`} value={value.quorum_required_pct} onChange={(e) => set('quorum_required_pct', e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} placeholder="%" />
              <select className={inputCls} value={value.quorum_strict ? 'gt' : 'gte'} onChange={(e) => set('quorum_strict', e.target.value === 'gt')}>
                <option value="gte">-иас багагүй</option>
                <option value="gt">-иас дээш</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Урьдчилан санал өгсөн айлыг ирцэд тооцох уу? *</label>
            <select className={inputCls} value={value.prevote_counts_as_attendance} onChange={(e) => set('prevote_counts_as_attendance', e.target.value as '' | 'yes' | 'no')}>
              <option value="">— Сонгоно уу —</option>
              <option value="yes">Тийм, ирцэд тооцно</option>
              <option value="no">Үгүй, зөвхөн хуралд ирсэн/итгэмжлүүлснийг</option>
            </select>
          </div>
        </div>
      </section>

      {/* ===== Хэлэлцэх асуудал ===== */}
      <section className="bg-white rounded-2xl border p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Хэлэлцэх асуудал *</h2>
        {value.agenda.map((a, i) => (
          <div key={i} className="border rounded-xl">
            <button type="button" onClick={() => setOpenAgenda(openAgenda === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <span className="text-sm font-medium text-gray-800 truncate">
                {i + 1}. {a.title || <span className="text-gray-400">Гарчиггүй</span>}
              </span>
              <span className="text-gray-400 text-xs shrink-0 ml-2">{openAgenda === i ? '▲' : '▼'}</span>
            </button>
            {openAgenda === i && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className={labelCls}>Гарчиг *</label>
                  <input className={inputCls} value={a.title} onChange={(e) => setRow(i, { title: e.target.value })} placeholder="Жишээ: 2027 оны төсөв батлах" />
                </div>
                <div>
                  <label className={labelCls}>Тайлбар</label>
                  <textarea className={inputCls} rows={2} value={a.description} onChange={(e) => setRow(i, { description: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Шийдвэрийн төсөл</label>
                  <textarea className={inputCls} rows={2} value={a.decision_draft} onChange={(e) => setRow(i, { decision_draft: e.target.value })} placeholder="Санал хураах шийдвэрийн текст" />
                </div>
                <div>
                  <label className={labelCls}>Батлагдах босго *</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {THRESHOLD_PRESETS.map((p) => {
                      const active = a.pass_threshold_pct === p.pct && a.pass_threshold_strict === p.strict;
                      return (
                        <button
                          type="button"
                          key={p.label}
                          onClick={() => setRow(i, { pass_threshold_pct: p.pct, pass_threshold_strict: p.strict })}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input inputMode="decimal" className={`${inputCls} w-28`} value={a.pass_threshold_pct} onChange={(e) => setRow(i, { pass_threshold_pct: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} placeholder="%" />
                    <select className={inputCls} value={a.pass_threshold_strict ? 'gt' : 'gte'} onChange={(e) => setRow(i, { pass_threshold_strict: e.target.value === 'gt' })}>
                      <option value="gt">-иас дээш</option>
                      <option value="gte">-иас багагүй</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="w-4 h-4" checked={a.prevote_enabled} onChange={(e) => setRow(i, { prevote_enabled: e.target.checked })} />
                  Хурлаас өмнө апп-аар урьдчилан санал авах
                </label>
                {value.agenda.length > 1 && (
                  <button type="button" onClick={() => { set('agenda', value.agenda.filter((_, idx) => idx !== i)); setOpenAgenda(null); }} className="text-xs text-red-600">
                    Энэ асуудлыг хасах
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => { set('agenda', [...value.agenda, emptyAgendaRow()]); setOpenAgenda(value.agenda.length); }}
          className="text-sm text-blue-600 font-medium"
        >
          + Асуудал нэмэх
        </button>
      </section>
    </div>
  );
}

export const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const labelCls = 'text-sm font-medium text-gray-700 block mb-1';
