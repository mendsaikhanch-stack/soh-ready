// Гарын үсгийн нууц түлхүүр авах.
// Production-д env тохируулаагүй бол алдаа шиднэ (fail closed) — эс бөгөөс
// репод ил байгаа fallback утгаар хэн ч superadmin session хуурамчаар үүсгэж чадна.
// Lazy (дуудах үед) шалгадаг тул env-гүй build-ийг унагаахгүй.
export function getSigningSecret(value: string | undefined, devFallback: string, name = 'SESSION_SECRET'): string {
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} env тохируулаагүй байна`);
  }
  return devFallback;
}
