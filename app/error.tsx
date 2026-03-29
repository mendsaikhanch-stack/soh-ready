'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Алдааг серверт бүртгэх
    fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: error.message || 'Unknown error',
        stack: error.stack,
        digest: error.digest,
        source: 'client',
        route: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        <div className="text-5xl mb-4">:(</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Алдаа гарлаа
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          Уучлаарай, ямар нэгэн алдаа гарлаа. Дахин оролдоно уу.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">
            Код: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => unstable_retry()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Дахин оролдох
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Нүүр хуудас
          </button>
        </div>
      </div>
    </div>
  );
}
