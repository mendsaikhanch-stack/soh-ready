'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ResidentsPage() {
  const params = useParams();
  const router = useRouter();

  // Оршин суугчдын жагсаалт зөвхөн СӨХ админ дотор харагдана
  useEffect(() => {
    router.replace(`/sokh/${params.id}`);
  }, [params.id, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-6">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-500 text-sm">Энэ хуудас зөвхөн СӨХ админд харагдана</p>
      </div>
    </div>
  );
}
