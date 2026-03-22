# Тоот — Хөгжүүлэлтийн гарын авлага

## Төслийн мэдээлэл
- **Нэр:** Тоот (СӨХ удирдлагын систем)
- **Tech stack:** Next.js 16.2 + React 19 + Tailwind CSS 4 + TypeScript + Supabase
- **Repo:** https://github.com/mendsaikhanch-stack/soh-ready
- **Байршил:** `C:\Users\MNG\Desktop\projects\soh-ready`

---

## Хурдан эхлүүлэх

```bash
cd /c/Users/MNG/Desktop/projects/soh-ready
npm run dev
# http://localhost:3001 (port 3000 ихэвчлэн завгүй)
```

---

## Нэвтрэх мэдээлэл

| Түвшин | URL | Нэр | Нууц үг |
|--------|-----|-----|---------|
| Админ | /admin | `admin` | `Toot@2024!Secure` |
| Super Admin | /superadmin | `superadmin` | `Super@Toot2024!` |

> ⚠️ Production-д заавал нууц үг солино! `.env.local` дотор `ADMIN_PASSWORD_HASH`, `SUPER_PASSWORD_HASH` утгуудыг SHA256 hash-аар шинэчилнэ.

---

## Хавтасны бүтэц

```
app/
├── (mobile)/           # Оршин суугчийн mobile UI
│   ├── sokh/[id]/      # СӨХ-ийн дэд хуудсууд
│   │   ├── payments/       💰 Төлбөр
│   │   ├── reports/        📋 Тайлан
│   │   ├── announcements/  📢 Зарлал
│   │   ├── maintenance/    🔧 Засвар
│   │   ├── residents/      👥 Оршин суугчид
│   │   ├── parking/        🚗 Зогсоол
│   │   ├── cctv-request/   🎬 Камер бичлэг
│   │   ├── complaints/     📝 Гомдол/Санал
│   │   ├── utilities/      📊 Ашиглалт
│   │   ├── chat/           💬 Хөрш чат
│   │   ├── staff/          👷 Ажилчид
│   │   ├── emergency/      🚨 Яаралтай
│   │   ├── marketplace/    🏪 Хөрш маркет
│   │   ├── booking/        🏢 Зай захиалга
│   │   ├── finance/        💰 Санхүүгийн тайлан
│   │   ├── points/         🏆 Оноо & Шагнал
│   │   ├── packages/       📦 Илгээмж
│   │   ├── shops/          🏪 Дэлгүүр
│   │   ├── voting/         🗳 Санал хураалт
│   │   ├── notifications/  🔔 Мэдэгдэл
│   │   └── contact/        📞 Холбоо барих
│   ├── select/         # Хот/Дүүрэг/Хороо сонгох
│   ├── register/       # Бүртгэл
│   ├── login/          # Нэвтрэх
│   ├── demo/           # Демо хуудас
│   └── app/            # Апп мэдээлэл
│
├── admin/              # Админ панел (desktop)
│   ├── residents/      announcements/  maintenance/
│   ├── payments/       reports/        polls/
│   ├── complaints/     utilities/      staff/
│   ├── emergency/      messages/       marketplace/
│   ├── booking/        finance/        packages/
│   ├── shops/          parking/        cctv/
│   └── import/
│
├── superadmin/         # Super Admin панел
│   ├── organizations/  revenue/  users/
│   ├── analytics/      support/  settings/
│
├── (marketing)/        # Landing page
├── api/auth/           # Server-side auth API
├── lib/                # Supabase client, auth, sanitize
└── components/         # TootLogo гэх мэт
```

---

## Supabase тохиргоо

- **URL:** https://fthbatuohtiqtulsevel.supabase.co
- **Dashboard:** Supabase → SQL Editor ашиглаж table үүсгэнэ
- **RLS:** Бүх table-д RLS идэвхтэй

### Таблүүд (нийт ~20)
| Бүлэг | Таблүүд |
|-------|---------|
| Үндсэн | cities, districts, khoroos, sokh_organizations, residents, payments |
| Мэдэгдэл | announcements, messages, notifications |
| Хүсэлт | maintenance_requests, complaints |
| Санал | polls, poll_votes |
| Зогсоол | parking_vehicles, parking_events |
| Ашиглалт | utility_usage |
| Нийгэм | chat_messages, marketplace_listings |
| Удирдлага | staff, common_spaces, space_bookings |
| Санхүү | budget_items, point_activities |
| Илгээмж | packages |
| Дэлгүүр | local_shops, vending_machines |
| Яаралтай | emergency_alerts |

