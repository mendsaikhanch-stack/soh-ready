# Хотол — App Store / Google Play бэлэн байдлын төлөв

Энэхүү баримт нь Хотол апп-ыг **Google Play** болон **Apple App Store**-д
ирээдүйд илгээхэд шаардагдах бүх зүйлсийг checklist-ээр харуулсан болно.

> Сүүлд шинэчилсэн: 2026-05-14
> Хариуцагч: Хотол / Төгс Орчин ХХК
> Холбогдох контакт: `info@hotol.mn` · `7700-1122`

---

## 1. Үндсэн стратеги — эхний илгээлтийн зам

1. **Web / PWA-ыг эхэлж нийтлүүлнэ** (хийгдсэн). Public landing, /find-hoa,
   /help, /contact, /account/delete, /privacy, /terms/* — бүгд хүртээмжтэй.
2. **Бодит СӨХ-уудаар туршина**. 2–5 СӨХ дээр signup → demand → onboarding
   урсгалыг бүрэн ажиллуулна. Сэтгэгдэл, алдааг тэмдэглэнэ.
3. **Android (Google Play)-д илгээнэ.** PWA-аас TWA (Trusted Web Activity)
   эсвэл Capacitor wrap-аар Android build үүсгэнэ.
4. **iOS (App Store)-д илгээнэ.** UI polish, native feel, push notification
   permission flow, iPad layout-ыг шалгасны дараа.

> **Шалтгаан:** Apple-ын review нь Android-аас илүү хатуу. PWA дээр real
> traffic, feedback цуглуулж, дараа нь polish хийсэн native build илгээх нь
> алдааны эрсдэлийг бууруулна.

---

## 2. Google Play — checklist

### 2.1. Developer бүртгэл, төлбөр

- [ ] **Google Play Developer account** ($25 нэг удаагийн төлбөр)
- [ ] Bank account, tax info, Merchant account (хэрэв төлбөртэй контент байх бол)
- [ ] D-U-N-S дугаар (организаци-ийн бүртгэл хийх бол)

### 2.2. Store listing талбарууд

- [ ] **App name:** `Хотол`
- [ ] **Short description (≤80 тэмдэгт):**
  `СӨХ, оршин суугчийн мэдээлэл, төлбөр, хүсэлт, мэдэгдлийг нэг дор.`
- [ ] **Full description (≤4000 тэмдэгт):** §6-аас үзнэ үү.
- [ ] **App category:** `Lifestyle` эсвэл `House & Home`
- [ ] **Content rating:** Everyone (IARC анкет бөглөх)
- [ ] **Tags / keywords:** СӨХ, орон сууц, оршин суугч, төлбөр, мэдэгдэл, хүсэлт, хотхон, Khotol
- [ ] **Target audience:** 18+ (СӨХ-ийн санхүүгийн мэдээлэл орох тул)
- [ ] **App icon (512×512 PNG):** `public/icons/icon-512.png`-аас бэлдэнэ
- [ ] **Feature graphic (1024×500):** TODO — design шаардлагатай
- [ ] **Phone screenshots (320–3840 px, 16:9 эсвэл 9:16):** TODO — 4–8 ширхэг
- [ ] **Tablet screenshots:** хүсэлтэй бол
- [ ] **Preview video (optional, YouTube):** дараа нэмж болно

### 2.3. Хууль ёсны URL-ууд (Production domain дээр)

| Шаардлагатай URL | Маршрут | Төлөв |
|---|---|---|
| Privacy policy | `/privacy` | ✅ бий |
| Terms of service | `/terms/resident`, `/terms/admin` | ✅ бий |
| Support / contact | `/contact` | ✅ бий |
| Account deletion | `/account/delete` | ✅ бий |
| Help / FAQ | `/help` | ✅ бий |

> Production domain тогтоосны дараа дээрх URL-уудыг бүрэн (https://) хэлбэрээр Play Console-д оруулна.

### 2.4. Data Safety form (Google Play-ийн заавал)

Google Play 2022 оноос хойш Data Safety form-ыг шаарддаг. Хотол-д
бөглөх ёстой мэдээлэл:

**Цуглуулдаг өгөгдлийн ангилал:**

- **Personal info:** нэр, утасны дугаар, и-мэйл хаяг
- **Financial info:** төлбөрийн үлдэгдэл, гүйлгээний бичилт (зөвхөн СӨХ-ийн доторх)
- **App activity:** in-app үйлдэл, хүсэлт, гомдол
- **App info and performance:** crash log, diagnostics (Sentry)
- **Device or other IDs:** push notification token, session ID

**Зорилго:**

- Үндсэн үйлчилгээ үзүүлэх
- Аюулгүй байдал, луйврын эсрэг
- Аналитик (нэгтгэсэн)

**Хуваалцлага:**

- Гуравдагч этгээдтэй худалдахгүй
- Зөвхөн hosting (Vercel), database (Supabase), error monitoring (Sentry),
  push (Web Push), QPay-тэй (тохиргооны үед) хуваалцана.

**Аюулгүй байдал:**

- Encryption in transit (HTTPS) ✅
- Хэрэглэгч өөрөө мэдээлэл устгуулах боломжтой ✅ (`/account/delete`)
- Хэрэглэгч мэдээллээ татах хүсэлт гаргах боломжтой ✅

### 2.5. Permissions / зөвшөөрөл

- **INTERNET** — заавал
- **POST_NOTIFICATIONS (Android 13+)** — push мэдэгдэл өгөхөд
  - Justification: "СӨХ-ийн зар, мэдэгдэл, төлбөрийн сануулга хүргэх"
- **CAMERA** — QR кодоор нэвтрэхэд (`/qr-login`)
  - Justification: "Оршин суугч/админ QR кодоор хурдан нэвтрэх"
- **(NOTE)** `manifest.json` дээр `"permissions": ["notifications", "push"]`
  байгаа — TWA build хийхэд Android permission-уудыг bundle-д тусгана.

### 2.6. Push notification зөвшөөрөл

- Анх асуухдаа **яагаад** хэрэгтэйг тайлбарлана.
- Тохиргооноос унтраах боломжтой.
- Marketing push-ийг тусад нь opt-in болгоно.

### 2.7. Payment / QPay тайлбар

- Одоогоор **QPay sandbox**-д үлдсэн, production credential байхгүй.
- Илгээх үед: QPay live идэвхтэй бол Data Safety form дээр "financial
  info" хэсэгт нэмж тэмдэглэнэ. Google Play **Billing API** хэрэглэхгүй
  (СӨХ-ийн нэхэмжлэл нь digital content биш, бодит ажил/үйлчилгээний
  төлбөр тул Play Billing-ийн дүрэмд хамаарахгүй) — энэ үндэслэлийг review
  notes-д тайлбарлана.

### 2.8. Test account (Play review-д заавал шаардлагатай)

- [ ] Demo phone + password үүсгэх (review-only)
- [ ] Demo СӨХ-д тэр account-ыг holiday-mode нэвтрүүлэх
- [ ] App review notes-д:
  - "Test phone: 9900XXXX / Password: XXXX"
  - "Demo URL: https://hotol.mn/demo (login шаардахгүй)"

### 2.9. Гарын авлага / quality

- [ ] Бүх public route load болж байна (404 байхгүй)
- [ ] Эх кодонд `TODO`, `placeholder`, `[________]` текст үлдээгүй
  - **NOTE:** `/help`, `/privacy` дотор хэсэгчилсэн placeholder бий —
    production илгээхээс өмнө бөглөнө.
- [ ] Mongolian эх бичвэр бүгд kotinkilig (мангал тэмдэгт байхгүй)
- [ ] Crash-free session > 99% (Sentry-аас хянана)

---

## 3. Apple App Store — checklist

### 3.1. Developer бүртгэл

- [ ] **Apple Developer Program** ($99/жил)
- [ ] D-U-N-S дугаар (организаци)
- [ ] App Store Connect access

### 3.2. Store listing талбарууд

- [ ] **App name:** `Хотол`
- [ ] **Subtitle (≤30 тэмдэгт):** `СӨХ, оршин суугч нэг дор`
- [ ] **Promotional text (≤170 тэмдэгт)**
- [ ] **Description (≤4000 тэмдэгт):** §6
- [ ] **Keywords (≤100 тэмдэгт):** `СӨХ,орон сууц,оршин суугч,төлбөр,мэдэгдэл,Khotol`
- [ ] **App icon (1024×1024 PNG, no alpha)**
- [ ] **Screenshots:**
  - iPhone 6.7" (1290×2796) — заавал
  - iPhone 6.5" (1284×2778) — заавал
  - iPad Pro 12.9" (2048×2732) — iPad дэмжих бол заавал
- [ ] **App preview video (15–30 сек, optional)**
- [ ] **Primary category:** `Lifestyle`
- [ ] **Secondary category:** `Utilities`

### 3.3. Хууль ёсны URL-ууд

| Шаардлагатай URL | Маршрут | Төлөв |
|---|---|---|
| Privacy policy URL | `/privacy` | ✅ |
| Support URL | `/contact` | ✅ |
| Marketing URL (optional) | `/` | ✅ |
| EULA (optional) | `/terms/resident` | ✅ |

### 3.4. In-app account deletion (Apple Guideline 5.1.1(v) — заавал)

Apple 2022-оос хойш **апп дотроос** account устгах сонголтыг шаарддаг.

- [ ] App доторх `Тохиргоо` → `Бүртгэл` → `Бүртгэл устгуулах` товчлуур
  үүсгэх (одоо `/account/delete` web route бий — TWA / Capacitor build
  дотор тэрхүү route-руу шууд линк хийнэ).
- [ ] Эсвэл native screen дотроос email/тел сувгаар хүсэлт илгээх UI.

### 3.5. Test account (Apple review-д заавал)

- [ ] Demo phone + password үүсгэж App Store Connect → "App Review
  Information" хэсэгт оруулах.
- [ ] Demo videos / screenshots ачаалах.

### 3.6. App Tracking Transparency (ATT)

- Хотол гуравдагч талын ad SDK ашиглахгүй тул **ATT prompt шаардлагагүй**.
- Privacy nutrition label-д "Data Not Linked to You" / "Data Used to
  Track You — None" гэж бөглөнө.

### 3.7. Push notification

- iOS: `UNUserNotificationCenter.requestAuthorization` дуудахын өмнө
  "яагаад" гэдгийг тайлбарласан pre-prompt screen үзүүлнэ.
- Анх ачаалахдаа push зөвшөөрөл шууд асуухгүй.

### 3.8. Quality / no-crash

- [ ] iPhone (portrait), iPad (portrait + landscape) дээр гүйцэд ажиллана
- [ ] Хоосон төлөв (empty state) бүх screen дээр сайн харагдана
- [ ] Offline / онлайн биш үед ойлгомжтой error харуулдаг
- [ ] App "demo" эсвэл "alpha" гэсэн төлвөөр илгээхгүй

---

## 4. Серверийн зүгээс шалгах зүйлс

- [ ] **Production domain** тогтоох (одоогийн `soh-ready.vercel.app` биш,
  жишээ нь `hotol.mn`)
- [ ] **HTTPS + valid certificate** (Vercel автоматаар хангадаг)
- [ ] **NEXT_PUBLIC_SITE_URL** env-ийг production domain руу шинэчлэх
- [ ] **CSP / security headers** хэвийн (`middleware.ts` дотор)
- [ ] **Robots.txt** — public route allow, admin route disallow (✅ хийгдсэн, commit `6105d27`)
- [ ] **OG image** — FB share preview ажиллах (✅ commit `8531a90`)
- [ ] **Sentry** идэвхтэй
- [ ] **RLS** идэвхтэй — `tenant-scoped` (✅ commit `fe9f72d`)

---

## 5. PWA метадата — одоогийн төлөв

| Зүйл | Файл | Төлөв |
|---|---|---|
| Manifest | `/public/manifest.json` | ✅ |
| App name | `Хотол — СӨХ удирдлагын систем` | ✅ |
| Short name | `Хотол` | ✅ |
| Theme color | `#2563eb` (blue-600) | ✅ |
| Background | `#ffffff` | ✅ |
| Icon 192 | `/public/icons/icon-192.png` | ✅ |
| Icon 512 | `/public/icons/icon-512.png` | ✅ |
| Service worker | `/public/sw.js` | ✅ |
| Apple touch icon | `appleWebApp` метадата `app/layout.tsx` | ✅ |
| Lang | `mn` | ✅ |

**TODO before store submission:**

- [ ] **Maskable icons** — Android adaptive icon-ы хувьд "safe area" дотроо
  логогоо багтаасан maskable PNG бэлдэх (192 + 512). Одоогийн icon-ууд
  `"purpose": "any maskable"` гэж тэмдэглэгдсэн ч safe area-аар бүрэн
  тест хийгдээгүй.
- [ ] **iOS splash screens** (`apple-touch-startup-image`) — Apple-ын
  device бүрд (iPhone SE → 15 Pro Max, iPad) тус бүр.
- [ ] **Apple touch icon 180×180** үүсгэх (одоо favicon.ico-г ашиглаж байна).
- [ ] **Feature graphic (Google Play 1024×500)** — design шаардлагатай.
- [ ] **Screenshots (iPhone 6.7", iPad 12.9", Android phone, Android tablet)** —
  бодит дэлгэцээс авна.

---

## 6. Store copy — анхны төсөл

### App name

```
Хотол
```

### Short description (Google Play, ≤80 тэмдэгт)

```
СӨХ, оршин суугчийн мэдээлэл, төлбөр, хүсэлт, мэдэгдлийг нэг дор.
```

### Subtitle (Apple, ≤30 тэмдэгт)

```
СӨХ, оршин суугч нэг дор
```

### Full description (Mongolian)

```
Хотол — СӨХ-ийн өдөр тутмын ажлыг хялбарчилдаг апп

Хотол нь оршин суугч, СӨХ, удирдлагын мэдээллийг нэг дор цуглуулж,
төлбөр, мэдэгдэл, хүсэлтийг ил тод, цэгцтэй удирдах боломжийг олгоно.

ОРШИН СУУГЧДАД
• Хот, дүүрэг, хороогоор өөрийн СӨХ-өө хайж олно
• Хэрэв СӨХ тань жагсаалтад байхгүй бол өөрөө мэдээллээ оруулж
  бүртгүүлэн, тухайн СӨХ дээр Хотол ашиглах сонирхлын дохио үүсгэнэ
• Төлбөр, үлдэгдлээ нэг дороос харна
• Зар, мэдэгдлийг шуурхай хүлээн авна
• Хүсэлт, гомдол бичгээр илгээж, төлөвийг нь дагана

СӨХ / АДМИНД
• Оршин суугчдын бүрэн бүртгэл (Excel/CSV импорттой)
• Зар, мэдэгдлийг нэг л удаа нийтлээд бүгдэд хүргэх
• Хүсэлт, гомдлыг ангилж, хариуцагчид хуваарилах
• Санхүү, үйл ажиллагааны ил тод байдлыг сайжруулах
• Хотол ашиглахыг хүссэн оршин суугчдын тоог харах demand dashboard

АЮУЛГҮЙ БАЙДАЛ
• Таны мэдээллийг зөвхөн өөрийн СӨХ-ийн эрх бүхий хэрэглэгчид харах
  боломжтой
• Бүртгэлээ хэзээ ч устгуулах хүсэлт гаргаж болно

Дэлгэрэнгүй мэдээлэл, тусламж, нөхцөл:
• Тусламж: hotol.mn/help
• Холбоо барих: hotol.mn/contact
• Нууцлалын бодлого: hotol.mn/privacy
• Бүртгэл устгуулах: hotol.mn/account/delete
```

### Keywords

```
СӨХ, орон сууц, оршин суугч, төлбөр, мэдэгдэл, хүсэлт, хотхон, Khotol
```

### Support URL

```
https://hotol.mn/help
```

(альтернатив: `https://hotol.mn/contact`)

### Privacy policy URL

```
https://hotol.mn/privacy
```

### Account deletion URL

```
https://hotol.mn/account/delete
```

### Marketing URL

```
https://hotol.mn/
```

---

## 7. Илгээхээс өмнө хийгдэх ёстой үлдсэн ажил

### Эхэлж хийх (web/PWA launch)

- [x] Public landing `/` — 2026-05-14 шинэчилсэн
- [x] `/contact` — 2026-05-14
- [x] `/account/delete` — 2026-05-14
- [x] Footer/нэвтрэх/бүртгүүлэх хуудаснаас линк хийгдсэн
- [ ] **Production domain худалдаж авах + DNS Vercel-д заах**
- [ ] `NEXT_PUBLIC_SITE_URL` шинэчлэх
- [ ] `info@hotol.mn` mailbox үүсгэх (G Suite / forwarding)
- [ ] Facebook business page бэлэн болгох, /contact дотор линкээ шинэчлэх

### Дараагийн шат (Android)

- [ ] TWA эсвэл Capacitor build pipeline тохируулах
- [ ] App icon-ыг maskable хэлбэрээр дахин ашиглаж adaptive icon үүсгэх
- [ ] Phone screenshots 6 ширхэг бэлдэх
- [ ] Feature graphic 1024×500 design
- [ ] Demo / test account үүсгэх
- [ ] Data Safety form бөглөх
- [ ] Internal testing track-аас эхлүүлэх

### Дараагийн шат (iOS)

- [ ] UI native polish (back gesture, safe area, haptic, sheet-нүүд)
- [ ] In-app account deletion native screen
- [ ] iPad layout-ыг шалгах
- [ ] App preview video
- [ ] App Store screenshots (iPhone 6.7", iPad 12.9")
- [ ] Privacy nutrition label
- [ ] TestFlight тест

---

## 8. Хувийн санамж

- **QPay live идэвхжсэн өдөр** энэхүү checklist-д буцаж "payments" хэсгийг
  нэмж шинэчлэх.
- **Push notification** Android 13+ дээр `POST_NOTIFICATIONS` permission
  заавал runtime-д асуудаг — pre-prompt screen бэлдэх.
- **Brand:** "Хотол" (Mongolian) албан ёсны нэр; "Khotol" зөвхөн Latin
  орчинд (URL, package name, English copy) ашиглана.
