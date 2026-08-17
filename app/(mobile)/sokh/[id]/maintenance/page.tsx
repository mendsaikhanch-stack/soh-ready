'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { compressImage } from '@/app/lib/compress-image';

const MAX_PHOTOS = 4;

interface Request {
  id: number;
  title: string;
  description: string;
  status: string;
  // Ганц зурагтай ХУУЧИН мөрүүдэд үлдсэн багана. Шинэ мөр `photos`-ыг хэрэглэнэ.
  image_url: string | null;
  photos: string[] | null;
  created_at: string;
}

interface Work {
  id: number;
  title: string;
  description: string | null;
  work_date: string;
  photos: string[] | null;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Хийгдэж байна', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Дууссан', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Цуцлагдсан', color: 'bg-red-100 text-red-700' },
};

export default function MaintenancePage() {
  const params = useParams();
  const router = useRouter();
  const [tab, setTab] = useState<'requests' | 'works'>('requests');
  const [requests, setRequests] = useState<Request[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [formError, setFormError] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  const fetchWorks = async () => {
    const { data } = await supabase
      .from('maintenance_works')
      .select('id, title, description, work_date, photos')
      .eq('sokh_id', params.id)
      .order('work_date', { ascending: false });

    setWorks(data || []);
  };

  useEffect(() => {
    fetchRequests();
    fetchWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setFormError(`Хамгийн ихдээ ${MAX_PHOTOS} зураг оруулна`);
      return;
    }

    // 15MB-с доош бүх зургийг авна — илгээхийн өмнө шахагдаж ~200-500KB болно.
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
    setFormError('');
    setShowForm(false);
  };

  const submitRequest = async () => {
    if (!title) return;
    setSaving(true);
    setFormError('');

    const urls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const blob = await compressImage(photos[i].file);
      const path = `maintenance/${params.id}/${Date.now()}-${i}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(path, blob, { contentType: 'image/jpeg' });

      // Өмнө нь энэ алдааг чимээгүй залгидаг байсан тул оршин суугч зураг
      // хавсаргасан гэж бодоод үлддэг, дарга нь юу ч харахгүй байв.
      if (uploadError) {
        setFormError('Зураг хуулахад алдаа гарлаа: ' + uploadError.message);
        setSaving(false);
        return;
      }

      urls.push(supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl);
    }

    const { error } = await supabase.from('maintenance_requests').insert([{
      sokh_id: params.id,
      title,
      description,
      status: 'pending',
      photos: urls,
    }]);

    setSaving(false);
    if (error) {
      setFormError('Илгээхэд алдаа гарлаа: ' + error.message);
      return;
    }

    resetForm();
    await fetchRequests();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-500 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🔧 Засвар үйлчилгээ</h1>
      </div>

      {/* Таб */}
      <div className="bg-white border-b flex">
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
            tab === 'requests' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'
          }`}
        >
          Хүсэлт гаргах
        </button>
        <button
          onClick={() => setTab('works')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
            tab === 'works' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400'
          }`}
        >
          Хийсэн засвар
        </button>
      </div>

      {tab === 'requests' ? (
        <div className="px-4 py-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-medium active:bg-orange-600 transition mb-4"
          >
            + Шинэ хүсэлт гаргах
          </button>

          {showForm && (
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
              <input
                placeholder="Гарчиг (жнь: Лифт эвдэрсэн)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-2 text-sm"
              />
              <textarea
                placeholder="Дэлгэрэнгүй тайлбар..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 mb-2 text-sm"
              />

              {/* Зураг хавсаргах — хамгийн ихдээ MAX_PHOTOS ширхэг */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={addPhotos}
                className="hidden"
              />

              <p className="text-xs text-gray-400 mb-1">
                Зураг ({photos.length}/{MAX_PHOTOS})
              </p>

              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {photos.map((p, i) => (
                    <div key={p.preview} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt={`Зураг ${i + 1}`} className="w-full h-16 object-cover rounded-lg" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-xs"
                        aria-label={`${i + 1}-р зургийг хасах`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 mb-2 flex flex-col items-center gap-1 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition"
                >
                  <span className="text-2xl">📷</span>
                  <span className="text-xs">Зураг хавсаргах</span>
                </button>
              )}

              {formError && (
                <p className="text-xs text-red-500 mb-2">{formError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={resetForm}
                  className="flex-1 py-2 rounded-lg border text-sm"
                >
                  Цуцлах
                </button>
                <button
                  onClick={submitRequest}
                  disabled={saving || !title}
                  className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm disabled:opacity-50"
                >
                  {saving ? 'Илгээж байна...' : 'Илгээх'}
                </button>
              </div>
            </div>
          )}

          <h2 className="text-sm font-semibold text-gray-500 mb-3">ХҮСЭЛТҮҮД</h2>

          {loading ? (
            <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-gray-400">Засварын хүсэлт байхгүй</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const st = statusMap[r.status] || statusMap.pending;
                return (
                  <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-sm">{r.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                    )}
                    {(() => {
                      // Шинэ мөр `photos`-той, хуучин нь ганц `image_url`-тэй
                      const imgs = r.photos?.length ? r.photos : r.image_url ? [r.image_url] : [];
                      if (!imgs.length) return null;
                      return (
                        <div className={`mt-2 grid gap-1.5 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                          {imgs.map((url, i) => (
                            <button key={url} onClick={() => setExpandedImage(url)}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Хавсралт ${i + 1}`}
                                className={`w-full object-cover rounded-lg ${imgs.length === 1 ? 'h-32' : 'h-20'}`}
                              />
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(r.created_at).toLocaleDateString('mn-MN')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">СӨХ-ИЙН ХИЙСЭН ЗАСВАР</h2>

          {works.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">🔧</p>
              <p className="text-gray-400">Бүртгэсэн засвар одоогоор алга</p>
            </div>
          ) : (
            <div className="space-y-3">
              {works.map((w) => (
                <div key={w.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <h3 className="font-medium text-sm">{w.title}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(w.work_date).toLocaleDateString('mn-MN')}
                  </p>
                  {w.description && (
                    <p className="text-xs text-gray-600 mt-2 whitespace-pre-line">{w.description}</p>
                  )}
                  {w.photos && w.photos.length > 0 && (
                    <div className={`mt-2 grid gap-1.5 ${w.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                      {w.photos.map((url, i) => (
                        <button key={url} onClick={() => setExpandedImage(url)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Зураг ${i + 1}`}
                            className={`w-full object-cover rounded-lg ${w.photos!.length === 1 ? 'h-44' : 'h-24'}`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Зураг томруулж харах */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={expandedImage} alt="Зураг" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
