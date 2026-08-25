// Гүйцэтгэгчийн тамга, захирлын гарын үсгийг Supabase Storage-ийн ХААЛТТАЙ
// bucket-аас уншина.
//
// Яагаад DB/Storage-д вэ: энэ репо public. Бэхний зургийг код дотор эсвэл
// `public/` фолдерт тавибал хэн ч татаад хуурамч баримт үйлдэж чадна.
// Storage bucket нь `public: false` тул зөвхөн service role уншина —
// сервер тал л хүрнэ, хөтөч рүү зөвхөн бэлэн болсон гэрээ дотор очно.
//
// Зураг байршуулах: node scripts/upload-seal.mjs
//
// Уншиж чадаагүй үед `undefined` буцаана — гэрээ нь тамгагүй, цэгтэй мөртэй
// гарна (алдаа шидэхгүй). Гэрээ огт татагдахгүй болохоос тамгагүй гарсан нь
// дээр.

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export const SEAL_BUCKET = 'contract-seal';
export const SEAL_FILES = {
  stamp: 'tugs-orchin-tamga.png',
  signature: 'tugs-orchin-gariin-useg.png',
};

export interface Seal {
  stamp: string;
  signature: string;
}

// Инстанс тутам нэг л удаа татна — гэрээ бүрд Storage руу явахгүй.
let cache: Seal | null = null;
let failedAt = 0;
const RETRY_MS = 60_000; // түр алдаанд 1 минутын дараа дахин оролдоно

async function toDataUri(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(SEAL_BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Тамга, гарын үсэг. Байхгүй/уншигдаагүй бол undefined. */
export async function loadSeal(): Promise<Seal | undefined> {
  if (cache) return cache;
  if (failedAt && Date.now() - failedAt < RETRY_MS) return undefined;

  const [stamp, signature] = await Promise.all([
    toDataUri(SEAL_FILES.stamp),
    toDataUri(SEAL_FILES.signature),
  ]);

  if (!stamp || !signature) {
    failedAt = Date.now();
    return undefined;
  }

  failedAt = 0;
  cache = { stamp, signature };
  return cache;
}
