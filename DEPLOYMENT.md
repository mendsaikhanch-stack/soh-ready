# Тоот — Deployment, Play Store, Өөрчлөлтийн Заавар

## 1. Хүнд үзүүлэх / Демо харуулах

### Live URL
- **Апп:** https://soh-ready.vercel.app/app
- **Админ:** https://soh-ready.vercel.app/admin (admin / Toot@2024!Secure)
- **Super Admin:** https://soh-ready.vercel.app/superadmin (superadmin / Super@Toot2024!)

### Утсаар үзүүлэх
1. Утасны browser-ээр https://soh-ready.vercel.app/app руу орно
2. Бүртгүүлэх → Нэвтрэх → СӨХ dashboard харагдана
3. Бүх feature-ууд ажиллана (төлбөр, зарлал, чат, засвар гэх мэт)

### "Апп суулгах" (PWA)
Хэрэглэгч browser-ээс шууд суулгаж болно:
- **Android Chrome:** Цэс → "Нүүр хуудас руу нэмэх" / "Install app"
- **iPhone Safari:** Share → "Нүүр хуудас руу нэмэх"
- Суулгасны дараа бодит апп шиг icon-тойгоор нээгдэнэ

---

## 2. Google Play Store-д байрлуулах (TWA)

Тоот апп нь **PWA** (Progressive Web App) тул Play Store-д **TWA** (Trusted Web Activity) ашиглаж байрлуулна.

### Алхам 1: Бэлтгэл
1. **Google Play Developer Account** үүсгэх — https://play.google.com/console
   - Нэг удаагийн $25 төлбөр
   - Хувь хүн эсвэл байгууллагаар бүртгүүлнэ

2. **Icon-ууд бэлтгэх:**
   - `public/icons/icon-192.png` — 192x192px (PNG, ил тод дэвсгэр)
   - `public/icons/icon-512.png` — 512x512px (PNG, ил тод дэвсгэр)
   - Feature graphic: 1024x500px (Play Store-д харагдах зураг)

### Алхам 2: Bubblewrap ашиглан APK үүсгэх
```bash
# Bubblewrap суулгах
npm install -g @nicolo-ribaudo/bubblewrap

# TWA project үүсгэх
bubblewrap init --manifest https://soh-ready.vercel.app/manifest.json

# Асуултуудад хариулна:
#   - Package name: mn.toot.app
#   - App name: Тоот
#   - Launcher name: Тоот
#   - Display mode: standalone
#   - Host: soh-ready.vercel.app
#   - Start URL: /app
#   - Theme color: #2563eb
#   - Splash screen color: #ffffff

# APK build хийх
bubblewrap build
```

### Алхам 3: Digital Asset Links тохируулах
Bubblewrap-с SHA256 fingerprint өгнө. Үүнийг Vercel-д тохируулна:

1. `public/.well-known/assetlinks.json` файл үүсгэх:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "mn.toot.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

2. Vercel-д deploy хийх:
```bash
cd /c/Users/MNG/Desktop/projects/soh-ready
git add . && git commit -m "feat: assetlinks нэмэв" && git push
npx vercel --prod --yes
```

### Алхам 4: Play Store-д байрлуулах
1. Google Play Console → Create app
2. App details бөглөх (Монгол хэлээр)
3. APK upload хийх
4. Content rating questionnaire бөглөх
5. Privacy policy URL оруулах
6. Review-д илгээх (1-7 хоног хүлээнэ)

### Алтернатив: PWABuilder ашиглах
Илүү хялбар арга:
1. https://pwabuilder.com руу орох
2. `https://soh-ready.vercel.app` оруулах
3. "Package for stores" → Android → Download
4. Автоматаар APK үүсгэнэ

---

## 3. iOS App Store-д байрлуулах

PWA-г App Store-д шууд байрлуулах боломжгүй. 2 сонголт:

### Сонголт A: PWA хэвээр (Recommended)
- iPhone хэрэглэгчид Safari-ар "Нүүр хуудас руу нэмэх" дарна
- Push notification iOS 16.4+ дээр ажиллана
- Хамгийн хурдан, нэмэлт зардалгүй

