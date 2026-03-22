'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Listing {
  id: number;
  seller_name: string;
  seller_unit: string;
  title: string;
  description: string;
  price: number;
  category: string;
  listing_type: string;
  phone: string;
  status: string;
  created_at: string;
}

const categories = [
  { value: 'furniture', label: 'Тавилга', icon: '🪑' },
  { value: 'electronics', label: 'Цахилгаан бараа', icon: '📱' },
  { value: 'kids', label: 'Хүүхдийн', icon: '👶' },
  { value: 'clothing', label: 'Хувцас', icon: '👕' },
  { value: 'books', label: 'Ном', icon: '📚' },
  { value: 'kitchen', label: 'Гал тогоо', icon: '🍳' },
  { value: 'sports', label: 'Спорт', icon: '⚽' },
  { value: 'other', label: 'Бусад', icon: '📦' },
];

const listingTypes = [
  { value: 'sell', label: 'Зарах', color: 'bg-green-100 text-green-700' },
  { value: 'trade', label: 'Солих', color: 'bg-blue-100 text-blue-700' },
  { value: 'free', label: 'Үнэгүй', color: 'bg-purple-100 text-purple-700' },
  { value: 'lend', label: 'Түр зээлэх', color: 'bg-orange-100 text-orange-700' },
];

export default function MarketplacePage() {
  const params = useParams();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('all');

  const [sellerName, setSellerName] = useState('');
  const [sellerUnit, setSellerUnit] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('other');
  const [listingType, setListingType] = useState('sell');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`market-name-${params.id}`);
    if (saved) { const d = JSON.parse(saved); setSellerName(d.name); setSellerUnit(d.unit); setPhone(d.phone || ''); }
    fetchListings();
  }, [params.id]);

  const fetchListings = async () => {
    const { data } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('sokh_id', params.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setListings(data || []);
    setLoading(false);
  };

  const submit = async () => {
    if (!title || !sellerName) return;
    setSaving(true);
    localStorage.setItem(`market-name-${params.id}`, JSON.stringify({ name: sellerName, unit: sellerUnit, phone }));

    await supabase.from('marketplace_listings').insert([{
      sokh_id: params.id, seller_name: sellerName, seller_unit: sellerUnit,
      title, description, price: price ? Number(price) : 0,
      category, listing_type: listingType, phone, status: 'active',
    }]);

    setTitle(''); setDescription(''); setPrice('');
    setShowForm(false); setSaving(false);
    await fetchListings();
  };

  const filtered = filterCat === 'all' ? listings : listings.filter(l => l.category === filterCat);
  const getCat = (c: string) => categories.find(x => x.value === c) || categories[7];
  const getType = (t: string) => listingTypes.find(x => x.value === t) || listingTypes[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-teal-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">🏪 Хөрш маркет</h1>
        <p className="text-xs text-white/70">Байрны оршин суугчдын зар</p>
      </div>

      <div className="px-4 py-4">
        <button onClick={() => setShowForm(!showForm)}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium active:bg-teal-700 transition mb-4">
          + Зар нэмэх
        </button>

        {showForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Таны нэр" value={sellerName} onChange={e => setSellerName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Тоот (жнь: 301)" value={sellerUnit} onChange={e => setSellerUnit(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <input placeholder="Утас" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-1">
              {listingTypes.map(t => (
                <button key={t.value} onClick={() => setListingType(t.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${listingType === t.value ? t.color + ' border-2' : 'bg-gray-50 text-gray-400 border'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              {categories.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
            <input placeholder="Нэр (жнь: Хүүхдийн ор)" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder="Тайлбар..." value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {listingType === 'sell' && (
              <input type="number" placeholder="Үнэ (₮)" value={price} onChange={e => setPrice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border text-sm">Цуцлах</button>
              <button onClick={submit} disabled={saving || !title || !sellerName}
                className="flex-1 py-2 rounded-lg bg-teal-600 text-white text-sm disabled:opacity-50">
                {saving ? '...' : 'Нийтлэх'}
              </button>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
          <button onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${filterCat === 'all' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border'}`}>
            Бүгд ({listings.length})
          </button>
          {categories.map(c => {
            const count = listings.filter(l => l.category === c.value).length;
            if (count === 0) return null;
            return (
              <button key={c.value} onClick={() => setFilterCat(c.value === filterCat ? 'all' : c.value)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${filterCat === c.value ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border'}`}>
                {c.icon} {c.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">🏪</p>
            <p className="text-gray-400">Зар байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(l => {
              const cat = getCat(l.category);
              const typ = getType(l.listing_type);
              return (
                <div key={l.id} className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat.icon}</span>
                      <div>
                        <h3 className="font-medium text-sm">{l.title}</h3>
                        <p className="text-xs text-gray-500">{l.seller_name} · {l.seller_unit} тоот</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typ.color}`}>{typ.label}</span>
                  </div>
                  {l.description && <p className="text-xs text-gray-500 mt-1.5 ml-8">{l.description}</p>}
                  <div className="flex justify-between items-center mt-2 ml-8">
                    {l.price > 0 && <span className="font-bold text-sm text-teal-700">{l.price.toLocaleString()}₮</span>}
                    {l.price === 0 && l.listing_type === 'free' && <span className="font-bold text-sm text-purple-600">Үнэгүй</span>}
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="text-xs text-blue-600 flex items-center gap-1">
                        📞 {l.phone}
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 ml-8">{new Date(l.created_at).toLocaleDateString('mn-MN')}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
