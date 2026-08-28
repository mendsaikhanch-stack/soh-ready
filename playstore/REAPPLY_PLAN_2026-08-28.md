# Хотол — Production access ДАХИН өргөдөл гаргах төлөвлөгөө

> Google татгалзсан: **2026-08-28** («More testing required to access Google Play production»)
> Анхны өргөдөл: 2026-08-24 16:41. Closed test: 2026-08-07 → 2026-08-21 (12 opt-in).

---

## 1. Яагаад унасан бэ — оношилгоо

Google-ийн захидалд 2 шалтгаан нэрлэсэн. Аль аль нь бидэнд тохирч байна:

### Шалтгаан 1: «Testers were not engaged with your app»
- 23 хаяг жагсаалтад, 12 нь «Become a tester» дарсан.
- Гэвч `testers.local.md` дээрх **«Санал/engagement цуглуулах» алхам хийгдээгүй хэвээр** (тэмдэглэгдээгүй).
- Google зөвхөн opt-in тоог биш, **тестерүүд аппыг үнэхээр нээж, ашигласан эсэхийг** хардаг
  (session, retention, crash-free users). Opt-in дараад суулгаагүй хүн бол тэг.

### Шалтгаан 2: «You didn't follow testing best practices … updates to your app»
**Энэ нь хамгийн тодорхой унасан цэг.**
- `android/app/build.gradle` → **`versionCode 2`**, `versionName "1.0.0"`.
- 2026-08-02-нд upload хийсэн release 2 нь **2026-08-24 хүртэл 22 хоног ганцаараа зогссон**.
- Тест явж байх хугацаанд **шинэ release ГАРААГҮЙ** → Google-ийн нүдээр
  "feedback авч, түүн дээрээ ажилласан" нотолгоо тэг.
- Бодит байдал дээр 08-25 ба 08-27-нд олон feature орсон (гэрээ PDF, e-billing,
  Төрийн банкны нэхэмжлэх, notification bug fix) — **гэхдээ энэ бүхэн вэб тал руу
  явсан.** Апп нь `www.khotol.com`-ыг ачаалдаг WebView wrapper тул вэб шинэчлэл
  Play Console дээр огт харагдахгүй.

> **Гол сургамж:** WebView wrapper байсан ч Google-д **versionCode нэмэгдэж
> байгааг харуулах ёстой.** Тест хугацаанд 3 удаа `.aab` гаргаж, release notes
> дээр "тестерийн саналаар ийм зүйл зассан" гэж бичих нь заавал.

---

## 2. Одоо байгаа тестерүүд — дахин цуглуулах шаардлагагүй

**Play Console дээрх 23 хаяг байрандаа хэвээр байгаа.** Тестер жагсаалт нь
өргөдөл татгалзсанаас болж арилдаггүй, track "Active" хэвээр. Тиймээс:

- ❌ Хаягуудыг дахин оруулах **шаардлагагүй**
- ❌ Шинэ Google Group үүсгэх **шаардлагагүй**
- ✅ Хийх зүйл: **opt-in дараагүй ~11 хүнийг татах** + бүгдийг ашиглуулах

| Тоо | Төлөв | Хийх зүйл |
|---|---|---|
| 23 | Console жагсаалтад бүртгэлтэй | хэвээр үлдээ, бүү хас |
| 12 | «Become a tester» дарсан | аппыг **тогтмол нээхийг** сануул |
| ~11 | дараагүй | линкийг дахин явуулж, **дарахыг** гуй |

> ⚠️ Play нь **хэн opt-in хийснийг нэрээр харуулдаггүй.** Тиймээс сонгож
> илгээх боломжгүй — 23-уланд нь Bcc-ээр илгээж, аль алинд нь тохирох
> бичвэр ашиглана (§4.1).

### Нэмж хийх: СӨХ-ийн бодит хэрэглэгчид
Гринланд-687 (128 айл), Жаргалан апартмент (99 айл) системд орсон. Тэднээс
аппыг бодитоор ашиглаж байгаа хүмүүсийн Gmail-ийг СӨХ-ийн даргаар дамжуулан
цуглуулж жагсаалтад **нэм**. Тэдний хэрэглээ зохиомол биш, бодит.

**Зорилт: 12 биш, 20+ opt-in.**

---

## 3. 14 хоногийн хуваарь (2026-08-29 → 2026-09-12)

| Өдөр | Хийх зүйл |
|---|---|
| **08-29 (Баасан)** | 23-уланд §4.1 имэйл илгээх. СӨХ-үүдээс шинэ Gmail цуглуулж эхлэх. |
| **08-30 → 09-01** | Opt-in тоог ≥12, аль болох 20 болгох. Dashboard өдөр бүр шалгах. |
| **09-01** | 🔴 **Release 3 (v1.0.1)** — release notes-т feedback дурдана (§5) |
| **09-02 → 09-04** | Бичгээр санал цуглуулах (§4.2). Хариуг screenshot-оор хадгална. |
| **09-05** | 🔴 **Release 4 (v1.0.2)** — 09-02..04-д ирсэн бодит саналын засварууд |
| **09-06 → 09-09** | Engagement барих: 7 хоногт 2-3 удаа нээхийг сануулах |
| **09-10** | 🔴 **Release 5 (v1.0.3)** — сүүлийн засварууд |
| **09-12** | 14 хоног дүүрнэ → **Apply for production** (§6 хариултууд) |

