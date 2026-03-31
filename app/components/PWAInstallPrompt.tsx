'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt({ appName = 'Тоот' }: { appName?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // iOS Safari дээр beforeinstallprompt event байхгүй
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches;

    if (ios && !standalone) {
      // iOS дээр аль хэдийн суулгасан эсвэл хэрэглэгч хаасан эсэхийг шалгах
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setIsIOS(true);
        setShowBanner(true);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // iOS дээр зааварчилгаа харуулна
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl z-[100] animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{appName} суулгах</p>
          {isIOS ? (
            <p className="text-xs text-blue-100 mt-1">
              Safari-н <span className="inline-block">⬆️ Share</span> товч дараад <strong>&quot;Add to Home Screen&quot;</strong> сонгоно уу
            </p>
          ) : (
            <p className="text-xs text-blue-100 mt-0.5">Нүүр хуудаст нэмж, апп шиг ашиглана</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-blue-200 hover:text-white px-2 py-2 rounded-lg"
          >
            Дараа
          </button>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="bg-white text-blue-600 text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-50 transition"
            >
              Суулгах
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
