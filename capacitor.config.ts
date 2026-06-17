import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Хотол — Android wrapper (Capacitor)
 *
 * Архитектур: remote-URL wrapper. App нь production вебсайт
 * https://www.khotol.com -ыг WebView дотор ачаална (Next.js SSR
 * учир static export боломжгүй). Интернэт алга бол server.errorPath
 * (offline.html) харагдана.
 *
 * webDir доторх файлууд зөвхөн fallback/offline зориулалттай.
 */
const config: CapacitorConfig = {
  appId: 'mn.khotol.app',
  appName: 'Хотол',
  webDir: 'mobile/www',
  backgroundColor: '#ffffff',
  server: {
    url: 'https://www.khotol.com',
    cleartext: false,
    errorPath: 'offline.html',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#2563eb',
      overlaysWebView: false,
    },
  },
};

export default config;
