import { NextResponse } from 'next/server';
import { loadSokhBuildings } from '@/app/lib/sokh-buildings';

// Бүртгүүлэх хуудсанд СӨХ-ийн байрнуудын жагсаалт (33А, 33Б…).
//
// Яагаад: олон байртай СӨХ-д тоот нь байр бүрд 1-ээс эхэлдэг. Оршин суугч
// байраа гараар бичихдээ «33» гэж бичээд орцоо тусад нь бичдэг байсан тул
// даргын бүртгэлтэй (building = «33А») таарахгүй, давхар мөр үүсдэг байв
// (Аман хуур дижитал, 2026-10-21). Жагсаалтаас сонгуулбал яг таарна.
//
// Нэвтрээгүй хүн дуудна — зөвхөн байрны нэрийг буцаана, хувь хүний мэдээлэл үгүй.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const sokhId = Number(new URL(request.url).searchParams.get('sokh')) || 0;
  if (!sokhId) return NextResponse.json({ buildings: [] });
  return NextResponse.json({ buildings: await loadSokhBuildings(sokhId) });
}
