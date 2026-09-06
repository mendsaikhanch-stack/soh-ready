// Хадгалалт хаагдсан хөтчид ч унахгүй localStorage / sessionStorage.
//
// ЯАГААД: iOS Safari нь localStorage-д хандахад **алдаа шиддэг** (биш нь null
// буцаадаг) хэд хэдэн тохиолдол бий:
//   • Facebook / Messenger / Instagram-ийн доторх хөтөч (in-app webview)
//   • Private Browsing горим
//   • «Prevent Cross-Site Tracking», cookie хаасан тохиргоо
// Алдааны текст нь «The operation is insecure.» Хамгаалалтгүй бол энэ нь
// React-ийн бүрхүүлээр дамжиж, бүх апп «Системийн алдаа» болж унана.
//
// 2026-09-04-нд Өрнөлт СӨХ-ийн оршин суугч Messenger-ийн доторх хөтчөөр
// khotol.com/register нээхэд яг ингэж унасан (error_logs: fatal · /register ·
// "The operation is insecure." — 10 гаруй удаа дахин оролдсон).
//
// ЗАРЧИМ: хадгалалт бол ТОХЬТОЙ БАЙДАЛ, шаардлага биш. Хандаж чадахгүй бол
// санах ойн Map руу бичээд ажиллаад л байх ёстой — хуудас унах ёсгүй.
//
// Хэрэглээ:
//   import { safeLocal, safeSession } from '@/app/lib/safe-storage';
//   safeLocal.getItem('key');            // null буцаана, шидэхгүй
//   safeLocal.setItem('key', 'value');   // чадвал бичнэ, чадахгүй бол санах ойд

type Memory = Map<string, string>;

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Жинхэнэ хадгалалт ажиллаж байгаа эсэх — UI-д «хадгалагдахгүй» гэж
   *  анхааруулах хэрэгтэй үед л ашиглана. */
  readonly persistent: boolean;
}

function createSafeStorage(pick: () => Storage): SafeStorage {
  const memory: Memory = new Map();
  let native: Storage | null | undefined; // undefined = хараахан шалгаагүй

  // Хөтөч заримдаа объектыг өгөөд хандахад нь шиддэг тул бичиж үзэж шалгана.
  function resolve(): Storage | null {
    if (native !== undefined) return native;
    try {
      if (typeof window === 'undefined') return (native = null);
      const s = pick();
      const probe = '__khotol_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      native = s;
    } catch {
      native = null;
    }
    return native;
  }

  return {
    get persistent() {
      return resolve() !== null;
    },
    getItem(key) {
      const s = resolve();
      if (s) {
        try {
          return s.getItem(key);
        } catch {
          /* дундуур хаагдсан — санах ой руу шилжинэ */
        }
      }
      return memory.has(key) ? (memory.get(key) as string) : null;
    },
    setItem(key, value) {
      memory.set(key, value);
      const s = resolve();
      if (!s) return;
      try {
        s.setItem(key, value);
      } catch {
        /* багтаамж дүүрсэн эсвэл хаагдсан — санах ойд үлдэнэ */
      }
    },
    removeItem(key) {
      memory.delete(key);
      const s = resolve();
      if (!s) return;
      try {
        s.removeItem(key);
      } catch {
        /* алгасана */
      }
    },
  };
}

export const safeLocal = createSafeStorage(() => window.localStorage);
export const safeSession = createSafeStorage(() => window.sessionStorage);
