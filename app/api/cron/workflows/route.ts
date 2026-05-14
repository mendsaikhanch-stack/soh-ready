// Cron: active automation_rules-уудыг scan хийж draft үүсгэнэ.
// CRON_SECRET-р хамгаалагдсан. Vercel cron эсвэл гадны scheduler-аас
// GET /api/cron/workflows?key=SECRET форматаар дуудна.

import { NextRequest, NextResponse } from 'next/server';
import { scanActiveRules } from '@/app/lib/automation/runtime';
import type { TriggerType } from '@/app/api/admin/workflows/route';

export const maxDuration = 60;

function checkSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const fromQuery = req.nextUrl.searchParams.get('key');
  const fromHeader = req.headers.get('authorization')?.replace('Bearer ', '');
  return fromQuery === cronSecret || fromHeader === cronSecret;
}

async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET тохируулаагүй' }, { status: 500 });
  }
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Filter optional
  const url = new URL(req.url);
  const triggersParam = url.searchParams.get('triggers');
  const sokhParam = url.searchParams.get('sokh_id');

  const triggerTypes = triggersParam
    ? (triggersParam.split(',').filter(Boolean) as TriggerType[])
    : undefined;
  const sokhId = sokhParam ? parseInt(sokhParam, 10) : undefined;

  const result = await scanActiveRules({
    triggerTypes,
    sokhId: Number.isFinite(sokhId) ? sokhId : undefined,
  });

  return NextResponse.json({
    ok: true,
    ts: new Date().toISOString(),
    ...result,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
