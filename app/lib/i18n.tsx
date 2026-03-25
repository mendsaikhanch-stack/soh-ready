'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'mn' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  mn: {
    'app.name': 'Тоот',
    'nav.home': 'Нүүр',
    'nav.payments': 'Төлбөр',
    'nav.reports': 'Тайлан',
    'nav.announcements': 'Зарлал',
    'nav.maintenance': 'Засвар',
    'nav.residents': 'Оршин суугчид',
    'nav.parking': 'Зогсоол',
    'nav.cctv': 'Камер бичлэг',
    'nav.utilities': 'Тоолуур & Ашиглалт',
    'nav.chat': 'Хөрш чат',
    'nav.staff': 'Ажилчид',
    'nav.emergency': 'Яаралтай',
    'nav.complaints': 'Гомдол / Санал',
    'nav.marketplace': 'Хөрш маркет',
    'nav.booking': 'Зай захиалга',
    'nav.finance': 'Санхүү',
    'nav.points': 'Оноо & Шагнал',
    'nav.packages': 'Илгээмж',
    'nav.shops': 'Дэлгүүр',
    'nav.voting': 'Санал хураалт',
    'nav.contact': 'Холбоо барих',
    'nav.notifications': 'Мэдэгдэл',
    'dashboard.search': 'Үйлчилгээ хайх...',
    'dashboard.debt_banner': 'Төлбөрийн үлдэгдэл',
    'dashboard.my_debt': 'Миний өр',
    'dashboard.households': 'Айл өрх',
    'dashboard.total_debt': 'Нийт өр ₮',
    'dashboard.announcements': 'Зарлал',
    'dashboard.recent_announcements': 'СҮҮЛИЙН ЗАРЛАЛ',
    'dashboard.maintenance_requests': 'ЗАСВАР ХҮСЭЛТ',
    'dashboard.view_all': 'Бүгдийг харах',
    'common.loading': 'Ачаалж байна...',
    'common.refreshing': 'Шинэчилж байна...',
    'common.logout': 'Гарах',
    'common.save': 'Хадгалах',
    'common.cancel': 'Цуцлах',
    'common.delete': 'Устгах',
    'common.edit': 'Засах',
    'category.finance': '💵 Санхүү',
    'category.living': '🏠 Амьдрал',
    'category.services': '🔧 Үйлчилгээ',
    'category.other': '📌 Бусад',
    'status.pending': 'Хүлээгдэж байна',
    'status.in_progress': 'Хийгдэж байна',
    'status.done': 'Дууссан',
    'login.title': 'Нэвтрэх',
    'login.email': 'Имэйл хаяг',
    'login.password': 'Нууц үг',
    'login.submit': 'Нэвтрэх',
    'login.register': 'Бүртгүүлэх',
    'login.no_account': 'Бүртгэлгүй юу?',
    'login.qr': 'QR кодоор нэвтрэх',
    'offline.title': 'Интернэт холболтгүй',
    'offline.desc': 'Интернэт холболтоо шалгаад дахин оролдоно уу.',
    'offline.retry': 'Дахин оролдох',
  },
  en: {
    'app.name': 'Toot',
    'nav.home': 'Home',
    'nav.payments': 'Payments',
    'nav.reports': 'Reports',
    'nav.announcements': 'Announcements',
    'nav.maintenance': 'Maintenance',
    'nav.residents': 'Residents',
    'nav.parking': 'Parking',
    'nav.cctv': 'CCTV Footage',
    'nav.utilities': 'Utilities & Meters',
    'nav.chat': 'Neighbor Chat',
    'nav.staff': 'Staff',
    'nav.emergency': 'Emergency',
    'nav.complaints': 'Complaints / Feedback',
    'nav.marketplace': 'Neighbor Market',
    'nav.booking': 'Space Booking',
    'nav.finance': 'Finance',
    'nav.points': 'Points & Rewards',
    'nav.packages': 'Packages',
    'nav.shops': 'Shops',
    'nav.voting': 'Voting',
    'nav.contact': 'Contact',
    'nav.notifications': 'Notifications',
    'dashboard.search': 'Search services...',
    'dashboard.debt_banner': 'Outstanding Balance',
    'dashboard.my_debt': 'My Debt',
    'dashboard.households': 'Households',
    'dashboard.total_debt': 'Total Debt ₮',
    'dashboard.announcements': 'Announcements',
    'dashboard.recent_announcements': 'RECENT ANNOUNCEMENTS',
    'dashboard.maintenance_requests': 'MAINTENANCE REQUESTS',
    'dashboard.view_all': 'View all',
    'common.loading': 'Loading...',
    'common.refreshing': 'Refreshing...',
    'common.logout': 'Logout',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'category.finance': '💵 Finance',
    'category.living': '🏠 Living',
    'category.services': '🔧 Services',
    'category.other': '📌 Other',
    'status.pending': 'Pending',
    'status.in_progress': 'In Progress',
    'status.done': 'Done',
    'login.title': 'Login',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.register': 'Register',
    'login.no_account': 'No account?',
    'login.qr': 'Login with QR code',
    'offline.title': 'No Internet Connection',
    'offline.desc': 'Please check your connection and try again.',
    'offline.retry': 'Try Again',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'mn',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('mn');

  useEffect(() => {
    const saved = localStorage.getItem('sokh-locale') as Locale;
    if (saved && translations[saved]) setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('sokh-locale', l);
  };

  const t = (key: string) => translations[locale][key] || translations.mn[key] || key;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
