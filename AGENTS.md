<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Гадаад системд хийсэн ажлыг тухай бүрд нь бич

Play Console, Supabase Dashboard, Vercel, домэйн, банк зэрэг **репогийн гадна**
хийсэн ажил (жагсаалтад хаяг нэмэх, тохиргоо солих, төлөв шалгах) нь дискэн дээр
ямар ч ул мөр үлдээдэггүй — session тасрахад мэдээлэл алга болно.

Иймд ийм ажлын үр дүнг **шууд** файлд бич:

- Тестер, лид, оршин суугчийн имэйл/утас гэх мэт **хувь хүний мэдээлэл** →
  `*.local.md` файлд (жишээ нь `playstore/testers.local.md`).
  **Репо public** тул PII-г git-д ХЭЗЭЭ Ч бүү оруул — `*.local.md` нь
  `.gitignore`-д байгаа.
- Тохиргооны шийдвэр, төлөв → холбогдох `docs/` эсвэл `playstore/` баримт руу.

Ярианы төгсгөл бүрийн хураангуй `.claude/worklog/YYYY-MM-DD.md`-д Stop hook-оор
автоматаар бичигдэнэ (`.claude/hooks/worklog.ps1`).
