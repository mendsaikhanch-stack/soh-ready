import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import { getAiSettings, upsertAiSettings } from '@/app/lib/ai/settings';
import type { ProviderName } from '@/app/lib/ai/core';

// ============================================================
// /api/admin/ai/settings
// ------------------------------------------------------------
// GET   — current sokh-ийн AI тохиргоо
// PATCH — ai_enabled / ai_provider / monthly_limit солих
// ============================================================

const ALLOWED_PROVIDERS: ProviderName[] = ['template', 'anthropic', 'openai', 'gemini'];

function resolveSokhId(
  auth: { role?: string; sokhId?: string },
  override?: number | null,
): number | null {
  if (auth.role === 'superadmin' && override && override > 0) return override;
  if (!auth.sokhId) return null;
  const n = parseInt(auth.sokhId, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ============================================================
// GET
// ============================================================

export async function GET(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const sokhParam = url.searchParams.get('sokh_id');
  const override = sokhParam ? parseInt(sokhParam, 10) : null;

  const sokhId = resolveSokhId(auth, override);
  if (!sokhId) {
    return NextResponse.json(
      { error: 'sokh_id тодорхойлогдоогүй' },
      { status: 400 },
    );
  }

  const settings = await getAiSettings(sokhId);
  return NextResponse.json({ settings });
}

// ============================================================
// PATCH
// ============================================================

interface PatchBody {
  sokh_id?: number;
  ai_enabled?: boolean;
  ai_provider?: string;
  monthly_limit?: number;
}

export async function PATCH(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sokhId = resolveSokhId(auth, body.sokh_id ?? null);
  if (!sokhId) {
    return NextResponse.json(
      { error: 'sokh_id тодорхойлогдоогүй' },
      { status: 400 },
    );
  }

  const patch: Partial<{
    ai_enabled: boolean;
    ai_provider: ProviderName;
    monthly_limit: number;
  }> = {};

  if (typeof body.ai_enabled === 'boolean') {
    patch.ai_enabled = body.ai_enabled;
  }
  if (body.ai_provider !== undefined) {
    if (!ALLOWED_PROVIDERS.includes(body.ai_provider as ProviderName)) {
      return NextResponse.json({ error: 'ai_provider буруу' }, { status: 400 });
    }
    patch.ai_provider = body.ai_provider as ProviderName;
  }
  if (body.monthly_limit !== undefined) {
    const n = Number(body.monthly_limit);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'monthly_limit буруу' }, { status: 400 });
    }
    patch.monthly_limit = Math.floor(n);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Өөрчлөх талбар алга' }, { status: 400 });
  }

  try {
    const settings = await upsertAiSettings(sokhId, patch);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update алдаа' },
      { status: 500 },
    );
  }
}
