// Cron: системийн job queue-ыг боловсруулна
// Vercel cron эсвэл гаднаас GET /api/cron/jobs-runner?key=SECRET
// Default: 1 минут тутамд 1 удаа дууддаг — нэг тиктэнд 10 хүртэл job ажиллана.

import { NextRequest, NextResponse } from 'next/server';
import { processBatch } from '@/app/lib/jobs/worker';

export const maxDuration = 60; // Vercel — 60s хэт хэт хол явахаас сэргийлэх

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const key = request.nextUrl.searchParams.get('key') || request.headers.get('authorization')?.replace('Bearer ', '');
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(50, Math.max(1, Number(limitParam) || 10));

  const result = await processBatch(limit);
  return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
}