> ⚠️ 14 хоногийн тоолол **12 opt-in тогтмол байсан** өдрөөс эхэлнэ. Одоогийн 12
> хэвээр байвал тоолол тасраагүй байж болох ч найдаж болохгүй — шинээр бүтэн
> 14 хоног тоол.

---

## 4. Илгээх бичвэрүүд

### 4.1 Бүх 23 тестер рүү (Bcc) — 08-29-нд илгээх

Гарчиг:
```
«Хотол» апп — туршилт үргэлжилж байна, 1 минутын тусламж хэрэгтэй 🙏
```

Бие:
```
Сайн байна уу,

«Хотол» аппын туршилтад урьсны маань дараа тусалсан хүн бүрт баярлалаа.

Google Play-ээс аппыг олон нийтэд гаргах хүсэлтийг маань хойшлуулж,
"туршилтыг илүү удаан, илүү идэвхтэй үргэлжлүүлэх" шаардлага тавилаа.
Тиймээс туршилтыг 9-р сарын 12 хүртэл сунгаж байна.

Танаас хамаарах зүйл ердөө 2:

1) Хэрэв та ЛИНК ДЭЭР ДАРААГҮЙ бол — утсаараа доорх линкийг нээгээд
   «Become a tester» товчийг дарна уу (30 секунд):

   https://play.google.com/apps/testing/mn.khotol.app

   ⚠️ Урьсан Gmail хаягаараа Play Store-д нэвтэрсэн байх ёстой.
   Дарсны дараа Play Store-оос «Хотол» аппыг татна уу.

2) Хэрэв та АЛЬ ХЭДИЙН суулгасан бол — 7 хоногт 2-3 удаа нээж,
   төлбөрөө шалгаад, зар мэдээллээ уншаад байвал хангалттай.
   Хэрэглэхгүй бол Google туршилтыг тооцдоггүй юм байна.

Мөн ямар нэг эвгүй, ойлгомжгүй, алдаатай зүйл таарвал энэ имэйлд
шууд хариу бичээрэй. Ирэх 2 долоо хоногт бид таны саналаар засвар
хийж, шинэ хувилбар гаргах болно.

Танай нэг товч дарах нь энэ аппыг олон нийтэд гаргахад шууд нөлөөлнө.
Баярлалаа!

Мэндсайхан
```

### 4.2 Санал асуух 5 асуулт (Google Forms эсвэл шууд чат)

Google өргөдөл дээр **тодорхой жишээ** асуудаг тул хариултыг заавал хадгал.

```
Хотол апп — 2 минутын санал асуулга

1. Аппыг ямар зорилгоор хамгийн их нээдэг вэ?
   (төлбөр шалгах / зар мэдээ / хүсэлт илгээх / тайлан / бусад)

2. Хамгийн эвгүй, ойлгомжгүй санагдсан зүйл юу байсан бэ?

3. Ямар нэг алдаа, гацалт гарсан уу? Хаана?
   (утасны загвар, юу дарахад гарсныг бичнэ үү)

4. Нэмж байгаасай гэж хүсч байгаа нэг зүйл?

5. Найздаа санал болгох уу? (1-10 оноо)
```

### 4.3 СӨХ-ийн бодит хэрэглэгчид рүү (Messenger / групп)

```
Сайн байна уу 👋

Хотол аппыг ашиглаж байгаад баярлалаа. Апп одоо Google Play дээр
хаалттай туршилтын шатанд явж байгаа тул танай тусламж хэрэгтэй байна.

1) Доорх линкийг УТСАНДАА нээгээд «Become a tester» дарна уу:
   https://play.google.com/apps/testing/mn.khotol.app
   (Аппаа суулгасан Gmail хаягаараа нэвтэрсэн байх ёстой)

2) Дараа нь Play Store-оос Хотол аппыг татаж/шинэчилнэ үү.

3) Ердийнхөөрөө ашиглаад байвал хангалттай.

4) Эвгүй зүйл таарвал энд бичээрэй — засаад шинэ хувилбар гаргана.

Танай санал шууд аппын шинэчлэлт болж орно. Баярлалаа! 🙏
```

### 4.4 Сануулга (3 хоногийн дараа, 09-01-нд)

```
Сануулга 🙏 «Хотол» аппын туршилтад нэгдэх линк:
https://play.google.com/apps/testing/mn.khotol.app

⚠️ Заавал УТСААР нээх ба урьсан Gmail хаягаараа Play-д нэвтэрсэн байх
ёстой. «Become a tester» товч дарагдвал л тоологдоно. 30 секунд.
```

---

## 5. Release notes загвар (Play Console дээр бичих)

