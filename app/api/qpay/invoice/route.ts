import { NextRequest, NextResponse } from 'next/server';
import { createInvoice } from '@/app/lib/qpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, description, orderId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'amount required' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost:3001';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${protocol}://${host}/api/qpay/callback?order_id=${orderId || Date.now()}`;

    const result = await createInvoice({
      amount,
      description: description || 'Тоот — СӨХ төлбөр',
      senderInvoiceNo: `TOOT-${Date.now()}`,
      callbackUrl,
    });

    return NextResponse.json({
      invoice_id: result.invoice_id,
      qr_image: result.qr_image,
      qr_text: result.qr_text,
      urls: result.urls || [],
    });
  } catch (err: any) {
    console.error('QPay invoice error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