---

## Аюулгүй байдлын дүрэм

### Хийж болохгүй зүйлс ❌
1. **Нууц үг, API key-г кодонд хардкод хийхгүй** → `.env.local` файлд хадгална
2. **`.env.local` файлыг git-д оруулахгүй** (аль хэдийн .gitignore-д бий)
3. **`setup-db.js` шиг файлд DB нууц үг бичихгүй**
4. **Client-side код дотор admin нууц үг хадгалахгүй**
5. **`sessionStorage`-д auth мэдээлэл хадгалахгүй** → httpOnly cookie ашиглана
6. **RLS policy-г `USING (true)` бүгдэд нээхгүй**
7. **Хэрэглэгчийн оруулсан текстийг шууд HTML-д оруулахгүй** → `sanitize.ts` ашиглана

### Заавал хийх зүйлс ✅
1. **Шинэ feature нэмэхдээ input validation нэмнэ** — `app/lib/sanitize.ts` ашигла
2. **Admin хуудас нэмэхдээ** `/admin/layout.tsx`-ийн `navItems`-д нэмнэ
3. **Mobile хуудас нэмэхдээ** `/sokh/[id]/page.tsx`-ийн `menuItems`-д нэмнэ
4. **Шинэ table нэмэхдээ RLS идэвхжүүлнэ** (харин policy-г зөв бичнэ)
5. **Ажил дууссаны дараа commit + push хийнэ** (PC crash-аас хамгаална)
6. **Нууц үг солихдоо SHA256 hash ашиглана**

---

## Шинэ feature нэмэх заавар

### 1. Mobile хуудас нэмэх
```bash
# 1. Хавтас үүсгэх
mkdir -p "app/(mobile)/sokh/[id]/шинэ-feature"

# 2. page.tsx бичих (maintenance/page.tsx-г жишээ болгоно)

# 3. Цэсэнд нэмэх — app/(mobile)/sokh/[id]/page.tsx
#    menuItems массивт нэмнэ
```

### 2. Admin хуудас нэмэх
```bash
# 1. Хавтас үүсгэх
mkdir -p "app/admin/шинэ-feature"

# 2. page.tsx бичих (admin/maintenance/page.tsx-г жишээ болгоно)

# 3. Sidebar-д нэмэх — app/admin/layout.tsx
#    navItems массивт нэмнэ
```

### 3. Supabase table нэмэх
```sql
CREATE TABLE шинэ_table (
  id BIGSERIAL PRIMARY KEY,
  sokh_id BIGINT REFERENCES sokh_organizations(id),
  -- бусад column-ууд...
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE шинэ_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON шинэ_table FOR ALL USING (true) WITH CHECK (true);
```

---

## Нийтлэг асуудлууд & шийдэл

| Асуудал | Шийдэл |
|---------|--------|
| Port 3000 завгүй | `npx next dev --port 3001` |
| Supabase холболт амжилтгүй | `.env.local` дахь URL, KEY шалгах |
| DB-тэй шууд холбогдохгүй | IPv6 асуудал — SQL Editor ашиглана |
| Build алдаа | `npx next build` → алдааг харж засна |
| Монгол текст clip-д орохгүй | `Set-Clipboard` PowerShell ашиглана |
| PC crash | Ажил дууссаны дараа заавал `git push` |

---

## Git workflow

```bash
# Ажил хийсний дараа
git add .
git commit -m "feat: тайлбар"
git push

# Commit message format:
# feat:     шинэ feature
# fix:      алдаа засвар
# security: аюулгүй байдал
# style:    UI засвар
# refactor: код бүтэц өөрчлөлт
```

---

## Production deploy хийхэд анхаарах

1. `.env.local` дотор нууц үг, SESSION_SECRET заавал солих
2. Supabase DB password солих
3. RLS policy-уудыг зөв болгох (USING (true) → зөвхөн auth хэрэглэгч)
4. HTTPS идэвхжүүлэх (Vercel автоматаар хийнэ)
5. Domain тохируулах
