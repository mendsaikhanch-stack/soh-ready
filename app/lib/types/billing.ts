export type PlanType = 'fixed_monthly' | 'per_apartment' | 'per_transaction' | 'one_time' | 'hybrid';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'cancelled';
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type TransactionStatus = 'pending' | 'confirmed' | 'settled';

export interface PlatformPlan {
  id: number;
  name: string;
  type: PlanType;
  base_fee: number;
  per_unit_fee: number;
  commission_percent: number;
  billing_cycle: BillingCycle;
  features: string[];
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SokhSubscription {
  id: number;
  sokh_id: number;
  plan_id: number;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  trial_ends_at: string | null;
  custom_pricing: Record<string, number>;
  notes: string | null;
  plan?: PlatformPlan;
  sokh_name?: string;
}

export interface PlatformInvoice {
  id: number;
  sokh_id: number;
  subscription_id: number | null;
  period_year: number;
  period_month: number;
  amount: number;
  calculation_details: {
    base_fee?: number;
    apartments?: number;
    per_unit_fee?: number;
    unit_total?: number;
    commission_total?: number;
    plan_name?: string;
    plan_type?: PlanType;
  };
  status: InvoiceStatus;
  due_date: string;
  paid_at: string | null;
  paid_amount: number | null;
  sokh_name?: string;
}

export interface PlatformBankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface PlatformTransaction {
  id: number;
  payment_id: number | null;
  sokh_id: number | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  description: string | null;
  qpay_order_id: string | null;
  status: TransactionStatus;
  created_at: string;
}

export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  fixed_monthly: 'Тогтмол сарын',
  per_apartment: 'Айл тутамд',
  per_transaction: 'Гүйлгээний комисс',
  one_time: 'Нэг удаагийн',
  hybrid: 'Хосолсон',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Идэвхтэй',
  trial: 'Туршилт',
  suspended: 'Түр зогсоосон',
  cancelled: 'Цуцалсан',
};

export interface SokhTier {
  id: number;
  name: string;
  code: string;
  per_unit_fee: number;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Хүлээгдэж буй',
  paid: 'Төлөгдсөн',
  overdue: 'Хугацаа хэтэрсэн',
  cancelled: 'Цуцалсан',
};
