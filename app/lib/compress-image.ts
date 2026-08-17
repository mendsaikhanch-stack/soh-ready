/**
 * Хөтөч дээр зураг шахах — Storage-д хуулахын өмнө заавал дамжуулна.
 *
 * Утасны камерын зураг 4–8MB (48MP бол 12MB+) хүрдэг. Тэр чигээр нь хуулбал:
 *   • илгээгчийн дата дуусна,
 *   • харагчийн утсанд удаан ачаална,
 *   • `uploads` bucket-ийн 10MB хязгаараас давж upload унана.
 *
 * Урт талыг 1600px болгож жижигрүүлээд JPEG (чанар 0.8) болгоно —
 * ердийн засварын зураг ~200–500KB болж буудаг.
 *
 * Хөтөч `createImageBitmap`/`canvas`-ыг дэмжихгүй бол эх файлыг нь буцаана
 * (шахалтгүй ч илгээгдэх нь огт илгээгдэхгүй байснаас дээр).
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    );
    return blob || file;
  } catch {
    return file; // хөтөч дэмжихгүй бол эх зургаар нь илгээнэ
  }
}
