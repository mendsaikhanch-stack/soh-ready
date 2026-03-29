// Client-side instrumentation — хөтчийн алдааг автоматаар бүртгэх

function reportError(data: {
  level: string;
  message: string;
  stack?: string;
  source: string;
  route: string;
  metadata?: Record<string, unknown>;
}) {
  fetch('/api/errors/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

// Барьж авагдаагүй JS алдаа
window.addEventListener('error', (event) => {
  reportError({
    level: 'error',
    message: event.message || 'Uncaught error',
    stack: event.error?.stack,
    source: 'client',
    route: window.location.pathname,
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
});

// Барьж авагдаагүй Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportError({
    level: 'error',
    message: reason?.message || String(reason) || 'Unhandled promise rejection',
    stack: reason?.stack,
    source: 'client',
    route: window.location.pathname,
    metadata: { type: 'unhandledrejection' },
  });
});
