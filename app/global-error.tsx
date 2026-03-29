'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Ноцтой алдааг серверт бүртгэх
    fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'fatal',
        message: error.message || 'Global error',
        stack: error.stack,
        digest: error.digest,
        source: 'client',
        route: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="mn">
      <body className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">:(</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Системийн алдаа
          </h2>
          <p className="text-gray-400 mb-6 text-sm">
            Ноцтой алдаа гарлаа. Хуудсыг дахин ачаалана уу.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-500 mb-4 font-mono">
              Код: {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Дахин ачаалах
          </button>
        </div>
      </body>
    </html>
  );
}
