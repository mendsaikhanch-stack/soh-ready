export interface Theme {
  id: string;
  name: string;
  nameEn: string;
  preview: string; // gradient for preview card
  header: string; // header bg classes
  headerText: string;
  accent: string; // accent color for buttons, links
  accentHover: string;
  cardBg: string;
  cardBorder: string;
  statBg: string;
  badge: string; // notification badge
  menuActive: string;
  gradient: string; // main gradient
}

export const themes: Theme[] = [
  {
    id: 'classic',
    name: 'Сонгодог цэнхэр',
    nameEn: 'Classic Blue',
    preview: 'bg-gradient-to-br from-blue-500 to-blue-700',
    header: 'bg-blue-600',
    headerText: 'text-white',
    accent: 'bg-blue-600',
    accentHover: 'hover:bg-blue-700',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
    statBg: 'bg-white',
    badge: 'bg-red-500',
    menuActive: 'bg-blue-100 text-blue-700',
    gradient: 'bg-gradient-to-br from-blue-600 to-blue-800',
  },
  {
    id: 'emerald',
    name: 'Ногоон ногоон',
    nameEn: 'Emerald',
    preview: 'bg-gradient-to-br from-emerald-500 to-teal-700',
    header: 'bg-emerald-600',
    headerText: 'text-white',
    accent: 'bg-emerald-600',
    accentHover: 'hover:bg-emerald-700',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-200',
    statBg: 'bg-white',
    badge: 'bg-red-500',
    menuActive: 'bg-emerald-100 text-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-600 to-teal-800',
  },
  {
    id: 'purple',
    name: 'Ягаан нил',
    nameEn: 'Royal Purple',
    preview: 'bg-gradient-to-br from-violet-500 to-purple-700',
    header: 'bg-violet-600',
    headerText: 'text-white',
    accent: 'bg-violet-600',
    accentHover: 'hover:bg-violet-700',
    cardBg: 'bg-violet-50',
    cardBorder: 'border-violet-200',
    statBg: 'bg-white',
    badge: 'bg-pink-500',
    menuActive: 'bg-violet-100 text-violet-700',
    gradient: 'bg-gradient-to-br from-violet-600 to-purple-800',
  },
  {
    id: 'sunset',
    name: 'Нар жаргалт',
    nameEn: 'Sunset',
    preview: 'bg-gradient-to-br from-orange-400 to-rose-600',
    header: 'bg-gradient-to-r from-orange-500 to-rose-500',
    headerText: 'text-white',
    accent: 'bg-orange-500',
    accentHover: 'hover:bg-orange-600',
    cardBg: 'bg-orange-50',
    cardBorder: 'border-orange-200',
    statBg: 'bg-white',
    badge: 'bg-rose-500',
    menuActive: 'bg-orange-100 text-orange-700',
    gradient: 'bg-gradient-to-br from-orange-500 to-rose-600',
  },
  {
    id: 'midnight',
    name: 'Шөнийн хар',
    nameEn: 'Midnight',
    preview: 'bg-gradient-to-br from-gray-800 to-slate-900',
    header: 'bg-gray-900',
    headerText: 'text-white',
    accent: 'bg-gray-800',
    accentHover: 'hover:bg-gray-900',
    cardBg: 'bg-gray-100',
    cardBorder: 'border-gray-300',
    statBg: 'bg-white',
    badge: 'bg-blue-500',
    menuActive: 'bg-gray-200 text-gray-900',
    gradient: 'bg-gradient-to-br from-gray-800 to-slate-900',
  },
  {
    id: 'sky',
    name: 'Тэнгэр цэнхэр',
    nameEn: 'Sky',
    preview: 'bg-gradient-to-br from-sky-400 to-cyan-600',
    header: 'bg-gradient-to-r from-sky-500 to-cyan-500',
    headerText: 'text-white',
    accent: 'bg-sky-500',
    accentHover: 'hover:bg-sky-600',
    cardBg: 'bg-sky-50',
    cardBorder: 'border-sky-200',
    statBg: 'bg-white',
    badge: 'bg-red-500',
    menuActive: 'bg-sky-100 text-sky-700',
    gradient: 'bg-gradient-to-br from-sky-500 to-cyan-600',
  },
];

export function getTheme(id: string): Theme {
  return themes.find(t => t.id === id) || themes[0];
}
