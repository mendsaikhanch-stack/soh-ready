'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';

const reasons = [
  { value: 'spam', label: 'Спам, зар сурталчилгаа' },
  { value: 'harassment', label: 'Доромжлол, заналхийлэл' },
  { value: 'inappropriate', label: 'Зохисгүй агуулга' },
  { value: 'scam', label: 'Залилан, худал мэдээлэл' },
  { value: 'other', label: 'Бусад' },
];

interface Props {
  sokhId: string | number;
  contentType: 'chat' | 'marketplace';
  contentId: number;
  contentSnapshot: string;
  contentAuthor: string;
  reporterName?: string;
  className?: string;
}

export default function ReportButton({
  sokhId, contentType, contentId, contentSnapshot, contentAuthor, reporterName, className,
}: Props) {
  const storageKey = `reported-${contentType}-${contentId}`;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(storageKey)) setDone(true);
  }, [storageKey]);

  const submit = async () => {
    if (!reason) return;
    setSending(true);

    await supabase.from('content_reports').insert([{
      sokh_id: sokhId,
      content_type: contentType,
      content_id: contentId,
      content_snapshot: contentSnapshot.slice(0, 500),
      content_author: contentAuthor,
      reason,
      note: note.trim() || null,
      reporter_name: reporterName || null,
    }]);

    localStorage.setItem(storageKey, '1');
    setSending(false);
    setOpen(false);
    setDone(true);
  };

  if (done) {
    return <span className={`text-[10px] text-gray-400 ${className || ''}`}>Мэдээлсэн ✓</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Зөрчил мэдээлэх"
        className={`text-[10px] text-gray-400 underline active:text-gray-600 ${className || ''}`}
      >
        Мэдээлэх
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4">
            <p className="font-semibold mb-0.5">Зөрчил мэдээлэх</p>
            <p className="text-xs text-gray-500 mb-3">
              СӨХ-ийн админ шалгаад шийдвэрлэнэ.
            </p>

            <div className="bg-gray-50 border rounded-lg p-2 mb-3">
              <p className="text-[10px] text-gray-400 mb-0.5">{contentAuthor}</p>
              <p className="text-xs text-gray-600 line-clamp-3">{contentSnapshot}</p>
            </div>

            <div className="space-y-1 mb-3">
              {reasons.map(r => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border ${
                    reason === r.value ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Нэмэлт тайлбар (заавал биш)"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setOpen(false); setReason(''); setNote(''); }}
                className="flex-1 py-2 rounded-lg border text-sm"
              >
                Болих
              </button>
              <button
                onClick={submit}
                disabled={!reason || sending}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50"
              >
                {sending ? '...' : 'Илгээх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
