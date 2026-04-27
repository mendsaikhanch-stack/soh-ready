'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** "blue" — оршин суугч, "amber" — админ, "slate" — нийтлэг */
  accent?: 'blue' | 'amber' | 'slate';
}

const ACCENTS = {
  blue: 'bg-blue-600',
  amber: 'bg-amber-600',
  slate: 'bg-slate-700',
};

export default function LegalPage({ title, subtitle, children, accent = 'slate' }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-white">
        <div className={`${ACCENTS[accent]} text-white px-4 py-4`}>
          <button onClick={() => router.back()} className="text-white/80 text-sm mb-1">← Буцах</button>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-white/80 mt-0.5">{subtitle}</p>}
        </div>

        <article className="px-4 py-5 text-sm text-gray-800 leading-relaxed space-y-4">
          {children}
        </article>

        <footer className="px-4 py-4 border-t bg-gray-50 text-xs text-gray-500 text-center">
          © Хотол · Бүх эрх хуулиар хамгаалагдсан
        </footer>
      </div>
    </div>
  );
}
