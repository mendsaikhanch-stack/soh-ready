# Хотол — Android (Capacitor) build & Google Play гарын авлага

Энэ баримт нь `khotol.com` веб аппыг **Capacitor remote-URL wrapper** болгон
Android app болгож, Google Play Store-д `.aab` хэлбэрээр гаргах бүх алхмыг
агуулна.

---

## 0. Архитектурын шийдвэр (яагаад ингэсэн бэ)

| Асуулт | Хариулт |
|---|---|
| Framework | Next.js 16 (App Router, **SSR**, `output: standalone`) |
| Static export хийх үү? | **Үгүй.** SSR + Supabase + Sentry учир `output: export` боломжгүй. |
| Сонгосон арга | **Remote-URL wrapper** — app нь `https://www.khotol.com`-ыг WebView дотор ачаална. |
| Bundled assets | Зөвхөн **offline fallback** (`mobile/www/offline.html`). |
| Давуу тал | Вебээ deploy хийхэд app шууд шинэчлэгдэнэ; дахин build хэрэггүй. |
| Сул тал | Интернэт шаардана (offline fallback-аар зохицуулсан). Play бодлогын эрсдэл — доороос үз. |

App-ийн үндсэн параметр:

| Параметр | Утга |
|---|---|
| App name | Хотол |
| Application ID / namespace | `mn.khotol.app` |
| versionCode | `1` |
| versionName | `1.0.0` |
| minSdkVersion | `24` (Android 7.0) |
| targetSdkVersion / compileSdk | `36` (Play-ийн 35+ шаардлагыг хангана) |
| Permissions | Зөвхөн `INTERNET` |
| Main URL | `https://www.khotol.com` |
| Offline fallback | `mobile/www/offline.html` (server.errorPath) |

---

## 1. Урьдчилсан шаардлага (нэг удаа суулгана)

Энэ репог боосон машин дээр **одоогоор Android build хэрэгсэл алга**. Доорхыг суулгана:

1. **Android Studio** (хамгийн сүүлийн хувилбар) — https://developer.android.com/studio
   - Энэ нь дотроо **JDK 21**, **Android SDK 36**, **Gradle**-ийг авчирна.
   - Эхний нээлтэд SDK Manager-аас **Android SDK Platform 36** болон
     **Android SDK Build-Tools** суулгана.
2. (Build-ийг командаас хийх бол) `JAVA_HOME`-ийг Android Studio-ийн JDK руу зааж,
   `ANDROID_HOME`-ийг SDK зам руу тохируулна.

> Node.js + энэ репогийн `npm install` аль хэдийн хийгдсэн (Capacitor суусан).

---

## 2. Veb өөрчлөгдөхөд Android-ыг шинэчлэх

`capacitor.config.ts` доторх `server.url` нь production вебийг ачаалдаг тул
**веб контент өөрчлөгдөхөд Android-ыг дахин build хийх шаардлагагүй**.

Зөвхөн дараах зүйл өөрчлөгдвөл `npx cap sync android` ажиллуулна:
- `capacitor.config.ts`
- `mobile/www/*` (offline хуудас)
- Icon / splash (`assets/*` → дараа нь `npx @capacitor/assets generate --android`)

---

## 3. Android Studio-д нээх

```bash
npx cap open android
```

(эсвэл Android Studio дотроос `android/` фолдерыг нээнэ)

Gradle sync автоматаар эхэлнэ. Анх удаа SDK татаж магадгүй — дуустал хүлээнэ.

---

## 4. Debug build (туршихад)

Утсаа USB-ээр холбож (USB debugging асаасан) эсвэл эмуляторт:

- Android Studio: **Run ▸ Run 'app'** (▶ ногоон товч)

эсвэл командаар:

```bash
cd android
./gradlew assembleDebug      # Windows дээр: gradlew.bat assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

App нээгдэхэд цагаан splash (Хотол лого) → `https://www.khotol.com` ачаална.

---

## 5. Release signing (заавал, нэг удаа)

Play Store-д upload хийх `.aab` нь **гарын үсэгтэй** байх ёстой.

### 5.1 Keystore үүсгэх

```bash
keytool -genkey -v -keystore khotol-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias khotol
```

- `keytool` нь JDK-д ирдэг (Android Studio суулгасан бол байгаа).
- Тавьсан **нууц үг, alias-ийг сайн хадгал** — алдвал ирээдүйд шинэчлэлт upload
  хийх боломжгүй болно.
- Үүссэн `khotol-release.jks`-ийг `android/` фолдерт байрлуул (эсвэл өөр найдвартай газар).

### 5.2 key.properties бөглөх

`android/key.properties.template`-ийг хуулж `android/key.properties` нэрээр хадгална:

```properties
storeFile=../khotol-release.jks
storePassword=<keystore нууц үг>
keyAlias=khotol
keyPassword=<key нууц үг>
```

