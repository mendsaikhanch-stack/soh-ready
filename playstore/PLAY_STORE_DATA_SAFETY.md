# Хотол — Play Store Data Safety form (дотоод тайлан)

Google Play Console → **App content ▸ Data safety** хэсгийг бөглөхөд ашиглах
лавлах. Доорх нь Хотол аппын одоогийн (remote-wrapper) хувилбарт хамаарна.

> **Чухал:** Эцсийн хариултыг бодит код/backend-тэйгээ тулгаж баталгаажуул.
> Энэ тайлан нь репогийн судалгаанд (Supabase backend, Sentry, file upload талбарууд)
> үндэслэсэн **төсөл** юм.

## Ерөнхий хариултууд

| Асуулт | Хариулт |
|---|---|
| Аппликейшн өгөгдөл цуглуулдаг/дамжуулдаг уу? | **Тийм** |
| Дамжуулалт шифрлэгдсэн үү (encrypted in transit)? | **Тийм** (HTTPS / TLS) |
| Хэрэглэгч өгөгдлөө устгуулах хүсэлт гаргаж чадах уу? | **Тийм** — `https://www.khotol.com/account/delete` |
| 3rd-party-тай "хуваалцдаг" (share) уу? | **Үгүй** маркетингийн зорилгоор. Зөвхөн дэд бүтцийн
  процессор ашиглана (Supabase backend, Sentry алдаа хяналт). |

---

## Цуглуулдаг өгөгдлийн ангилал

Тэмдэглэгээ: **Цуглуулдаг** = серверт хадгална. **Зорилго** = яагаад.
**Шаардлагатай/Сонгомол**. Бүх төрөл TLS-ээр шифрлэгдэж дамждаг.

| Өгөгдөл | Цуглуулдаг уу | Зорилго | Шаардлагатай эсэх | Устгуулж болох уу |
|---|---|---|---|---|
| **Нэр** (Name) | Тийм | Account удирдлага, СӨХ-ийн бүртгэл | Шаардлагатай | Тийм |
| **Email хаяг** | Тийм | Нэвтрэлт (auth), холбоо барих | Шаардлагатай | Тийм |
| **Утасны дугаар** | Тийм | СӨХ-тэй холбогдох, мэдэгдэл | Сонгомол | Тийм |
| **Хаяг / байр / тоот** | Тийм | СӨХ-ийн үйлчилгээ, төлбөр тооцоо | Шаардлагатай (хэрэглэгчийн төрлөөс хамаарна) | Тийм |
| **Төлбөрийн мэдээлэл** (харах) | Тийм | Төлбөрийн мэдээлэл **харуулах**, түүх | Сонгомол | Тийм |
| **Хэрэглэгчийн зурвас / хүсэлт гомдол** | Тийм | Хүсэлт гомдол хүлээн авах, шийдвэрлэх | Сонгомол | Тийм |
| **Зураг / хавсаргасан файл** (receipt гэх мэт) | Тийм | Төлбөрийн баримт, засварын зураг | Сонгомол | Тийм |
| **Төхөөрөмжийн ID / crash өгөгдөл** | Хязгаарлагдмал | Алдаа оношлох (Sentry) | Сонгомол | — (техникийн лог) |
| **Analytics** (хэрэглээний статистик) | Хязгаарлагдмал | Гүйцэтгэл хянах (Sentry performance) | Сонгомол | — |

> **Карт/банкны бодит төлбөр (QPay г.м.) одоогоор production-д идэвхгүй.** Тиймээс
> "төлбөр төлөх" гэхээсээ "**төлбөрийн мэдээлэл харах**" гэж тодорхойлсон. Listing
> дээр ч мөн адил.

---

## Play form-ын "Data types" mapping

Play Console-ийн ангиллаар:

**Personal info**
- Name — ✔ Collected · App functionality, Account management
- Email address — ✔ Collected · Account management, App functionality
- Phone number — ✔ Collected (optional) · App functionality
- Address — ✔ Collected · App functionality
- Other info (apartment/unit) — ✔ Collected · App functionality

**Financial info**
- Purchase history / payment info (харах зориулалттай) — ✔ Collected · App functionality
- (Бодит payment instrument цуглуулдаггүй)

**Messages**
- Other in-app messages (хүсэлт/гомдол) — ✔ Collected · App functionality

**Photos and videos**
- Photos — ✔ Collected (optional) · App functionality

**App activity / Diagnostics**
- Crash logs — ✔ Collected · Sentry · Analytics/Diagnostics
- Diagnostics — ✔ Collected · Sentry

Бүгд: **Encrypted in transit = Yes**, **Deletion available = Yes** (account delete урсгалаар).

---

## Хэрэглэгчийн өгөгдөл устгах

- Хуудас: `https://www.khotol.com/account/delete`
- Устах өгөгдөл: account, профайл (нэр, имэйл, утас), хүсэлт/гомдол, хавсаргасан файл.
- Хууль/санхүүгийн шалтгаанаар хадгалагдаж болох: тодорхой хугацааны төлбөр/нягтлан
  бодох бүртгэлийн мэдээлэл (СӨХ-ийн дансны үйл ажиллагаатай холбоотой).
- Хариу өгөх хугацаа: ажлын тодорхой хоногийн дотор (Privacy Policy дээрх хугацаатай нийцүүл).
- Support: `support@khotol.com`

> **Хийх ажил:** дээрх "хадгалах хугацаа" болон "хариу өгөх хугацаа"-г бодит дотоод
> бодлоготойгоо тулгаж, Privacy Policy хуудсан дээрх тоонуудтай ижил болго.
