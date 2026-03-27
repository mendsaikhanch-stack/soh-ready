'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface FeatureItem {
  href: string;
  icon: string;
  label: string;
  desc: string;
  tab: string;
}

const allFeatures: FeatureItem[] = [
  // СӨХ таб
  { href: 'payments', icon: '💰', label: 'Төлбөр', desc: 'СӨХ хураамж төлөх', tab: 'СӨХ' },
  { href: 'reports', icon: '📋', label: 'Тайлан', desc: 'Санхүүгийн тайлан', tab: 'СӨХ' },
  { href: 'finance', icon: '💰', label: 'Санхүү', desc: 'Төлбөр зарцуулалт', tab: 'СӨХ' },
  { href: 'announcements', icon: '📢', label: 'Зарлал', desc: 'Мэдэгдэл, мэдээлэл', tab: 'СӨХ' },
  { href: 'chat', icon: '💬', label: 'Хөрш чат', desc: 'Оршин суугчидтай ярилцах', tab: 'СӨХ' },
  { href: 'voting', icon: '🗳', label: 'Санал хураалт', desc: 'Хурал, санал асуулга', tab: 'СӨХ' },
  { href: 'marketplace', icon: '🏪', label: 'Хөрш маркет', desc: 'Зар, худалдаа', tab: 'СӨХ' },
  { href: 'complaints', icon: '📝', label: 'Гомдол / Санал', desc: 'Гомдол, санал илгээх', tab: 'СӨХ' },
  { href: 'maintenance', icon: '🔧', label: 'Засвар', desc: 'Засвар үйлчилгээ', tab: 'СӨХ' },
  { href: 'parking', icon: '🚗', label: 'Зогсоол', desc: 'Машин бүртгэл, зогсоол', tab: 'СӨХ' },
  { href: 'cctv-request', icon: '🎬', label: 'Камер бичлэг', desc: 'Бичлэг шүүх хүсэлт', tab: 'СӨХ' },
  { href: 'booking', icon: '🏢', label: 'Зай захиалга', desc: 'Хурлын өрөө, спорт заал', tab: 'СӨХ' },
  { href: 'packages', icon: '📦', label: 'Илгээмж', desc: 'Ачаа хүлээн авах', tab: 'СӨХ' },
  { href: 'residents', icon: '👥', label: 'Оршин суугчид', desc: 'Айл өрхийн жагсаалт', tab: 'СӨХ' },
  { href: 'staff', icon: '👷', label: 'Ажилчид', desc: 'Ажилтнуудын мэдээлэл', tab: 'СӨХ' },
  { href: 'emergency', icon: '🚨', label: 'Яаралтай', desc: 'Онцгой байдлын мэдэгдэл', tab: 'СӨХ' },
  { href: 'points', icon: '🏆', label: 'Оноо & Шагнал', desc: 'Урамшуулал', tab: 'СӨХ' },
  { href: 'shops', icon: '🏪', label: 'Дэлгүүр', desc: 'Хотхоны дэлгүүр', tab: 'СӨХ' },
  { href: 'contact', icon: '📞', label: 'Холбоо барих', desc: 'СӨХ-тэй холбогдох', tab: 'СӨХ' },
  { href: 'visitors', icon: '🚪', label: 'Зочны бүртгэл', desc: 'QR код, зочин бүртгэх', tab: 'СӨХ' },
  { href: 'guide', icon: '📖', label: 'Гарын авлага', desc: 'Апп ашиглах заавар', tab: 'СӨХ' },
  // ОСНАА таб
  { href: 'utilities?type=water', icon: '💧', label: 'Усны тоолуур', desc: 'Заалт оруулах', tab: 'ОСНАА' },
  { href: 'utilities?type=water&tab=bills', icon: '🧾', label: 'Усны нэхэмжлэх', desc: 'Төлбөр', tab: 'ОСНАА' },
  { href: 'utilities?type=heating', icon: '🔥', label: 'Дулааны тооцоолуур', desc: 'мкв × тариф-аар тооцох', tab: 'ОСНАА' },
  { href: 'utilities?type=heating&tab=bills', icon: '🧾', label: 'Дулааны нэхэмжлэх', desc: 'Төлбөр', tab: 'ОСНАА' },
  { href: 'maintenance?type=plumbing', icon: '🚿', label: 'Сантехникч', desc: 'Ус, халаалт засвар', tab: 'ОСНАА' },
  // Цахилгаан таб
  { href: 'utilities?type=electricity', icon: '⚡', label: 'Цахилгааны тоолуур', desc: 'Заалт оруулах', tab: 'ЦАХ' },
  { href: 'utilities?type=electricity&tab=bills', icon: '🧾', label: 'Цахилгааны нэхэмжлэх', desc: 'Төлбөр', tab: 'ЦАХ' },
  { href: 'utilities?type=electricity&tab=history', icon: '📊', label: 'Хэрэглээний түүх', desc: 'Сарын хэрэглээ', tab: 'ЦАХ' },
  { href: 'maintenance?type=electrical', icon: '⚡', label: 'Цахилгаанчин', desc: 'Утас, залгуур засвар', tab: 'ЦАХ' },
];

