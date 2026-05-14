import { NextRequest, NextResponse } from 'next/server';
import { checkAnyAuth } from '@/app/lib/session-token';
import {
  type AiKind,
  type AiGenerationResult,
  type OutputLayer,
  type ProviderName,
  enhanceWithAi,
  getProviderByName,
  makeResult,
} from '@/app/lib/ai/core';
import { checkAiQuota, recordUsage } from '@/app/lib/ai/settings';
import {
  type DebtReminderInput,
  type FinancialReportInput,
  type MonthlyInsightInput,
  type IssueInsightInput,
  type BoardReportInput,
  templateDebtReminder,
  templateFinancialReport,
  templateMonthlyInsight,
  templateIssueInsight,
  templateBoardReport,
  type DebtReminderOutput,
  type FinancialReportOutput,
  type BoardReportOutput,
} from '@/app/lib/ai/prompts/soh-operations';
import { getAdapterInput, type AdapterSource } from '@/app/lib/ai/data-adapters';

// ============================================================
// POST /api/admin/ai/generate
// ------------------------------------------------------------
// Body форматууд:
//   А) { kind, month?, enhance? }            ← Adapter-аар data татна (default)
//   Б) { kind, input, enhance? }             ← Гар оролт (test/runtime/old UI)
//
// Source-н тэмдэглэгээ:
//   - real   — DB-ээс жинхэнэ өгөгдөл
//   - demo   — KHOTOL_DEMO_MODE=1 эсвэл client-аас raw input
//   - empty  — DB-д хариу алга — input хоосон утгатай
// ============================================================

type BodyA = {
  kind: AiKind;
  input?: never;
  month?: string;
  enhance?: boolean;
};

type BodyB =
  | { kind: 'debt_reminder'; input: DebtReminderInput; month?: string; enhance?: boolean }
  | { kind: 'financial_report'; input: FinancialReportInput; month?: string; enhance?: boolean }
  | { kind: 'monthly_insight'; input: MonthlyInsightInput; month?: string; enhance?: boolean }
  | { kind: 'issue_insight'; input: IssueInsightInput; month?: string; enhance?: boolean }
  | { kind: 'board_report'; input: BoardReportInput; month?: string; enhance?: boolean };

type Body = BodyA | BodyB;

const KINDS: AiKind[] = [
  'debt_reminder',
  'financial_report',
  'monthly_insight',
  'issue_insight',
  'board_report',
];

export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('kind' in body)) {
    return NextResponse.json({ error: 'kind дутуу' }, { status: 400 });
  }
  if (!KINDS.includes(body.kind)) {
    return NextResponse.json({ error: 'Тодорхойгүй kind' }, { status: 400 });
  }

  const sokhIdRaw = auth.sokhId ? parseInt(auth.sokhId, 10) : 0;
  const sokhId = Number.isFinite(sokhIdRaw) && sokhIdRaw > 0 ? sokhIdRaw : 0;
  const warnings: string[] = [];

  // ============================================================
  // Step 1 — Input өгөгдлийг шийдэх
  // ============================================================
  // a) Client raw input өгсөн бол түүнийг шууд ашиглана (test/runtime path).
  // b) Үгүй бол adapter-ийг дуудна (sokhId + month-аас) — KHOTOL_DEMO_MODE=1
  //    бол demo буцна, эс бол бодит DB query.

  let inputForTemplate: unknown;
  let source: AdapterSource = 'real';
  let adapterNotes: string[] | undefined;

  if ('input' in body && body.input) {
    inputForTemplate = body.input;
    source = 'demo'; // raw client input — бид жинхэнэ DB query хийгээгүй
  } else {
    if (sokhId <= 0) {
      return NextResponse.json(
        { error: 'Session-д sokh_id байхгүй — гар input өгөх эсвэл нэвтрэх СӨХ-ээ сонгох хэрэгтэй' },
        { status: 400 },
      );
    }
    const adapter = await getAdapterInput(body.kind, {
      sokhId,
      month: body.month,
    });
    inputForTemplate = adapter.input;
    source = adapter.source;
    adapterNotes = adapter.notes;
  }

  // ============================================================
  // Step 2 — Layer 2 template output
  // ============================================================
  let templateOut: unknown;
  try {
    switch (body.kind) {
      case 'debt_reminder':
        templateOut = templateDebtReminder(inputForTemplate as DebtReminderInput);
        break;
      case 'financial_report':
        templateOut = templateFinancialReport(inputForTemplate as FinancialReportInput);
        break;
      case 'monthly_insight':
        templateOut = templateMonthlyInsight(inputForTemplate as MonthlyInsightInput);
        break;
      case 'issue_insight':
        templateOut = templateIssueInsight(inputForTemplate as IssueInsightInput);
        break;
      case 'board_report':
        templateOut = templateBoardReport(inputForTemplate as BoardReportInput);
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Template generation алдаа' },
      { status: 500 },
    );
  }

  // ============================================================
  // Step 3 — Layer 3 (AI enhance) шаардсан эсэх
  // ============================================================
  const wantsEnhance = body.enhance === true;
  let layer: OutputLayer = 'template';
  let provider: ProviderName = 'template';
  let fallbackReason: string | undefined;
  let finalOutput: unknown = templateOut;

  if (wantsEnhance && sokhId > 0) {
    const quota = await checkAiQuota(sokhId);

    if (!quota.allowed) {
      fallbackReason = quota.reason || 'Quota татгалзав';
    } else {
      const p = getProviderByName(quota.settings.ai_provider);
      if (!p || p.name === 'template') {
        fallbackReason = 'Provider key байхгүй';
      } else {
        const enhanced = await enhanceTextFields(body.kind, templateOut, p);
        if (enhanced.ok) {
          finalOutput = enhanced.output;
          layer = 'ai_enhanced';
          provider = p.name;
        } else {
          fallbackReason = enhanced.error || 'Enhancement алдаа';
          warnings.push(`AI fallback: ${fallbackReason}`);
        }
      }
    }
  } else if (wantsEnhance) {
    fallbackReason = 'Session-д sokh_id байхгүй';
  }

  // ============================================================
  // Step 4 — Хэрэглээний бичлэг
  // ============================================================
  if (sokhId > 0) {
    await recordUsage({
      sokhId,
      kind: body.kind,
      layer,
      provider,
      success: true,
      metadata: { fallbackReason, source },
    }).catch(() => undefined);
  }

  if (adapterNotes && adapterNotes.length > 0) {
    warnings.push(...adapterNotes);
  }

  const result: AiGenerationResult = makeResult(finalOutput, layer, provider, {
    warnings: warnings.length > 0 ? warnings : undefined,
    fallbackReason,
  });

  return NextResponse.json({
    ...result,
    source, // adapter origin: real | demo | empty
    inputUsed: inputForTemplate, // зөвхөн debug-д ашиглана; AI-аас гарсан биш
  });
}

