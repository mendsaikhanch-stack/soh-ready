'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const CATEGORIES = [
  { id: 'parking_incident', label: 'Зогсоолын осол', icon: '🚗', desc: 'Мөргөлдсөн, шүргэсэн, шүргэлцсэн' },
  { id: 'suspicious_person', label: 'Сэжигтэй хүн', icon: '👤', desc: 'Гадны хүн холхисон, сэжигтэй үйлдэл' },
  { id: 'theft_crime', label: 'Хулгай / Гэмт хэрэг', icon: '🚨', desc: 'Хулгай, эвдрэл, гэмт хэргийн шинжтэй' },
  { id: 'lost_item', label: 'Алдсан эд зүйл', icon: '📦', desc: 'Гээсэн, орхисон, унагаасан юм хайх' },
  { id: 'playground', label: 'Тоглоомын талбай', icon: '🧒', desc: 'Хүүхдийн аюулгүй байдал хянах' },
  { id: 'property_damage', label: 'Эд хөрөнгийн хохирол', icon: '💥', desc: 'Байрны эд хогшил гэмтээсэн' },
  { id: 'other', label: 'Бусад', icon: '📹', desc: 'Дээрхээс бусад шалтгаан' },
];

export default function CCTVRequestPage() {
  const params = useParams();
  const router = useRouter();
  const [step, setStep] = useState<'category' | 'form' | 'success'>('category');
  const [category, setCategory] = useState('');
  const [form, setForm] = useState({
    name: '',
    apartment: '',
    phone: '',
    description: '',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    location: '',
  });

  const selectCategory = (catId: string) => {
    setCategory(catId);
    setStep('form');
  };

  const submitRequest = () => {
    if (!form.name || !form.apartment || !form.description) return;

    // Хүсэлт хадгалах (admin CCTV хуудаст харагдана)
    const requests = JSON.parse(localStorage.getItem('sokh-cctv-footage-requests') || '[]');
    requests.unshift({
      id: Date.now().toString(),
      residentName: form.name,
      apartment: form.apartment,
      phone: form.phone,
      category,
      description: form.description,
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      location: form.location,
      status: 'pending',
      createdAt: new Date().toISOString(),
      adminNote: '',
    });
    localStorage.setItem('sokh-cctv-footage-requests', JSON.stringify(requests));

    setStep('success');
  };

  const cat = CATEGORIES.find(c => c.id === category);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-4">
        <button
          onClick={() => step === 'form' ? setStep('category') : router.push(`/sokh/${params.id}`)}
          className="text-white/80 text-sm mb-1"
        >
          ← {step === 'form' ? 'Категори сонгох' : 'Буцах'}
        </button>
        <h1 className="text-lg font-bold">🎬 Бичлэг шүүх хүсэлт</h1>
        <p className="text-sm text-white/60">Камерын бичлэг үзэх хүсэлт илгээх</p>
      </div>

      {/* Категори сонгох */}
      {step === 'category' && (
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">ШАЛТГААН СОНГОХ</h2>
          <div className="space-y-2">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => selectCategory(c.id)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border text-left active:scale-[0.98] transition hover:border-blue-300"
              >
                <span className="text-2xl">{c.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{c.label}</p>
                  <p className="text-xs text-gray-500">{c.desc}</p>
                </div>
                <span className="text-gray-300">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Хүсэлтийн форм */}
      {step === 'form' && (
        <div className="px-4 py-4">
          {/* Сонгосон категори */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center gap-2">
            <span className="text-xl">{cat?.icon}</span>
            <div>
              <p className="text-sm font-semibold text-blue-700">{cat?.label}</p>
              <p className="text-xs text-blue-600">{cat?.desc}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Таны мэдээлэл</h3>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Нэр *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Таны нэр"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Тоот *</label>
                  <input
                    value={form.apartment}
                    onChange={e => setForm({ ...form, apartment: e.target.value })}
                    placeholder="жнь: 3-р байр 45"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Утас</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="99001122"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Тохиолдлын мэдээлэл</h3>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Юу болсон тухай дэлгэрэнгүй *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Тохиолдлын дэлгэрэнгүй тайлбар бичнэ үү..."
                  className="w-full border rounded-lg px-3 py-2.5 text-sm h-24 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Тохиолдсон газар</label>
                <input
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="жнь: 2-р байрны гадна зогсоол, 5-р давхарын коридор"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Эхлэх огноо</label>
                  <input
                    type="date"
                    value={form.dateFrom}
                    onChange={e => setForm({ ...form, dateFrom: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Дуусах огноо</label>
                  <input
                    type="date"
                    value={form.dateTo}
                    onChange={e => setForm({ ...form, dateTo: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-700">
              СӨХ-ийн зөвшөөрлөөр бичлэг шүүгдэж, хариуг мэдэгдэл хэлбэрээр хүлээн авна. Бичлэг хадгалагдах хугацаа хязгаартай тул аль болох хурдан хүсэлт илгээнэ үү.
            </div>

            <button
              onClick={submitRequest}
              disabled={!form.name || !form.apartment || !form.description}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                form.name && form.apartment && form.description
                  ? 'bg-blue-600 text-white active:bg-blue-700'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              Хүсэлт илгээх
            </button>
          </div>
        </div>
      )}

      {/* Амжилттай */}
      {step === 'success' && (
        <div className="px-4 py-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-bold mb-2">Хүсэлт илгээгдлээ!</h2>
          <p className="text-sm text-gray-500 mb-2">
            СӨХ-ийн админ таны хүсэлтийг хянаж, бичлэг шүүх болно.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            Хариуг мэдэгдэл хэлбэрээр хүлээн авна.
          </p>
          <div className="flex gap-3 max-w-xs mx-auto">
            <button
              onClick={() => { setStep('category'); setCategory(''); setForm({ name: '', apartment: '', phone: '', description: '', dateFrom: new Date().toISOString().split('T')[0], dateTo: new Date().toISOString().split('T')[0], location: '' }); }}
              className="flex-1 py-3 border rounded-xl text-sm font-medium"
            >
              Дахин илгээх
            </button>
            <button
              onClick={() => router.push(`/sokh/${params.id}`)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold"
            >
              Нүүр хуудас
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
