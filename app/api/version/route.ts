import { NextResponse } from 'next/server';

// Одоо production-д ажиллаж буй хувилбарыг буцаана.
// Клиент нь өөрийн багцад шингэсэн NEXT_PUBLIC_APP_VERSION-тэй харьцуулж,
// зөрвөл "шинэ хувилбар гарлаа" зурвасыг харуулна.
//
// ЗААВАЛ cache хийлгэхгүй — эс бөгөөс хуучин хариу буцаж, шинэчлэлт мэдэгдэхгүй.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
