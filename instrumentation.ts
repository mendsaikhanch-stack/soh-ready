// Server-side instrumentation — серверийн алдааг автоматаар бүртгэх

import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Sentry server config is loaded via sentry.server.config.ts
  // through withSentryConfig in next.config.ts
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  // Sentry-д алдааг илгээх
  Sentry.captureException(err, {
    tags: {
      source: context.routeType === 'route' ? 'api' : 'server',
      routerKind: context.routerKind,
      routeType: context.routeType,
    },
    extra: {
      route: request.path || context.routePath,
      method: request.method,
      digest: err.digest,
    },
  });

  // Алдааг error_logs endpoint-руу илгээх
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    await fetch(`${baseUrl}/api/errors/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: err.message || 'Server request error',
        stack: err.stack,
        digest: err.digest,
        source: context.routeType === 'route' ? 'api' : 'server',
        route: request.path || context.routePath,
        method: request.method,
        metadata: {
          routerKind: context.routerKind,
          routeType: context.routeType,
        },
      }),
    });
  } catch {
    // Лог бичиж чадахгүй бол console-д бичих
    console.error('[instrumentation] Error logging failed:', err.message);
  }
}
