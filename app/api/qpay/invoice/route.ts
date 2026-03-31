import { NextRequest, NextResponse } from 'next/server';
import { createInvoice } from '@/app/lib/qpay';
import { qpayInvoiceLimiter } from '@/app/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = qpayInvoiceLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Хэт олон хүсэлт. Түр хүлээнэ үү' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { amount, description, orderId, sokhId } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 100_000_000) {
      return NextResponse.json({ error: 'amount required (1 - 100,000,000)' }, { status: 400 });
    }

    // orderId sanitize — зөвхөн alphanumeric болон зураас зөвшөөрнө
    const safeOrderId = String(orderId || Date.now()).replace(/[^a-zA-Z0-9\-_]/g, '');

    const host = request.headers.get('host') || 'localhost:3001';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${protocol}://${host}/api/qpay/callback?order_id=${safeOrderId}`;

    const result = await createInvoice({
      amount,
      description: description || 'Тоот — СӨХ төлбөр',
      senderInvoiceNo: sokhId ? `TOOT-${sokhId}-${Date.now()}` : `TOOT-${Date.now()}`,
      callbackUrl,
    });

    return NextResponse.json({
      invoice_id: result.invoice_id,
      qr_image: result.qr_image,
      qr_text: result.qr_text,
      urls: result.urls || [],
    });
  } catch (err: unknown) {
    console.error('QPay invoice error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Нэхэмжлэл үүсгэхэд алдаа гарлаа' }, { status: 500 });
  }
}