### Сонголт B: Capacitor ашиглан native wrapper
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Тоот" "mn.toot.app"
npx cap add ios
npx cap sync
npx cap open ios  # Xcode-д нээгдэнэ
```
- Apple Developer Account шаардлагатай ($99/жил)
- Xcode + Mac шаардлагатай

---

## 4. Custom Domain тохируулах

### Vercel дээр domain нэмэх
```bash
npx vercel domains add toot.mn
```
Эсвэл Vercel Dashboard → Settings → Domains → Add

### DNS тохируулах
Domain provider дээр:
- **A record:** 76.76.21.21
- **CNAME:** cname.vercel-dns.com

### Supabase-д site URL шинэчлэх
Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://toot.mn`
- Redirect URLs: `https://toot.mn/**`

---

## 5. Нэмэлт өөрчлөлт хийх заавар

### 5.1 Шинэ Mobile Feature нэмэх

```bash
# 1. Хавтас үүсгэх
mkdir -p "app/(mobile)/sokh/[id]/шинэ-feature"

# 2. page.tsx бичих
```

**page.tsx загвар:**
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

export default function NewFeaturePage() {
  const params = useParams();
  const router = useRouter();
  const sokhId = params.id as string;

  // Supabase-с data татах
  useEffect(() => {
    supabase.from('your_table').select('*').eq('sokh_id', sokhId)
      .then(({ data }) => { /* ... */ });
  }, [sokhId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${sokhId}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">Шинэ Feature</h1>
      </div>
      {/* Агуулга */}
    </div>
  );
}
```

**3. Dashboard цэсэнд нэмэх** — `app/(mobile)/sokh/[id]/page.tsx` файлын `menuItems` массивт:
```tsx
{ icon: '🆕', label: 'Шинэ', desc: 'Тайлбар', href: 'шинэ-feature', color: 'bg-blue-50 border-blue-200' },
```

### 5.2 Шинэ Admin Feature нэмэх

```bash
mkdir -p "app/admin/шинэ-feature"
```

**Чухал:** Admin page-д бичих операцууд `adminFrom()` ашиглана:
```tsx
import { supabase } from '@/app/lib/supabase';       // SELECT-д
import { adminFrom } from '@/app/lib/admin-db';       // INSERT/UPDATE/DELETE-д

// Унших
const { data } = await supabase.from('table').select('*');

// Бичих (admin proxy-р дамжина)
await adminFrom('table').insert([{ ... }]);
await adminFrom('table').update({ ... }).eq('id', id);
await adminFrom('table').delete().eq('id', id);
```

**Admin sidebar-д нэмэх** — `app/admin/layout.tsx` файлын `navItems`:
```tsx
{ icon: '🆕', label: 'Шинэ', href: '/admin/шинэ-feature' },
```

### 5.3 Шинэ Supabase Table нэмэх

```sql
-- 1. Supabase SQL Editor-т:
CREATE TABLE IF NOT EXISTS шинэ_table (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  -- бусад columns...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS идэвхжүүлэх
ALTER TABLE шинэ_table ENABLE ROW LEVEL SECURITY;

-- 3. Policy нэмэх
CREATE POLICY "select" ON шинэ_table FOR SELECT USING (true);
CREATE POLICY "insert_auth" ON шинэ_table FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
-- UPDATE/DELETE: зөвхөн admin (service_role)
```

### 5.4 Deploy хийх

```bash
cd /c/Users/MNG/Desktop/projects/soh-ready

# 1. Build шалгах
npx next build

# 2. Commit + push
git add .
git commit -m "feat: тайлбар"
git push

# 3. Vercel deploy (auto deploy идэвхтэй бол push хийхэд автомат)
# Эсвэл гараар:
npx vercel --prod --yes
```

---

## 6. Түгээмэл асуудлууд ба шийдлүүд

### Асуудал 1: "Insert blocked by RLS"
**Шалтгаан:** Хэрэглэгч нэвтрээгүй (anon) байхад authenticated шаардсан table руу бичих гэсэн.
**Шийдэл:**
- Mobile page: Хэрэглэгч нэвтэрсэн эсэхийг шалгах. `/sokh/[id]/layout.tsx` нэвтрээгүй бол `/login` руу чиглүүлнэ.
- Admin page: `adminFrom()` ашиглах (service_role proxy).

### Асуудал 2: Admin page-д "Unauthorized" алдаа
**Шалтгаан:** Admin session cookie дууссан эсвэл `/api/admin/db` руу хандах эрхгүй.
**Шийдэл:** Admin panel-д дахин нэвтрэх. Session 24 цагийн дараа дуусна.

### Асуудал 3: Build алдаа — TypeScript type error
**Шалтгаан:** `adminFrom()` буцаах error нь `string` төрөлтэй (`error.message` биш `error`).
**Шийдэл:**
```tsx
// Буруу:
if (error) alert(error.message);
// Зөв:
if (error) alert(error);
```

### Асуудал 4: Vercel deploy амжилтгүй
**Шалтгаан:** Environment variable дутуу.
**Шийдэл:**
```bash
npx vercel env ls  # Бүх env vars шалгах
# Дутуу бол нэмэх:
echo "утга" | npx vercel env add VARIABLE_NAME production --force
```

**Шаардлагатай env vars:**
| Variable | Тайлбар |
|----------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key |
| ADMIN_PASSWORD | Admin нууц үг |
| SUPER_PASSWORD | Super admin нууц үг |
| SESSION_SECRET | Session шифрлэлт |
| QPAY_BASE_URL | QPay API URL |
| QPAY_USERNAME | QPay merchant username |
| QPAY_PASSWORD | QPay merchant password |
| QPAY_INVOICE_CODE | QPay invoice code |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | Push notification public key |
| VAPID_PRIVATE_KEY | Push notification private key |

### Асуудал 5: Push notification ажиллахгүй
**Шалтгаан:** HTTPS шаардлагатай (localhost-д ажиллахгүй), `push_subscriptions` table үүсгээгүй.
**Шийдэл:**
1. Vercel дээр тест хийх (HTTPS)
2. Supabase-д `supabase-push-migration.sql` ажиллуулсан эсэх шалгах

### Асуудал 6: QPay QR код гарахгүй
**Шалтгаан:** Sandbox credentials дууссан эсвэл QPay сервер унтарсан.
**Шийдэл:**
1. `.env.local` дахь QPay credentials шалгах
2. Production-д QPay-с бодит merchant credentials авах (info@qpay.mn)

### Асуудал 7: Шинэ page нэмсэн ч харагдахгүй
**Шалтгаан:** Dashboard цэсэнд нэмээгүй.
**Шийдэл:**
- Mobile: `app/(mobile)/sokh/[id]/page.tsx` → `menuItems` массивт нэмэх
- Admin: `app/admin/layout.tsx` → `navItems` массивт нэмэх

### Асуудал 8: Supabase data гарахгүй (хоосон)
**Шалтгаан:** Table хоосон эсвэл sokh_id таарахгүй.
**Шийдэл:**
1. Supabase Dashboard → Table Editor → тухайн table-д data байгаа эсэх шалгах
2. `sokh_id` зөв утгатай эсэх шалгах (ихэвчлэн 7)

---

## 7. Production шилжихэд солих зүйлс

| Зүйл | Одоо | Production-д |
|-------|------|-------------|
| QPay | Sandbox credentials | QPay-с бодит merchant key авах |
| Нууц үг | `Toot@2024!Secure` | Хүчтэй нууц үг солих |
| Session secret | Placeholder | Санамсаргүй 64+ тэмдэгт |
| Domain | soh-ready.vercel.app | toot.mn (custom domain) |
| RLS | SELECT нээлттэй | sokh_id-р хязгаарлах |
| Supabase | Free tier | Pro plan ($25/сар) - backup, 8GB |
| Vercel | Free tier | Pro plan ($20/сар) - bandwidth |

---

## 8. Тусламж

- **Код засвар:** Claude Code ашиглах
- **Supabase:** https://supabase.com/docs
- **Vercel:** https://vercel.com/docs
- **QPay:** info@qpay.mn
- **PWA Builder:** https://pwabuilder.com