export default function FeaturesPage() {
  const [disabledFeatures, setDisabledFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filterTab, setFilterTab] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const sokhId = await getAdminSokhId();
      const { data } = await supabase
        .from('sokh_organizations')
        .select('disabled_features')
        .eq('id', sokhId)
        .single();
      setDisabledFeatures(data?.disabled_features || []);
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (href: string) => {
    setDisabledFeatures(prev =>
      prev.includes(href) ? prev.filter(f => f !== href) : [...prev, href]
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('sokh_organizations')
      .update({ disabled_features: disabledFeatures })
      .eq('id', sokhId);
    setSaving(false);
    setSaved(true);
  };

  const tabs = ['all', ...new Set(allFeatures.map(f => f.tab))];
  const filtered = filterTab === 'all' ? allFeatures : allFeatures.filter(f => f.tab === filterTab);
  const enabledCount = allFeatures.length - disabledFeatures.length;

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">🎛 Үйлчилгээ тохиргоо</h1>
      <p className="text-sm text-gray-500 mb-6">
        Оршин суугчдад харуулах үйлчилгээг идэвхтэй/идэвхгүй болгоно. Идэвхгүй болгосон үйлчилгээ апп-д харагдахгүй.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-xl font-bold text-green-700">{enabledCount}</p>
          <p className="text-xs text-gray-500">Идэвхтэй</p>
        </div>
        <div className="rounded-xl border p-4 bg-red-50 border-red-200">
          <p className="text-xl font-bold text-red-500">{disabledFeatures.length}</p>
          <p className="text-xs text-gray-500">Идэвхгүй</p>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{allFeatures.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setFilterTab(tab)}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${filterTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab === 'all' ? 'Бүгд' : tab}
          </button>
        ))}
      </div>

      {/* Feature list */}
      <div className="space-y-2 mb-6">
        {filtered.map(f => {
          const isDisabled = disabledFeatures.includes(f.href);
          return (
            <button
              key={f.href}
              onClick={() => toggle(f.href)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                isDisabled
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : 'bg-white border-green-200'
              }`}
            >
              <span className="text-xl">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-medium text-sm ${isDisabled ? 'text-gray-400 line-through' : ''}`}>{f.label}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{f.tab}</span>
                </div>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
              <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                isDisabled ? 'bg-gray-300' : 'bg-green-500'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isDisabled ? '' : 'translate-x-5'
                }`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Save */}
      <div className="sticky bottom-4">
        <button
          onClick={save}
          disabled={saving}
          className={`w-full py-3 rounded-xl text-sm font-bold transition ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {saving ? 'Хадгалж байна...' : saved ? '✓ Хадгалагдлаа' : 'Хадгалах'}
        </button>
      </div>
    </div>
  );
}
