'use client';

import AdviceBrowser from '@/app/components/AdviceBrowser';

// СӨХ-ийн зөвлөгөө — удирдлагын харагдац.
// Оршин суугчийнхтай яг ижил контент: дарга, нярав нь оршин суугчид юу
// харагдаж байгааг мэдэж байх нь чухал. Буцах товч байхгүй — admin shell-д
// зүүн талын цэс байдаг.
export default function AdminAdvicePage() {
  return <AdviceBrowser />;
}
