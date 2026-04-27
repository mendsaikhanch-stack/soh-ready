import { NextRequest, NextResponse } from 'next/server';
import { createInvoice } from '@/app/lib/qpay';
import { qpayInvoiceLimiter } from '@/app/lib/rate-limit';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { allowed } = qpayInvoiceLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Хэт олон хүсэлт. Түр хүлээнэ үү' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { amount, description, sokhId, residentId, entityType } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 100_000_000) {
      return NextResponse.json({ error: 'amount required (1 - 100,000,000)' }, { status: 400 });
    }

    // Сервер талаас үүсгэх invoice ID — клиент impersonate хийж чадахгүй болгоно
    const prefix =
      entityType === 'osnaa' ? 'OSNAA' :
      entityType === 'tsah' ? 'TSAH' :
      entityType === 'platform' ? 'PLAT' : 'TOOT';
    const senderInvoiceNo = sokhId
      ? `${prefix}-${sokhId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const callbackUrl = `${protocol}://${host}/api/qpay/callback?order_id=${senderInvoiceNo}`;

    // Invoice-ыг манай DB-д урьдчилж бүртгэх (callback verify-д ашиглана)
    const { error: trackErr } = await supabaseAdmin.from('qpay_invoices').insert({
      sender_invoice_no: senderInvoiceNo,
      sokh_id: sokhId || null,
      resident_id: residentId || null,
      entity_type: entityType || (sokhId ? 'sokh' : null),
      amount,
      description: description || 'Хотол — СӨХ төлбөр',
      status: 'pending',
    });
    if (trackErr) {
      console.error('[qpay/invoice] track error:', trackErr.message);
      return NextResponse.json({ error: 'Нэхэмжлэл бүртгэхэд алдаа гарлаа' }, { status: 500 });
    }

    const result = await createInvoice({
      amount,
      description: description || 'Хотол — СӨХ төлбөр',
      senderInvoiceNo,
      callbackUrl,
    });

    // QPay-ийн буцаасан invoice_id-г хадгалах
    if (result?.invoice_id) {
      await supabaseAdmin.from('qpay_invoices')
        .update({ qpay_invoice_id: result.invoice_id })
        .eq('sender_invoice_no', senderInvoiceNo);
    }

    return NextResponse.json({
      invoice_id: result.invoice_id,
      qr_image: result.qr_image,
      qr_text: result.qr_text,
      urls: result.urls || [],
      order_id: senderInvoiceNo,
    });
  } catch (err: unknown) {
    console.error('QPay invoice error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Нэхэмжлэл үүсгэхэд алдаа гарлаа' }, { status: 500 });
  }
}
