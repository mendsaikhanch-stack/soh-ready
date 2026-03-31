import { NextRequest, NextResponse } from 'next/server';
import { createReceipt, isEbarimtConfigured } from '@/app/lib/ebarimt';
import type { EbarimtEntityType } from '@/app/lib/ebarimt';
import { getAuthRole } from '@/app/lib/session-token';

// eBarimt баримт үүсгэх
export async function POST(req: NextRequest) {
  const auth = await getAuthRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { entityType, entityId, amount, description, customerTin, items, paymentMethod, orderId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Дүн шаардлагатай' }, { status: 400 });
    }

    const type = (entityType || 'sokh') as EbarimtEntityType;

    if (!await isEbarimtConfigured(type, entityId)) {
      return NextResponse.json({
        error: `eBarimt тохиргоо хийгдээгүй (${type}). Superadmin → eBarimt тохиргоо хэсгээс нэмнэ үү.`,
        configured: false,
      }, { status: 503 });
    }

    const result = await createReceipt({
      entityType: type,
      entityId,
      amount,
      description: description || 'Төлбөр',
      customerTin,
      items: items || [{
        name: description || 'Төлбөр',
        quantity: 1,
        unitPrice: amount,
        totalAmount: amount,
      }],
      paymentMethod: paymentMethod || 'ELECTRONIC',
      orderId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.errorMessage }, { status: 500 });
    }

    return NextResponse.json({
      receiptId: result.receiptId,
      qrData: result.qrData,
      lottery: result.lottery,
    });
  } catch {
    return NextResponse.json({ error: 'Баримт үүсгэхэд алдаа гарлаа' }, { status: 500 });
  }
}

// eBarimt тохиргоо шалгах
export async function GET(req: NextRequest) {
  const auth = await getAuthRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entityType = (searchParams.get('entityType') || 'sokh') as EbarimtEntityType;
  const entityId = searchParams.get('entityId') ? parseInt(searchParams.get('entityId')!, 10) : undefined;

  const configured = await isEbarimtConfigured(entityType, entityId);
  return NextResponse.json({ configured, entityType, entityId });
}