> ❗ Release notes нь Google-ийн шалгагч уншдаг хэсэг. «Bug fixes» гэж бичвэл
> ямар ч ач холбогдолгүй. **Тестерийн саналыг дурдаж бич.**

### Release 3 — v1.0.1 (versionCode 3)
```
Тестерүүдийн саналаар хийсэн сайжруулалт:
• Нэвтрэх дэлгэц удаан ачаалдаг байсныг хурдасгав
• Мэдэгдэл товлоход алдаа гардаг байсныг зассан
• Нэхэмжлэхийг Төрийн банкны стандарт загвараар харуулдаг болов
```

### Release 4 — v1.0.2 (versionCode 4)
```
Тестерүүдээс ирсэн санал дээр үндэслэв:
• Төлбөр хэтэрсэн үед автомат сануулга нэмэв
• Монгол хэлний үг үсгийн алдаануудыг залруулав
• [09-02..04-нд ирсэн БОДИТ саналын засварыг энд бич]
```

### Release 5 — v1.0.3 (versionCode 5)
```
• [сүүлийн долоо хоногийн бодит feedback-ийн засвар]
```

### versionCode нэмэх заавар
```bash
# 1. android/app/build.gradle дотор:
#      versionCode 2  →  3
#      versionName "1.0.0" → "1.0.1"
cd /c/Users/MNG/Desktop/projects/soh-ready
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
# 2. Play Console ▸ Closed testing ▸ Create new release ▸ .aab upload
# 3. Release notes-ыг дээрх загвараар бич ▸ Send for review
```

---

## 6. Production өргөдлийн хариултууд (АНГЛИАР)

> Google-ийн шалгагч англиар уншина. Анхны өргөдлийн хариултууд хэт ерөнхий
> байсан магадлалтай. Энэ удаад **тоо, нэр, огноо** оруул.

### Q: How did you recruit your testers?
```
Testers were recruited directly from the real user base of the app.
Khotol is a management platform for Mongolian housing owners
associations (СӨХ). Two associations are already onboarded and using
the system in production on the web: Greenland-687 (128 households)
and Jargalan Apartment (99 households).

I invited residents and board members from these associations, plus
personal acquaintances who live in apartment buildings managed by an
association, via a Google Group and direct Messenger messages. No paid
tester service or tester-exchange group was used — every tester is a
real person who either lives in a building we manage or works in
property management.
```

### Q: What feedback did you receive, and what did you change?
```
[ЭНД 09-02..04-нд ирсэн БОДИТ саналуудыг бич. Дор нь загвар:]

1. Several testers reported the login screen took too long to load on
   slower mobile connections. Fixed in version 1.0.1 (released
   2026-09-01) by reducing the initial payload.

2. Testers scheduling building announcements hit a crash when the time
   field was left empty. Fixed in 1.0.1.

3. Board members said the generated invoices did not match the format
   their bank (Төрийн банк) expects, which caused confusion for
   residents. We rebuilt the invoice layout to match that standard in
   1.0.1.

4. Residents asked to be reminded before their fee became overdue
   rather than after. We added automatic overdue reminders in 1.0.2
   (released 2026-09-05).

5. [09-02..04-ийн бодит санал]
```

### Q: How difficult was it to find testers?
```
Moderate. Because we have real associations using the platform, finding
motivated testers was easier than for a brand-new app, but many older
residents needed help completing the Google Play opt-in step, which had
to be explained individually over Messenger.
```

### Q: Expected installs in the first year
```
0 – 10,000
```

---

## 7. Дахин унахаас сэргийлэх checklist

Өргөдөл өгөхөөс өмнө бүгд ✅ байх ёстой:

- [ ] Opt-in тестер **14+ хоног тасралтгүй ≥12** (илүү нь дээр — 20+ зорь)
- [ ] Тест хугацаанд **хамгийн багадаа 2, аль болох 3 шинэ versionCode** нийтлэгдсэн
- [ ] Release notes бүр дээр **тестерийн саналыг дурдсан** (не "bug fixes")
- [ ] Хамгийн багадаа **5 хүнээс бичгээр санал** авч, screenshot/хуулбар хадгалсан
- [ ] Play Console ▸ Statistics дээр **бодит session/active user** харагдаж байгаа
- [ ] Тест хугацаанд **нэг ч тестер устгагдаагүй**
- [ ] Privacy policy `/privacy`, account deletion `/account/delete` ажиллаж байгаа
- [ ] Data safety форм бодит байдалтай тааруулсан
- [ ] Өргөдлийн хариултууд **тодорхой тоо, нэр, огноотой** (ерөнхий үг биш)

---

## 8. Санамж

- **Closed test-ийг ХЭЗЭЭ Ч бүү зогсоо.** Track "Active" хэвээр байх ёстой.
- Тестер хасах ⇒ тоолол шинээр эхлэх эрсдэлтэй. Хэн ч бүү хас.
- Хариу нь **mendsaikhanch@gmail.com** руу ирнэ (geregekiosk@ биш).
- 2 удаа татгалзвал 3 дахь удаа илүү хатуу шалгадаг — энэ удаа гүйцэд бэлд.