> `key.properties`, `*.jks`, `*.keystore` нь `.gitignore`-д орсон — **Git-д ОРОХГҮЙ**.
> `build.gradle` нь `key.properties` байвал автоматаар release-д signing хэрэглэнэ.
> Байхгүй бол release нь debug key-ээр гарах тул Play-д upload хийх боломжгүй.

---

## 6. Release `.aab` гаргах

### Android Studio-оор (зөвлөмж)

1. **Build ▸ Generate Signed Bundle / APK…**
2. **Android App Bundle** сонгоно ▸ Next
3. Keystore зам, нууц үг, alias оруулна ▸ Next
4. Build variant: **release** ▸ Finish
5. Output:
   `android/app/build/outputs/bundle/release/app-release.aab`

### Командаар (key.properties бөглөсөн бол)

```bash
cd android
./gradlew bundleRelease       # Windows: gradlew.bat bundleRelease
```

Output:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## 7. Google Play Console-д байршуулах

1. **Google Play Console developer account** нээх (нэг удаагийн $25).
   - Байгууллагын нэрээр нээх боломжтой бол тийнхүү нээ (organization account).
2. **Create app**:
   - App name: **Хотол**
   - Default language: **Монгол (mn-MN)** (эсвэл English — доороос үз)
   - App or game: **App**
   - Free or paid: **Free**
3. **Store listing** бөглөх → `STORE_LISTING_TEXT.md`-ийн текстийг ашигла.
4. **App icon (512×512)** upload: `assets/playstore-icon-512.png`
   **Feature graphic (1024×500)** — гараар бэлдэнэ (доорх "Гараар бэлдэх" хэсэг).
5. **Screenshots** upload (доорх жагсаалт).
6. **Privacy Policy URL** оруулах: `https://www.khotol.com/privacy`
7. **App access** → review-ийн нэвтрэх мэдээлэл оруулах:
   - Нэвтрэлт: **Утас `88000000`** · **Нууц үг `Demo12345!`**
     (апп нь утсаар нэвтэрдэг; Supabase auth дээр `88000000@toot.app`)
   - Тэмдэглэл: "Demo СӨХ / Туршилтын байр. Утас 88000000, нууц үг Demo12345!. Бодит хувийн мэдээлэл агуулаагүй."
8. **Data safety** form бөглөх → `PLAY_STORE_DATA_SAFETY.md`-ийн дагуу.
9. **Content rating** асуулга бөглөх.
10. **Target audience** — 18+ эсвэл бизнесийн зорилготой гэдгийг сонго.
11. **Internal testing** release үүсгэх ▸ `.aab` upload.
12. **Tester email list** нэмэх ▸ өөрийн болон pilot хэрэглэгчдийн имэйл.
13. Internal test суулгаж туршаад алдаа засна.
14. **Personal developer account** бол: **Closed testing** дээр **12 tester × 14 хоног**
    opt-in шаардлагыг хангах ёстой (Google-ийн шинэ дүрэм). Organization account
    бол энэ шаардлага байхгүй.
15. **Production access** хүсэх.
16. **Production release** хийх.

---

## 8. Гараар бэлдэх материал (заавал)

| Материал | Тайлбар |
|---|---|
| Play developer account | $25 төлбөр, бүртгэл |
| Feature graphic 1024×500 | Play listing-ийн толгой зураг — Canva/Figma-аар |
| Screenshots (утас) | 2–8 ширхэг, доорх дэлгэцүүдээр |
| Demo account (утас `88000000`) | Supabase дээр `88000000@toot.app` + demo СӨХ, demo хэрэглэгч — **бодит PII-гүй** |
| Privacy/Terms-ийн **огноо** | `/privacy`, `/terms/*` дээрх `[он/сар/өдөр]` placeholder-ийг бодит огноогоор солих |
| Content rating хариултууд | Play Console-ийн асуулга |

---

## 9. Үүсгэсэн / өөрчилсөн файлууд

**Шинээр үүсгэсэн:**
- `capacitor.config.ts` — Capacitor тохиргоо (remote wrapper)
- `mobile/www/index.html`, `mobile/www/offline.html`, `mobile/www/logo.png`
- `assets/*` — icon/splash эх зургууд
- `android/` — бүтэн Android Gradle project (Capacitor scaffolding)
- `android/key.properties.template` — signing загвар
- `android/app/src/main/res/values/colors.xml` — brand өнгө
- `playstore/*.md` — энэ болон бусад баримтууд

**Өөрчилсөн:**
- `package.json` — Capacitor хамаарал + cap скриптүүд
- `android/app/build.gradle` — versionName 1.0.0, signing config
- `android/app/src/main/res/values/styles.xml` — splash/status bar өнгө
- `android/.gitignore` — keystore/key.properties хамгаалал

---

## 10. Хурдан командын лавлах

```bash
npm run cap:sync       # capacitor.config + web assets + plugins sync
npm run cap:open       # Android Studio-д нээх
npm run cap:assets     # icon/splash дахин үүсгэх (assets/ өөрчилсний дараа)
cd android && ./gradlew bundleRelease   # release .aab
```
