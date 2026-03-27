'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { getAdminSokhId } from '@/app/lib/admin-config';
import { themes, getTheme } from '@/app/lib/themes';
import LogoUpload from '@/app/components/LogoUpload';
import Image from 'next/image';

export default function BrandingPage() {
  const [sokhId, setSokhId] = useState<number | null>(null);
  const [sokhName, setSokhName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrg = async () => {
      const adminSokhId = await getAdminSokhId();
      const { data } = await supabase
        .from('sokh_organizations')
        .select('id, name, logo_url, theme')
        .eq('id', adminSokhId)
        .single();

      if (data) {
        setSokhId(data.id);
        setSokhName(data.name);
        setLogoUrl(data.logo_url || null);
        setSelectedTheme(data.theme || 'classic');
      }
      setLoading(false);
    };
    fetchOrg();
  }, []);

  const handleSave = async () => {
    if (!sokhId) return;
    setSaving(true);
    setSaved(false);

    await supabase
      .from('sokh_organizations')
      .update({ logo_url: logoUrl || null, theme: selectedTheme })
      .eq('id', sokhId);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const currentTheme = getTheme(selectedTheme);

  if (loading) return <div className="p-8 text-gray-400">Ачаалж байна...</div>;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Брэнд тохиргоо</h1>
      <p className="text-sm text-gray-500 mb-8">Таны СӨХ-ийн лого, өнгө загварыг тохируулна</p>

      {/* Logo Section */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="font-semibold mb-1">Лого</h2>
        <p className="text-sm text-gray-500 mb-4">Таны байгууллагын лого апп болон админ хэсэгт харагдана</p>
        {sokhId && (
          <LogoUpload
            currentUrl={logoUrl}
            sokhId={sokhId}
            onUploaded={(url) => setLogoUrl(url || null)}
          />
        )}
      </div>

      {/* Theme Selection */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="font-semibold mb-1">Загвар сонгох</h2>
        <p className="text-sm text-gray-500 mb-4">Апп-ийн өнгө, загварыг өөрчлөх</p>

        <div className="grid grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                selectedTheme === theme.id
                  ? 'border-blue-500 ring-2 ring-blue-200 scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Theme preview card */}
              <div className={`${theme.preview} h-20 p-3 flex items-end`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-white/30 rounded-full" />
                  <div>
                    <div className="w-16 h-1.5 bg-white/50 rounded-full" />
                    <div className="w-10 h-1 bg-white/30 rounded-full mt-1" />
                  </div>
                </div>
              </div>
              {/* Mini menu preview */}
              <div className="bg-white p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${theme.preview.includes('gray-800') ? 'bg-gray-300' : theme.preview.split(' ')[1]?.replace('from-', 'bg-') || 'bg-blue-200'}`} />
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-100" />
                  <div className="w-10 h-1.5 bg-gray-100 rounded-full" />
                </div>
              </div>
              <div className="px-2 pb-2">
                <p className="text-xs font-medium text-gray-700">{theme.name}</p>
              </div>

              {/* Selected indicator */}
              {selectedTheme === theme.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">&#10003;</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="font-semibold mb-1">Урьдчилан харах</h2>
        <p className="text-sm text-gray-500 mb-4">Таны апп ийм харагдана</p>

        <div className="max-w-[320px] mx-auto rounded-2xl overflow-hidden shadow-xl border">
          {/* Phone header */}
          <div className={`${currentTheme.header} ${currentTheme.headerText} px-4 py-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <Image src={logoUrl} alt="Logo" width={32} height={32} className="w-8 h-8 rounded-lg object-contain bg-white/20" />
                ) : (
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">
                    {sokhName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold">{sokhName || 'Таны СӨХ'}</p>
                  <p className="text-xs opacity-60">Хаяг</p>
                </div>
              </div>
              <span className="text-lg">&#128276;</span>
            </div>
          </div>
          {/* Stats */}
          <div className="bg-gray-50 p-3">
            <div className="grid grid-cols-3 gap-2">
              {['Айл өрх', 'Нийт өр', 'Зарлал'].map((label) => (
                <div key={label} className={`${currentTheme.statBg} rounded-lg p-2 text-center shadow-sm`}>
                  <p className="text-sm font-bold">--</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Menu items */}
          <div className="bg-gray-50 px-3 pb-3 space-y-1.5">
            {[
              { icon: '&#128176;', label: 'Төлбөр', active: true },
              { icon: '&#128227;', label: 'Зарлал', active: false },
              { icon: '&#128295;', label: 'Засвар', active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm ${
                  item.active ? `${currentTheme.cardBg} ${currentTheme.cardBorder}` : 'bg-white border-gray-100'
                }`}
              >
                <span dangerouslySetInnerHTML={{ __html: item.icon }} />
                <span className="font-medium text-xs">{item.label}</span>
                <span className="ml-auto text-gray-300 text-xs">&#8250;</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium">Амжилттай хадгаллаа!</span>
        )}
      </div>
    </div>
  );
}
