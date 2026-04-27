'use client';

import { useEffect, useState } from 'react';

interface ClaimResult {
  membershipsLinked: number;
  activationRequestsLinked: number;
  signupRequestsLinked: number;
  hasDirectory: boolean;
  hasProvisional: boolean;
}

// Бүртгэл/нэвтрэлтийн дараа sessionStorage дотроос claim үр дүнг уншиж нэг удаа
// амжилтын мэдэгдлийг харуулна. Дахиж харагдахгүй (read-and-clear).
export default function ClaimResultToast() {
  const [info, setInfo] = useState<ClaimResult | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem('manual-hoa-claim-result');
      if (!raw) return;
      const parsed = JSON.parse(raw) as ClaimResult;
      setInfo(parsed);
      window.sessionStorage.removeItem('manual-hoa-claim-result');
    } catch {
      // ignore
    }
  }, []);

  if (!info) return null;

  const tenantHint = info.hasDirectory
    ? 'Үндсэн жагсаалттай холбогдсон.'
    : info.hasProvisional
    ? 'Танай гар оролтын СӨХ хадгалагдсан.'
    : '';

  return (
    <div className="fixed top-4 inset-x-4 z-50 max-w-md mx-auto bg-green-50 border border-green-200 rounded-2xl p-4 shadow-lg">
      <div className="flex items-start gap-2">
        <span className="text-xl">✅</span>
        <div className="flex-1 text-sm">
          <p className="font-semibold text-green-800">
            Таны өмнөх СӨХ хүсэлт таны бүртгэлтэй холбогдлоо.
          </p>
          {tenantHint && <p className="text-green-700 text-xs mt-1">{tenantHint}</p>}
        </div>
        <button onClick={() => setInfo(null)} className="text-green-700 text-xs">×</button>
      </div>
    </div>
  );
}
