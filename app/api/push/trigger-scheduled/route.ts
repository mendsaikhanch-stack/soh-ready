import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/app/lib/session-token';
import { deliverPendingForSokh } from '@/app/lib/notifications/deliver';

async function isAdminOrCron(request: NextRequest): Promise<boolean> {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true;
  return (await checkAuth('admin')).valid;
}

// Товлосон мэдэгдлүүдийг шалгаж push илгээх
export async function POST(request: NextRequest) {
  if (!await isAdminOrCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sokh_id } = await request.json();

    if (!sokh_id || typeof sokh_id !== 'number' || sokh_id <= 0) {
      return NextResponse.json({ error: 'Valid sokh_id required' }, { status: 400 });
    }

    const result = await deliverPendingForSokh(sokh_id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[push/trigger-scheduled]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