// ============================================================
// Текст талбаруудыг LLM-р дамжуулж сайжруулах
// ============================================================

async function enhanceTextFields(
  kind: AiKind,
  templateOutput: unknown,
  provider: { name: ProviderName; generateText: (p: string, o?: { maxTokens?: number }) => Promise<string> },
): Promise<{ ok: true; output: unknown } | { ok: false; error: string }> {
  try {
    switch (kind) {
      case 'debt_reminder': {
        const o = templateOutput as DebtReminderOutput;
        const fb = await enhanceWithAi({
          provider,
          text: o.facebookPost,
          instruction: 'Facebook group пост-ыг илүү уриалга, тодорхой, эелдэг өнгө аястай болго.',
          maxTokens: 600,
        });
        const formal = await enhanceWithAi({
          provider,
          text: o.formalNotice,
          instruction: 'Албан ёсны мэдэгдлийг хатуу боловч хүндэтгэлтэй, тодорхой бичих.',
          maxTokens: 600,
        });
        return {
          ok: true,
          output: {
            ...o,
            facebookPost: fb.ok ? fb.text : o.facebookPost,
            formalNotice: formal.ok ? formal.text : o.formalNotice,
          },
        };
      }
      case 'financial_report': {
        const o = templateOutput as FinancialReportOutput;
        const ex = await enhanceWithAi({
          provider,
          text: o.explanation,
          instruction:
            'Санхүүгийн тайлбарыг оршин суугчдад илүү ойлгомжтой, энгийн монгол хэлээр болго. Тоог өөрчилж болохгүй.',
          maxTokens: 600,
        });
        return {
          ok: true,
          output: {
            ...o,
            explanation: ex.ok ? ex.text : o.explanation,
          },
        };
      }
      case 'board_report': {
        const o = templateOutput as BoardReportOutput;
        const newSections = await Promise.all(
          o.sections.map(async (s) => {
            const enhanced = await enhanceWithAi({
              provider,
              text: s.body,
              instruction: `Зөвлөлд танилцуулах "${s.heading}" хэсгийг албан ёсны, тодорхой, нэг догол мөрд багтаах.`,
              maxTokens: 400,
            });
            return { ...s, body: enhanced.ok ? enhanced.text : s.body };
          }),
        );
        return { ok: true, output: { ...o, sections: newSections } };
      }
      case 'monthly_insight':
      case 'issue_insight':
        return { ok: true, output: templateOutput };
      default: {
        const _exhaustive: never = kind;
        void _exhaustive;
        return { ok: false, error: 'unknown kind' };
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'enhance err' };
  }
}

export type { AiKind };
