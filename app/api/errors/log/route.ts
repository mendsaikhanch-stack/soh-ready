import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { errorLogLimiter } from '@/app/lib/rate-limit';

// Алдааны лог хүлээн авах — клиент/сервер аль алинаас
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = errorLogLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { level, message, stack, digest, source, route, method, metadata } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    // User-agent header-ээс авах
    const userAgent = request.headers.get('user-agent') || undefined;

    const { error } = await supabaseAdmin.from('error_logs').insert({
      level: ['error', 'warning', 'fatal'].includes(level) ? level : 'error',
      message: message.slice(0, 2000),
      stack: typeof stack === 'string' ? stack.slice(0, 5000) : null,
      digest: typeof digest === 'string' ? digest.slice(0, 200) : null,
      source: ['client', 'server', 'api', 'instrumentation'].includes(source) ? source : 'client',
      route: typeof route === 'string' ? route.slice(0, 500) : null,
      method: typeof method === 'string' ? method.slice(0, 10) : null,
      user_agent: userAgent?.slice(0, 500),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    if (error) {
      console.error('Error logging failed:', error.message);
      return NextResponse.json({ error: 'log failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}
