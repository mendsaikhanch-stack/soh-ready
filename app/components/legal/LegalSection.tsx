'use client';

import { ReactNode } from 'react';

interface Props {
  number?: string | number;
  title: string;
  children: ReactNode;
}

export default function LegalSection({ number, title, children }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-gray-900 mt-2">
        {number !== undefined && <span className="text-gray-400 mr-1.5">{number}.</span>}
        {title}
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
