'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Complaint {
  id: number;
  category: string;
  title: string;
  description: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

const categoryOptions = [
  { value: 'complaint', label: 'Гомдол', icon: '😤' },
  { value: 'suggestion', label: 'Санал', icon: '💡' },
  { value: 'question', label: 'Асуулт', icon: '❓' },
];

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-100 text-yellow-700' },
  in_progress: { label: 'Шалгаж байна', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Шийдвэрлэсэн', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-100 text-red-700' },
};

export default function ComplaintsPage() {
  const params = useParams();
  const router = useRouter();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('complaint');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, [params.id]);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from('complaints')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false });

    setComplaints(data || []);
    setLoading(false);
  };

  const submitComplaint = async () => {
    if (!title) return;
    setSaving(true);

    await supabase.from('complaints').insert([{
      sokh_id: params.id,
      category,
      title,
      description,
      status: 'pending',
    }]);

    setTitle('');
    setDescription('');
    setCategory('complaint');
    setShowForm(false);
    setSaving(false);
    await fetchComplaints();
  };

  const getCategoryInfo = (cat: string) => categoryOptions.find(c => c.value === cat) || categoryOptions[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-violet-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📝 Гомдол / Санал</h1>
      </div>

      <div className="px-4 py-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full bg-violet-600 text-white py-3 rounded-xl font-medium active:bg-violet-700 transition mb-4"
        >
          + Шинэ гомдол / санал бичих
        </button>

        {showForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            {/* Төрөл сонгох */}
            <div className="flex gap-2 mb-3">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCategory(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    category === opt.value
                      ? 'bg-violet-100 text-violet-700 border-2 border-violet-400'
                      : 'bg-gray-50 text-gray-500 border border-gray-200'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            <input
              placeholder="Гарчиг (жнь: Орцны гэрэл асахгүй)"
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border text-sm"
              >
                Цуцлах
              </button>
              <button
                onClick={submitComplaint}
                disabled={saving || !title}
                className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
              >
                {saving ? 'Илгээж байна...' : 'Илгээх'}
              </button>
            </div>
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-500 mb-3">МИНИЙ ГОМДОЛ / САНАЛ</h2>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : complaints.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400">Гомдол / санал байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {complaints.map((c) => {
              const st = statusMap[c.status] || statusMap.pending;
              const cat = getCategoryInfo(c.category);
              const isExpanded = expandedId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl p-3 shadow-sm cursor-pointer active:scale-[0.99] transition"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <h3 className="font-medium text-sm">{c.title}</h3>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>
                      {st.label}
                    </span>
                  </div>

                  {c.description && (
                    <p className="text-xs text-gray-500 mt-1 ml-7">{c.description}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-2 ml-7">
                    {new Date(c.created_at).toLocaleDateString('mn-MN')}
                  </p>

                  {/* Админ хариу */}
                  {isExpanded && c.admin_reply && (
                    <div className="mt-3 ml-7 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">💬 Админ хариу:</p>
                      <p className="text-sm text-blue-800">{c.admin_reply}</p>
                      {c.replied_at && (
                        <p className="text-xs text-blue-400 mt-1">
                          {new Date(c.replied_at).toLocaleDateString('mn-MN')}
                        </p>
                      )}
                    </div>
                  )}

                  {isExpanded && !c.admin_reply && (
                    <p className="text-xs text-gray-400 mt-2 ml-7 italic">Хариу ирээгүй байна</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
