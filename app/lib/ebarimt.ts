// ============================================
// eBarimt POS API интеграц
// СӨХ, ОСНАА, ЦАХ тус бүр өөрийн credential-тэй
// ============================================

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export type EbarimtEntityType = 'sokh' | 'osnaa' | 'tsah' | 'platform';

interface EbarimtCredentials {
  merchant_tin: string;
  pos_no: string;
  branch_id: string;
  client_id: string;
  client_secret: string;
  auth_url: string;
  api_url: string;
}

// Token cache: entity_type:entity_id -> token
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// DB-ээс credential авах
async function getCredentials(entityType: EbarimtEntityType, entityId?: number): Promise<EbarimtCredentials | null> {
  let query = supabaseAdmin
    .from('ebarimt_configs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('is_active', true)
    .limit(1);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  } else {
    query = query.is('entity_id', null);
  }

  const { data } = await query.single();
  if (!data) return null;

  return {
    merchant_tin: data.merchant_tin,
    pos_no: data.pos_no,
    branch_id: data.branch_id || '',
    client_id: data.client_id,
    client_secret: data.client_secret,
    auth_url: data.auth_url || 'https://auth.itc.gov.mn/auth/realms/Production/protocol/openid-connect/token',
    api_url: data.api_url || 'https://api.ebarimt.mn',
  };
}

// Тохиргоо бэлэн эсэх
export async function isEbarimtConfigured(entityType: EbarimtEntityType = 'platform', entityId?: number): Promise<boolean> {
  const creds = await getCredentials(entityType, entityId);
  return !!creds;
}

// OAuth token авах
async function getToken(creds: EbarimtCredentials): Promise<string> {
  const cacheKey = `${creds.merchant_tin}:${creds.pos_no}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const res = await fetch(creds.auth_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
  });

  if (!res.ok) throw new Error(`eBarimt auth failed: ${res.status}`);

  const data = await res.json();
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });

  return data.access_token;
}

export interface EbarimtReceiptInput {
  entityType: EbarimtEntityType;
  entityId?: number;        // sokh_id, osnaa_id гэх мэт
  amount: number;
  vatAmount?: number;
  customerTin?: string;
  description: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
  paymentMethod?: string;
  orderId?: string;
}

export interface EbarimtReceiptResult {
  success: boolean;
  receiptId?: string;
  qrData?: string;
  lottery?: string;
  errorMessage?: string;
}

// Баримт үүсгэх
export async function createReceipt(input: EbarimtReceiptInput): Promise<EbarimtReceiptResult> {
  const creds = await getCredentials(input.entityType, input.entityId);
  if (!creds) {
    return { success: false, errorMessage: `eBarimt тохиргоо хийгдээгүй (${input.entityType})` };
  }

  try {
    const token = await getToken(creds);
    const vatAmount = input.vatAmount ?? Math.round(input.amount / 11);

    const receiptData = {
      totalAmount: input.amount,
      totalVAT: vatAmount,
      totalCityTax: 0,
      districtCode: '',
      merchantTin: creds.merchant_tin,
      posNo: creds.pos_no,
      branchNo: creds.branch_id,
      type: input.customerTin ? '3' : '1', // 3=B2B (ТТД байвал), 1=B2C
      customerTin: input.customerTin || '',
      invoiceId: input.orderId || `TOOT-${Date.now()}`,
      reportMonth: new Date().toISOString().slice(0, 7).replace('-', ''),
      stocks: input.items.map(item => ({
        code: '',
        name: item.name,
        measureUnit: 'шт',
        qty: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        cityTax: 0,
        vat: Math.round(item.totalAmount / 11),
        barCode: '',
      })),
      payments: [{
        code: input.paymentMethod === 'CASH' ? 'P0001' : 'P0104',
        status: 'paid',
        paidAmount: input.amount,
      }],
    };

    const res = await fetch(`${creds.api_url}/api/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(receiptData),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, errorMessage: `eBarimt API: ${res.status} ${errText}` };
    }

    const result = await res.json();
    return {
      success: true,
      receiptId: result.id || result.invoiceId,
      qrData: result.qrData || result.qr_text || result.qr,
      lottery: result.lottery || result.lotteryWarningMsg,
    };
  } catch (err) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : 'eBarimt алдаа',
    };
  }
}

// Баримт буцаах
export async function returnReceipt(
  entityType: EbarimtEntityType,
  entityId: number | undefined,
  receiptId: string
): Promise<{ success: boolean; errorMessage?: string }> {
  const creds = await getCredentials(entityType, entityId);
  if (!creds) return { success: false, errorMessage: 'eBarimt тохиргоо хийгдээгүй' };

  try {
    const token = await getToken(creds);
    const res = await fetch(`${creds.api_url}/api/invoice/${receiptId}/return`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return { success: false, errorMessage: `Return failed: ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, errorMessage: err instanceof Error ? err.message : 'Буцаалт алдаа' };
  }
}
