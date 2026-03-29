import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkPayment } from '@/app/lib/qpay';

// QPay callback — төлбөр төлөгдсөн үед QPay дуудна
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');

  if (!orderId || !/^[a-zA-Z0-9\-_]+$/.test(orderId)) {
    return NextResponse.json({ error: 'Valid order_id required' }, { status: 400 });
  }

  // QPay API-аар төлбөр баталгаажуулах
  try {
    const result = await checkPayment(orderId);
    const paid = result.count > 0 && result.rows?.some(
      (r: { payment_status: string }) => r.payment_status === 'PAID'
    );

    if (!paid) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    const paidAmount = result.paid_amount || 0;

    // Баталгаажсан төлбөрийг хадгалах
    await supabaseAdmin.from('payments').insert([{
      amount: paidAmount,
      description: `QPay төлбөр #${orderId}`,
    }]);

    return NextResponse.json({ success: true, amount: paidAmount });
  } catch {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
