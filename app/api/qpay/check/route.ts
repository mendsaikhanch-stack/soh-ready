import { NextRequest, NextResponse } from 'next/server';
import { checkPayment } from '@/app/lib/qpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id required' }, { status: 400 });
    }

    const result = await checkPayment(invoice_id);

    const paid = result.count > 0 && result.rows?.some(
      (r: any) => r.payment_status === 'PAID'
    );

    return NextResponse.json({
      paid,
      paid_amount: result.paid_amount || 0,
      count: result.count || 0,
      rows: result.rows || [],
    });
  } catch (err: any) {
    console.error('QPay check error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
