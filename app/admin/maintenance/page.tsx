'use client';

import { useState, useEffect, useRef } from 'react';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';
import { supabase } from '@/app/lib/supabase';
import { compressImage } from '@/app/lib/compress-image';

interface Request {
  id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  photos: string[] | null;   // оршин суугчийн хавсаргасан зураг
}
interface Work {
  id: number;
  title: string;
  description: string | null;
  work_date: string;
  photos: string[] | null;
  created_at: string;
}

const statusOptions = [
  { value: 'pending', label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'in_progress', label: 'Хийгдэж байна', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Дууссан', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Цуцлагдсан', color: 'bg-red-100 text-red-700' },
];

const MAX_PHOTOS = 6;

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminMaintenance() {
  const [tab, setTab] = useState<'requests' | 'works'>('requests');

  // Оршин суугчийн хүсэлт
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Хийсэн засвар
  const [works, setWorks] = useState<Work[]>([]);
  const [worksLoading, setWorksLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workDate, setWorkDate] = useState(todayISO());
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Зураг томруулж харах (хүсэлт болон хийсэн засварын аль алинд)
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fetchRequests = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await adminFrom('maintenance_requests').select('*').eq('sokh_id', sokhId).order('created_at', { ascending: false });
    setRequests((data as unknown as Request[]) || []);
    setLoading(false);
  };

  const fetchWorks = async () => {
    const sokhId = await getAdminSokhId();
    const { data } = await adminFrom('maintenance_works').select('*').eq('sokh_id', sokhId).order('work_date', { ascending: false });
    setWorks((data as unknown as Work[]) || []);
    setWorksLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
    fetchWorks();
  }, []);

  const updateStatus =async (id: number, status: string) => {
    await adminFrom('maintenance_requests').update({ status }).eq('id', id);
    await fetchRequests();
  };

  const deleteRequest = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('maintenance_requests').delete().eq('id', id);
    await fetchRequests();
  };

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setFormError(`Хамгийн ихдээ ${MAX_PHOTOS} зураг оруулна`);
      return;
    }

    const accepted: { file: File; preview: string }[] = [];
    let tooBig = false;
    for (const file of files.slice(0, room)) {
      if (file.size > 15 * 1024 * 1024) { tooBig = true; continue; }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }

    setFormError(
      tooBig ? 'Зарим зураг хэт том (15MB-с дээш) тул оруулаагүй' :
      files.length > room ? `Хамгийн ихдээ ${MAX_PHOTOS} зураг тул эхний ${room}-г нь авлаа` : ''
    );
    setPhotos(prev => [...prev, ...accepted]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetForm = () => {
    photos.forEach(p => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    setTitle('');
    setDescription('');
    setWorkDate(todayISO());
    setFormError('');
    setShowForm(false);
  };

  const saveWork = async () => {
    if (!title.trim() || !workDate) return;
    setSaving(true);
    setFormError('');

    const sokhId = await getAdminSokhId();
    const urls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const blob = await compressImage(photos[i].file);
      const path = `maintenance-works/${sokhId}/${Date.now()}-${i}.jpg`;

      const { error } = await supabase.storage
        .from('uploads')
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (error) {
        setFormError('Зураг хуулахад алдаа гарлаа: ' + error.message);
        setSaving(false);
        return;
      }

      urls.push(supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl);
    }

    const { error } = await adminFrom('maintenance_works').insert([{
      sokh_id: sokhId,
      title: title.trim(),
      description: description.trim() || null,
      work_date: workDate,
      photos: urls,
    }]);

    setSaving(false);
    if (error) {
      setFormError('Хадгалахад алдаа гарлаа: ' + error);
      return;
    }

    resetForm();
    await fetchWorks();
  };

  const deleteWork = async (id: number) => {
    if (!confirm('Энэ тайланг устгах уу? Оршин суугчид харагдахаа болино.')) return;
    await adminFrom('maintenance_works').delete().eq('id', id);
    await fetchWorks();
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">🔧 Засвар үйлчилгээ</h1>

      {/* Таб */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Оршин суугчийн хүсэлт ({requests.length})
        </button>
        <button
          onClick={() => setTab('works')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
            tab === 'works' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Хийсэн засвар ({works.length})
        </button>
      </div>

      {tab === 'requests' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {statusOptions.map(s => {
              const count = requests.filter(r => r.status === s.value).length;
              return (
                <button key={s.value} onClick={() => setFilter(s.value === filter ? 'all' : s.value)}
                  className={`rounded-xl border p-3 text-center transition ${filter === s.value ? 'ring-2 ring-blue-500' : ''}`}>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </button>
              );
            })}
          </div>

          {/* List */}
          {loading ? (
            <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                  <div key={r.id} className="bg-white border rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{r.title}</h3>
                        {r.description && <p className="text-sm text-gray-500 mt-1">{r.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString('mn-MN')}</p>
                      </div>
                      <button onClick={() => deleteRequest(r.id)} className="text-red-400 text-xs hover:underline">Устгах</button>
                    </div>

                    {/* Хавсаргасан зураг — товшиж томруулна */}
                    {(() => {
                      const imgs = r.photos || [];
                      if (!imgs.length) return null;
                      return (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {imgs.map((url, i) => (
                            <button key={url} onClick={() => setExpandedImage(url)} title="Томруулж харах">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Хавсралт ${i + 1}`}
                                className="w-24 h-24 object-cover rounded-lg border hover:opacity-80 transition"
                              />
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Төлөв:</span>
                      {statusOptions.map(s => (
                        <button key={s.value} onClick={() => updateStatus(r.id, s.value)}
                          className={`text-xs px-2 py-1 rounded-full transition ${r.status === s.value ? s.color + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
              ))}
              {filtered.length === 0 && <p className="text-gray-400 text-center py-8">Хүсэлт байхгүй</p>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 mb-4">
            <p className="text-sm text-gray-500">
              Хийсэн засвар, үйлчилгээгээ огноо, зураг, тайлбартай бүртгэнэ.
              Оршин суугчид апп дээрээ шууд харна.
            </p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                + Засвар бүртгэх
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-white border rounded-xl p-4 mb-6">
              <div className="grid sm:grid-cols-[1fr_180px] gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Юу засварласан бэ</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="жнь: 2-р орцны лифт засварлав"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Хийсэн огноо</label>
                  <input
                    type="date"
                    value={workDate}
                    max={todayISO()}
                    onChange={e => setWorkDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <label className="block text-xs text-gray-500 mb-1">Тайлбар</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Ямар ажил хийсэн, ямар эд анги солисон, хэн гүйцэтгэсэн..."
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
              />

              <label className="block text-xs text-gray-500 mb-1">
                Зураг ({photos.length}/{MAX_PHOTOS})
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
                className="hidden"
              />

              <div className="flex flex-wrap gap-2 mb-3">
                {photos.map((p, i) => (
                  <div key={p.preview} className="relative w-24 h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={`Зураг ${i + 1}`} className="w-full h-full object-cover rounded-lg border" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-black/70 text-white rounded-full text-xs"
                      aria-label="Зураг хасах"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition"
                  >
                    <span className="text-xl">📷</span>
                    <span className="text-[10px]">Нэмэх</span>
                  </button>
                )}
              </div>

              {formError && <p className="text-sm text-red-500 mb-3">{formError}</p>}

              <div className="flex gap-2">
                <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm">
                  Болих
                </button>
                <button
                  onClick={saveWork}
                  disabled={saving || !title.trim() || !workDate}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Хадгалж байна...' : 'Нийтлэх'}
                </button>
              </div>
            </div>
          )}

          {worksLoading ? (
            <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
          ) : works.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Бүртгэсэн засвар байхгүй</p>
          ) : (
            <div className="space-y-3">
              {works.map(w => (
                <div key={w.id} className="bg-white border rounded-xl p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm">{w.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(w.work_date).toLocaleDateString('mn-MN')}
                      </p>
                      {w.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{w.description}</p>}
                    </div>
                    <button onClick={() => deleteWork(w.id)} className="shrink-0 text-red-400 text-xs hover:underline">
                      Устгах
                    </button>
                  </div>
                  {w.photos && w.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {w.photos.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Зураг ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Зураг томруулж харах */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
          onClick={() => setExpandedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedImage} alt="Зураг" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
