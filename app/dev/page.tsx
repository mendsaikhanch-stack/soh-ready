'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ==================== CREDENTIALS ====================
const roles = [
  {
    id: 'resident',
    name: 'Оршин суугч',
    icon: '🏠',
    color: 'bg-green-600',
    username: 'test@test.com',
    password: '(Supabase Auth)',
    loginUrl: '/login',
    dashboardUrl: '/sokh/1',
    description: 'Оршин суугчийн утасны апп',
    type: 'supabase',
  },
  {
    id: 'admin',
    name: 'СӨХ Админ',
    icon: '🏢',
    color: 'bg-blue-600',
    username: 'admin',
    password: 'Toot@2024!Secure',
    loginUrl: '/admin',
    dashboardUrl: '/admin',
    description: 'Байрны удирдлагын панел',
    type: 'cookie',
  },
  {
    id: 'inspector',
    name: 'Байцаагч',
    icon: '🔍',
    color: 'bg-indigo-600',
    username: '(DB-ээс)',
    password: '(DB-ээс)',
    loginUrl: '/inspector',
    dashboardUrl: '/inspector',
    description: 'ОСНААК шалгалтын апп',
    type: 'db',
  },
  {
    id: 'superadmin',
    name: 'Супер Админ',
    icon: 'S',
    color: 'bg-purple-600',
    username: 'superadmin',
    password: 'Super@Toot2024!',
    loginUrl: '/superadmin',
    dashboardUrl: '/superadmin',
    description: 'Платформ удирдлага',
    type: 'cookie',
  },
  {
    id: 'osnaa',
    name: 'ОСНААК Админ',
    icon: '⚡',
    color: 'bg-amber-600',
    username: 'osnaa',
    password: 'Osnaa@Toot2024!',
    loginUrl: '/osnaa',
    dashboardUrl: '/osnaa',
    description: 'Ус, Дулаан, Цахилгаан удирдлага',
    type: 'cookie',
  },
];

// ==================== FEATURE ROADMAP ====================
interface Feature {
  name: string;
  status: 'done' | 'partial' | 'todo';
  category: string;
  note?: string;
}

