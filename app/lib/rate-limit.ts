// Нийтлэг in-memory rate limiter
// Тохиргоо: windowMs хугацаанд maxRequests хүсэлт зөвшөөрнө

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimit(options: {
  name: string;
  windowMs: number;
  maxRequests: number;
}) {
  const { name, windowMs, maxRequests } = options;

  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  return {
    check(key: string): { allowed: boolean; retryAfterSec?: number } {
      const now = Date.now();
      const entry = store.get(key);

      // Хуучин entry-г цэвэрлэх
      if (entry && now >= entry.resetAt) {
        store.delete(key);
      }

      const current = store.get(key);
      if (!current) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
      }

      if (current.count >= maxRequests) {
        const retryAfterSec = Math.ceil((current.resetAt - now) / 1000);
        return { allowed: false, retryAfterSec };
      }

      current.count++;
      return { allowed: true };
    },
  };
}

// Бэлэн тохиргоонууд
export const registerLimiter = rateLimit({ name: 'register', windowMs: 60 * 60 * 1000, maxRequests: 5 });
export const errorLogLimiter = rateLimit({ name: 'error-log', windowMs: 60 * 1000, maxRequests: 30 });
export const pushSubscribeLimiter = rateLimit({ name: 'push-sub', windowMs: 60 * 1000, maxRequests: 10 });
export const qpayInvoiceLimiter = rateLimit({ name: 'qpay-invoice', windowMs: 60 * 1000, maxRequests: 10 });
export const qpayCheckLimiter = rateLimit({ name: 'qpay-check', windowMs: 60 * 1000, maxRequests: 30 });
export const adminDbLimiter = rateLimit({ name: 'admin-db', windowMs: 60 * 1000, maxRequests: 100 });
export const adminUsersLimiter = rateLimit({ name: 'admin-users', windowMs: 60 * 1000, maxRequests: 20 });
export const authCheckLimiter = rateLimit({ name: 'auth-check', windowMs: 60 * 1000, maxRequests: 60 });
export const pushSendLimiter = rateLimit({ name: 'push-send', windowMs: 60 * 1000, maxRequests: 20 });
export const profileLimiter = rateLimit({ name: 'profile', windowMs: 60 * 1000, maxRequests: 20 });
export const directoryImportLimiter = rateLimit({ name: 'directory-import', windowMs: 60 * 60 * 1000, maxRequests: 30 });
export const directorySearchLimiter = rateLimit({ name: 'directory-search', windowMs: 60 * 1000, maxRequests: 60 });
export const directoryRequestLimiter = rateLimit({ name: 'directory-request', windowMs: 60 * 60 * 1000, maxRequests: 5 });
export const manualHoaLimiter = rateLimit({ name: 'manual-hoa', windowMs: 60 * 60 * 1000, maxRequests: 10 });
export const activationIssueLimiter = rateLimit({ name: 'activation-issue', windowMs: 60 * 1000, maxRequests: 10 });
export const activationConsumeLimiter = rateLimit({ name: 'activation-consume', windowMs: 15 * 60 * 1000, maxRequests: 8 });
export const bulkOnboardLimiter = rateLimit({ name: 'bulk-onboard', windowMs: 60 * 1000, maxRequests: 5 });
