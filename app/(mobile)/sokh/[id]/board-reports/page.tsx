'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Хуучин хаяг — «🏛 Зөвлөл» хэсгийн «Тайлан» таб руу шилжсэн.
export default function BoardReportsRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/sokh/${params.id}/council?tab=reports`);
  }, [params.id, router]);
  return null;
}