const features: Feature[] = [
  // ===== Хийгдсэн =====
  { name: 'Оршин суугч бүртгэл (Хот > Дүүрэг > Хороо > СӨХ)', status: 'done', category: 'Auth' },
  { name: 'Supabase Auth (email/password)', status: 'done', category: 'Auth' },
  { name: 'Admin / SuperAdmin / OSNAA cookie auth', status: 'done', category: 'Auth' },
  { name: 'Inspector DB auth', status: 'done', category: 'Auth' },
  { name: 'QR кодоор нэвтрэх', status: 'done', category: 'Auth' },
  { name: 'Rate limiting (5 удаа, 15 мин түгжих)', status: 'done', category: 'Auth' },
  { name: 'Middleware protected routes', status: 'done', category: 'Auth' },

  { name: 'Dashboard (өр, зарлал, quick actions, skeleton)', status: 'done', category: 'Оршин суугч' },
  { name: 'Төлбөр хуудас + QPay gateway', status: 'done', category: 'Оршин суугч' },
  { name: 'Засвар хүсэлт', status: 'done', category: 'Оршин суугч' },
  { name: 'Гомдол / Санал', status: 'done', category: 'Оршин суугч' },
  { name: 'Тоолуур заалт оруулах', status: 'done', category: 'Оршин суугч' },
  { name: 'Хөрш чат', status: 'done', category: 'Оршин суугч' },
  { name: 'Хөрш маркетплэйс', status: 'done', category: 'Оршин суугч' },
  { name: 'Нийтийн зай захиалга', status: 'done', category: 'Оршин суугч' },
  { name: 'Gamification оноо', status: 'done', category: 'Оршин суугч' },
  { name: 'Илгээмж хүлээн авах', status: 'done', category: 'Оршин суугч' },
  { name: 'Дэлгүүр & Автомат машин', status: 'done', category: 'Оршин суугч' },
  { name: 'Ашиглалтын түүх (ус/дулаан/цахилгаан)', status: 'done', category: 'Оршин суугч' },
  { name: 'Яаралтай мэдэгдэл', status: 'done', category: 'Оршин суугч' },
  { name: 'Санхүүгийн ил тод дашбоард', status: 'done', category: 'Оршин суугч' },
  { name: 'Pull-to-refresh', status: 'done', category: 'Оршин суугч' },
  { name: 'Үйлчилгээ хайлт', status: 'done', category: 'Оршин суугч' },

  { name: 'Оршин суугчид CRUD', status: 'done', category: 'СӨХ Админ' },
  { name: 'Төлбөр удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Зарлал', status: 'done', category: 'СӨХ Админ' },
  { name: 'Засвар удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Тайлан + PDF export', status: 'done', category: 'СӨХ Админ' },
  { name: 'Гомдол / Санал удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Ашиглалт удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Ажилчид удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Яаралтай мэдэгдэл', status: 'done', category: 'СӨХ Админ' },
  { name: 'Санал хураалт CRUD', status: 'done', category: 'СӨХ Админ' },
  { name: 'Мессеж', status: 'done', category: 'СӨХ Админ' },
  { name: 'Маркетплэйс удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Зай захиалга удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Санхүү', status: 'done', category: 'СӨХ Админ' },
  { name: 'Илгээмж удирдлага', status: 'done', category: 'СӨХ Админ' },
  { name: 'Дэлгүүр & Автомат', status: 'done', category: 'СӨХ Админ' },
  { name: 'Зогсоол (Supabase)', status: 'done', category: 'СӨХ Админ' },
  { name: 'CCTV (Supabase)', status: 'done', category: 'СӨХ Админ' },
  { name: 'Файл импорт', status: 'done', category: 'СӨХ Админ' },
  { name: 'Брэнд тохиргоо (лого + загвар)', status: 'done', category: 'СӨХ Админ' },
  { name: 'Автомат төлбөрийн сануулга cron', status: 'done', category: 'СӨХ Админ' },

  { name: 'ОСНААК админ панел', status: 'done', category: 'ОСНААК' },
  { name: 'ОСНААК байгууллагууд', status: 'done', category: 'ОСНААК' },
  { name: 'ОСНААК нэхэмжлэх', status: 'done', category: 'ОСНААК' },
  { name: 'Байцаагчийн апп (скан, зөрчил, тайлан)', status: 'done', category: 'ОСНААК' },
  { name: 'Тоолуур заалт удирдлага', status: 'done', category: 'ОСНААК' },

  { name: 'Супер Админ дашбоард', status: 'done', category: 'Супер Админ' },
  { name: 'СӨХ-үүд удирдлага', status: 'done', category: 'Супер Админ' },
  { name: 'Хэрэглэгчид', status: 'done', category: 'Супер Админ' },
  { name: 'Аналитик', status: 'done', category: 'Супер Админ' },
  { name: 'Орлого', status: 'done', category: 'Супер Админ' },

  { name: 'Web Push Notification', status: 'done', category: 'Систем' },
  { name: 'Dark mode', status: 'done', category: 'Систем' },
  { name: 'Offline горим (service worker)', status: 'done', category: 'Систем' },
  { name: 'Multi-language (MN/EN)', status: 'done', category: 'Систем' },
  { name: 'Loading skeleton UI', status: 'done', category: 'Систем' },
  { name: 'RLS policy + security headers', status: 'done', category: 'Систем' },
  { name: 'PWA manifest', status: 'done', category: 'Систем' },

  // ===== Хагас хийгдсэн =====
  { name: 'QPay production credentials', status: 'partial', category: 'Төлбөр', note: 'Sandbox ажиллаж байгаа, production key хэрэгтэй' },
  { name: 'Inspector нууц үг hash-лэх', status: 'done', category: 'Auth', note: 'bcryptjs ашиглан hash-лагдсан' },
  { name: 'OSNAA_PASSWORD env-д нэмэх', status: 'done', category: 'Auth', note: '.env.local-д тохируулагдсан, fallback арилгасан' },

  // ===== Хийгдээгүй / Санал болгох =====
  { name: 'Оршин суугч profile засах', status: 'done', category: 'Оршин суугч', note: 'Нэр, утас засах — /sokh/[id]/profile' },
  { name: 'Төлбөрийн түүх (receipt)', status: 'done', category: 'Оршин суугч', note: 'Баримт харах, хуулах, хуваалцах' },
  { name: 'Зарлал push notification', status: 'done', category: 'СӨХ Админ', note: 'Зарлал нийтлэхэд автомат push илгээнэ' },
  { name: 'SMS мэдэгдэл', status: 'todo', category: 'Систем', note: 'Төлбөрийн сануулга SMS-ээр' },
  { name: 'Email мэдэгдэл', status: 'todo', category: 'Систем', note: 'Бүртгэл баталгаажуулалт, сануулга' },
  { name: 'Хэрэглэгчийн гарын авлага', status: 'done', category: 'Систем', note: '/sokh/[id]/guide — accordion заавар' },
  { name: 'Олон СӨХ дэмжлэг (multi-tenant)', status: 'todo', category: 'Систем', note: 'Нэг хэрэглэгч олон СӨХ-д бүртгэлтэй' },
  { name: 'Засвар хүсэлтэнд зураг хавсаргах', status: 'done', category: 'Оршин суугч', note: 'Камер/галерей-аас зураг хавсаргана' },
  { name: 'Санал хураалтын real-time үр дүн', status: 'done', category: 'Оршин суугч', note: 'Supabase realtime + санал өгөх ажиллана' },
  { name: 'Зогсоолын QR код', status: 'done', category: 'СӨХ Админ', note: 'Машин бүрт QR код үүсгэж хаалтанд уншуулах' },
  { name: 'Тайлан автомат email илгээх', status: 'todo', category: 'СӨХ Админ', note: 'Сар бүр тайлан PDF-ээр илгээх' },
  { name: 'Ажилчдын цалин тооцоо', status: 'done', category: 'СӨХ Админ', note: 'НДШ + ХХОАТ тооцоо, цалингийн хүснэгт' },
  { name: 'Лифт засвар хуваарь', status: 'done', category: 'СӨХ Админ', note: '/admin/elevator — хуваарь, хариуцагч, төлөв' },
  { name: 'Орцны хаалга нээх (smart lock)', status: 'todo', category: 'Оршин суугч', note: 'Bluetooth/NFC хаалга нээх' },
  { name: 'Visitor management', status: 'done', category: 'Оршин суугч', note: 'QR код үүсгэх, хуваалцах, 24ц хугацаатай' },
  { name: 'Production deploy (Vercel)', status: 'todo', category: 'Систем', note: 'Vercel-д deploy хийх' },
];

