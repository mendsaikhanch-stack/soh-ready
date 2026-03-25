'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminNotifications() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/messages'); }, [router]);
  return <div className="p-6 text-gray-400">Мэдэгдэл хуудас руу шилжүүлж байна...</div>;
}
