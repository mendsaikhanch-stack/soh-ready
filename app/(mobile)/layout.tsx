'use client';

import { AuthProvider } from '@/app/lib/auth-context';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex justify-center bg-gray-200 min-h-screen">
        <div className="w-full max-w-[430px] min-h-screen bg-white shadow-2xl">
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
