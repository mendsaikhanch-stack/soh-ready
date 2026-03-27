'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Request {
  id: number;
  title: string;
  description: string;
  status: string;
  image_url: string | null;
  created_at: string;
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
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRequests();
  }, [params.id]);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false });

    setRequests(data || []);
    setLoading(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Зургийн хэмжээ 5MB-с бага байх ёстой');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submitRequest = async () => {
    if (!title) return;
    setSaving(true);

    let imageUrl: string | null = null;

    // Зураг upload
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const fileName = `maintenance/${params.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, imageFile, { contentType: imageFile.type });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    await supabase.from('maintenance_requests').insert([{
      sokh_id: params.id,
      title,
      description,
      status: 'pending',
      image_url: imageUrl,
    }]);

    setTitle('');
    setDescription('');
    removeImage();
    setShowForm(false);
    setSaving(false);
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

            {/* Зураг хавсаргах */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative mb-2">
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 mb-2 flex flex-col items-center gap-1 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition"
              >
                <span className="text-2xl">📷</span>
                <span className="text-xs">Зураг хавсаргах</span>
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); removeImage(); }}
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
                  {r.image_url && (
                    <button onClick={() => setExpandedImage(r.image_url)} className="mt-2">
                      <img src={r.image_url} alt="Хавсралт" className="w-full h-32 object-cover rounded-lg" />
                    </button>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(r.created_at).toLocaleDateString('mn-MN')}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Зураг томруулж харах */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Зураг" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