// ==================== COMPONENT ====================
export default function DevPage() {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'partial' | 'todo'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newFeature, setNewFeature] = useState('');
  const [newCategory, setNewCategory] = useState('Оршин суугч');
  const [newNote, setNewNote] = useState('');
  const [localFeatures, setLocalFeatures] = useState<Feature[]>([]);
  const [devLoggedIn, setDevLoggedIn] = useState(false);
  const [devLogging, setDevLogging] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('dev_extra_features');
    if (saved) setLocalFeatures(JSON.parse(saved));
  }, []);

  const allFeatures = [...features, ...localFeatures];
  const categories = [...new Set(allFeatures.map(f => f.category))];

  const filtered = allFeatures.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    return true;
  });

  const stats = {
    done: allFeatures.filter(f => f.status === 'done').length,
    partial: allFeatures.filter(f => f.status === 'partial').length,
    todo: allFeatures.filter(f => f.status === 'todo').length,
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    const feat: Feature = { name: newFeature, status: 'todo', category: newCategory, note: newNote || undefined };
    const updated = [...localFeatures, feat];
    setLocalFeatures(updated);
    localStorage.setItem('dev_extra_features', JSON.stringify(updated));
    setNewFeature('');
    setNewNote('');
  };

  const removeLocalFeature = (idx: number) => {
    const updated = localFeatures.filter((_, i) => i !== idx);
    setLocalFeatures(updated);
    localStorage.setItem('dev_extra_features', JSON.stringify(updated));
  };

  const statusIcon = (s: string) => s === 'done' ? '✅' : s === 'partial' ? '🟡' : '⬜';
  const statusLabel = (s: string) => s === 'done' ? 'Хийгдсэн' : s === 'partial' ? 'Хагас' : 'Хийгдээгүй';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">🛠 Dev Panel</h1>
            <p className="text-gray-500 text-sm mt-1">Нууц үг + Feature шалгах хуудас</p>
          </div>
          <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition">
            Нүүр хуудас
          </button>
        </div>

        {/* ==================== DEV LOGIN ==================== */}
        <div className="mb-6">
          <button
            onClick={async () => {
              setDevLogging(true);
              try {
                const res = await fetch('/api/auth/dev-login', { method: 'POST' });
                const data = await res.json();
                if (data.success) setDevLoggedIn(true);
              } catch {}
              setDevLogging(false);
            }}
            disabled={devLogging || devLoggedIn}
            className={`w-full py-4 rounded-xl font-bold text-lg transition ${
              devLoggedIn
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 active:scale-[0.99]'
            }`}
          >
            {devLoggedIn ? '✅ Бүх роль-д нэвтэрсэн — аль ч хуудас руу орж болно' : devLogging ? '⏳ Нэвтэрч байна...' : '🚀 Бүгдэд нэг дор нэвтрэх (Admin, ОСНАА, SuperAdmin, Inspector)'}
          </button>
        </div>

        {/* ==================== CREDENTIALS ==================== */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">🔑 Нэвтрэх мэдээлэл</h2>
            <button
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition"
            >
              {showPasswords ? '🙈 Нуух' : '👁 Харуулах'}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map(role => (
              <div key={role.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 ${role.color} rounded-xl flex items-center justify-center text-white text-lg font-bold`}>
                    {role.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{role.name}</h3>
                    <p className="text-[11px] text-gray-500">{role.description}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-500 text-xs">Нэр:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-green-400 text-xs">{role.username}</code>
                      {role.type !== 'db' && (
                        <button onClick={() => copyText(role.username, `${role.id}-user`)}
                          className="text-[10px] text-gray-600 hover:text-white">
                          {copied === `${role.id}-user` ? '✓' : '📋'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className="text-gray-500 text-xs">Нууц үг:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-amber-400 text-xs">
                        {showPasswords ? role.password : '••••••••'}
                      </code>
                      {role.type !== 'db' && role.type !== 'supabase' && (
                        <button onClick={() => copyText(role.password, `${role.id}-pass`)}
                          className="text-[10px] text-gray-600 hover:text-white">
                          {copied === `${role.id}-pass` ? '✓' : '📋'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => router.push(role.loginUrl)}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium text-white ${role.color} hover:opacity-90 transition`}
                  >
                    Нэвтрэх
                  </button>
                  <button
                    onClick={() => router.push(role.dashboardUrl)}
                    className="flex-1 text-xs py-2 rounded-lg font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 transition"
                  >
                    Dashboard
                  </button>
                </div>

                {role.type === 'db' && (
                  <p className="text-[10px] text-gray-600 mt-2 text-center">
                    * Supabase inspectors хүснэгтээс
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ==================== FEATURE ROADMAP ==================== */}
        <div>
          <h2 className="text-lg font-bold mb-4">📋 Feature жагсаалт</h2>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <button onClick={() => setFilterStatus(filterStatus === 'done' ? 'all' : 'done')}
              className={`p-3 rounded-xl text-center transition ${filterStatus === 'done' ? 'bg-green-900/50 border border-green-700' : 'bg-gray-900 border border-gray-800'}`}>
              <div className="text-2xl font-bold text-green-400">{stats.done}</div>
              <div className="text-[11px] text-gray-500">✅ Хийгдсэн</div>
            </button>
            <button onClick={() => setFilterStatus(filterStatus === 'partial' ? 'all' : 'partial')}
              className={`p-3 rounded-xl text-center transition ${filterStatus === 'partial' ? 'bg-yellow-900/50 border border-yellow-700' : 'bg-gray-900 border border-gray-800'}`}>
              <div className="text-2xl font-bold text-yellow-400">{stats.partial}</div>
              <div className="text-[11px] text-gray-500">🟡 Хагас</div>
            </button>
            <button onClick={() => setFilterStatus(filterStatus === 'todo' ? 'all' : 'todo')}
              className={`p-3 rounded-xl text-center transition ${filterStatus === 'todo' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-900 border border-gray-800'}`}>
              <div className="text-2xl font-bold text-gray-400">{stats.todo}</div>
              <div className="text-[11px] text-gray-500">⬜ Хийгдээгүй</div>
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            <button onClick={() => setFilterCategory('all')}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${filterCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
              Бүгд
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-lg transition ${filterCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Feature list */}
          <div className="space-y-1.5 mb-6">
            {filtered.map((f, i) => {
              const isLocal = i >= features.length;
              const localIdx = i - features.length;
              return (
                <div key={i} className="flex items-start gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5">
                  <span className="text-sm mt-0.5">{statusIcon(f.status)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{f.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">{f.category}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        f.status === 'done' ? 'bg-green-900/50 text-green-400' :
                        f.status === 'partial' ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-gray-800 text-gray-500'
                      }`}>{statusLabel(f.status)}</span>
                    </div>
                    {f.note && <p className="text-[11px] text-gray-600 mt-0.5">{f.note}</p>}
                  </div>
                  {isLocal && (
                    <button onClick={() => removeLocalFeature(localIdx)}
                      className="text-gray-700 hover:text-red-400 text-xs px-1">✕</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add feature */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold mb-3">+ Шинэ feature нэмэх</h3>
            <div className="space-y-2">
              <input
                type="text"
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                placeholder="Feature нэр..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Тэмдэглэл (optional)..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
              <button
                onClick={addFeature}
                disabled={!newFeature.trim()}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-30"
              >
                Нэмэх
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-[11px] text-gray-700">
          Dev Panel — зөвхөн хөгжүүлэгчид зориулсан
        </div>
      </div>
    </div>
  );
}
