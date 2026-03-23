'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';

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

const categories: Record<string, string> = {
  furniture: '🪑 Тавилга', electronics: '📱 Цахилгаан', kids: '👶 Хүүхдийн',
  clothing: '👕 Хувцас', books: '📚 Ном', kitchen: '🍳 Гал тогоо',
  sports: '⚽ Спорт', other: '📦 Бусад',
};

export default function AdminMarketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(); }, []);
  const fetch = async () => {
    const { data } = await supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false });
    setListings(data || []); setLoading(false);
  };

  const toggle = async (id: number, status: string) => {
    await adminFrom('marketplace_listings').update({ status: status === 'active' ? 'inactive' : 'active' }).eq('id', id);
    await fetch();
  };

  const del = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('marketplace_listings').delete().eq('id', id);
    await fetch();
  };

  const active = listings.filter(l => l.status === 'active').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🏪 Хөрш маркет</h1>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-teal-50 border-teal-200">
          <p className="text-xl font-bold text-teal-700">{active}</p>
          <p className="text-xs text-gray-500">Идэвхтэй зар</p>
        </div>
        <div className="rounded-xl border p-4 bg-gray-50">
          <p className="text-xl font-bold">{listings.length - active}</p>
          <p className="text-xs text-gray-500">Идэвхгүй</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{listings.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">Ачаалж байна...</p> : (
        <div className="space-y-3">
          {listings.map(l => (
            <div key={l.id} className={`bg-white border rounded-xl p-4 ${l.status !== 'active' ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{categories[l.category] || l.category}</span>
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">{l.listing_type}</span>
                  </div>
                  <h3 className="font-semibold text-sm">{l.title}</h3>
                  <p className="text-xs text-gray-500">{l.seller_name} · {l.seller_unit} тоот · 📞 {l.phone}</p>
                  {l.description && <p className="text-xs text-gray-500 mt-1">{l.description}</p>}
                  {l.price > 0 && <p className="text-sm font-bold text-teal-700 mt-1">{l.price.toLocaleString()}₮</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(l.created_at).toLocaleDateString('mn-MN')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggle(l.id, l.status)}
                    className={`text-xs px-2 py-1 rounded-full ${l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {l.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                  </button>
                  <button onClick={() => del(l.id)} className="text-xs text-red-400 hover:underline">Устгах</button>
                </div>
              </div>
            </div>
          ))}
          {listings.length === 0 && <p className="text-gray-400 text-center py-8">Зар байхгүй</p>}
        </div>
      )}
    </div>
  );
}
