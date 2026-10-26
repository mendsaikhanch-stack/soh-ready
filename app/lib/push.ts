// Client-side push notification helper

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.error('SW registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(sokhId: number): Promise<boolean> {
  if (!('PushManager' in window)) return false;

  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Одоо байгаа subscription шалгах
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      });
    }

    // Server-д subscription хадгалах — endpoint/СӨХ өөрчлөгдөөгүй бол 7 хоногт нэг л удаа
    // (самбарт орох бүрд upsert хийж DB-д бичилт үүсгэдэг байсан)
    const marker = `${sokhId}|${subscription.endpoint}`;
    const SYNC_KEY = 'push-sub-synced';
    const SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    let synced: { marker: string; at: number } | null = null;
    try { synced = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch { /* storage хаалттай */ }
    if (synced?.marker === marker && Date.now() - synced.at < SYNC_TTL_MS) return true;

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        sokh_id: sokhId,
      }),
    });
    if (res.ok) {
      try { localStorage.setItem(SYNC_KEY, JSON.stringify({ marker, at: Date.now() })); } catch { /* ignore */ }
    }

    return true;
  } catch (err) {
    console.error('Push subscribe failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}
