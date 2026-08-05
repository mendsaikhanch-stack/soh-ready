'use client';

import { useParams } from 'next/navigation';
import AdviceBrowser from '@/app/components/AdviceBrowser';

// СӨХ-ийн зөвлөгөө — оршин суугчийн харагдац.
// Контент нь бүх СӨХ-д ижил (app/lib/advice/data.ts) тул sokh_id-аас хамаарахгүй.
export default function AdvicePage() {
  const params = useParams();
  return <AdviceBrowser backHref={`/sokh/${params.id}`} />;
}
