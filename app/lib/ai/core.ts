// Khotol AI Core — 3-layer architecture
// ============================================================
// Архитектурын дүрэм:
//
//   Layer 1 — Rule Engine     (DB queries, cron, deterministic)
//   Layer 2 — Template Generator (placeholder + tone, no AI)
//   Layer 3 — Optional AI Enhancement (LLM, opt-in, quota-controlled)
//
// 1, 2 нь үргэлж ажилладаг. 3 нь зөвхөн ai_settings.ai_enabled = true
// болон сарын квот үлдсэн үед үргэлжилдэг. Хэрвээ Layer 3 алдаа гарвал
// автоматаар Layer 2-ийн гаралт буцна.
//
// АЮУЛГҮЙ БАЙДАЛ:
//   - AI хариу нь үргэлж "draft" төлөвтэй буцана
//   - Дугаар, өрийн дүн нь зөвхөн caller-аас өгсөн өгөгдлөөс гарч ирнэ
//   - Хариу буцаагч нь caller-ын responsibility — энэ модуль илгээхгүй

export type AiKind =
  | 'debt_reminder'
  | 'financial_report'
  | 'monthly_insight'
  | 'issue_insight'
  | 'board_report';

// Layer нь үр дүн аль шатнаас гарсныг харуулна. UI-д тэмдэглэгээ үзүүлэхэд
// ашиглагдана ("Template ашигласан draft" vs "AI ашиглан сайжруулсан").
export type OutputLayer = 'rule' | 'template' | 'ai_enhanced';

export type ProviderName = 'template' | 'anthropic' | 'openai' | 'gemini';

export interface AiGenerationRequest<TInput = unknown> {
  kind: AiKind;
  input: TInput;
  /** L3 (AI enhancement) хүсэх эсэх. Default false. */
  enhance?: boolean;
}

export interface AiGenerationResult<TOutput = unknown> {
  output: TOutput;
  layer: OutputLayer;
  provider: ProviderName;
  generatedAt: string; // ISO
  disclaimer: string;
  warnings?: string[];
  /** L3-ийг хүссэн боловч fallback хийгдсэн бол шалтгаан */
  fallbackReason?: string;
}

export interface AiProvider {
  name: ProviderName;
  /** Сэрхиз LLM хариу. Template provider нь стуб — caller буцалт ашиглахгүй. */
  generateText(prompt: string, options?: { maxTokens?: number }): Promise<string>;
}

// Бүх AI output-д хавсаргадаг анхааруулга
export const SAFETY_DISCLAIMER =
  'AI-ийн санал. Илгээхээс өмнө админ заавал шалгана уу. ' +
  'Санхүүгийн дугаарууд зөвхөн системийн баталгаажсан өгөгдлөөс гарна.';

// UI-д тэмдэглэгээ үзүүлэх
export function layerLabel(layer: OutputLayer): { text: string; emoji: string; cls: string } {
  switch (layer) {
    case 'ai_enhanced':
      return { text: 'AI ашиглан сайжруулсан', emoji: '🧠', cls: 'bg-purple-100 text-purple-700' };
    case 'template':
      return { text: 'Template ашигласан draft', emoji: '📝', cls: 'bg-blue-100 text-blue-700' };
    case 'rule':
      return { text: 'Дүрэмд суурилсан', emoji: '⚙️', cls: 'bg-gray-100 text-gray-700' };
  }
}

// ============================================================
// Layer 2 — Template provider (бүгдэд боломжтой fallback)
// ============================================================

export function templateProvider(): AiProvider {
  return {
    name: 'template',
    async generateText(prompt: string): Promise<string> {
      // Template provider шууд дуудагдахгүй — prompts/ дотор тус бүрийн
      // builder нь өөрийн deterministic output-ыг үүсгэдэг.
      return `[template] ${prompt.slice(0, 200)}`;
    },
  };
}

// ============================================================
// Layer 3 — Anthropic provider
// ============================================================
// Anthropic SDK-г import хийлгүй REST API-р шууд дуудна — package
// dependency нэмэхгүй.

function anthropicProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'anthropic',
    async generateText(prompt: string, options): Promise<string> {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (json.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n')
        .trim();
      if (!text) throw new Error('Anthropic returned empty content');
      return text;
    },
  };
}

// ============================================================
// Layer 3 — OpenAI provider (placeholder, no key wired)
// ============================================================

function openaiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'openai',
    async generateText(prompt: string, options): Promise<string> {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('OpenAI returned empty content');
      return text;
    },
  };
}

// ============================================================
// Layer 3 — Gemini provider (placeholder)
// ============================================================

function geminiProvider(apiKey: string, model: string): AiProvider {
  return {
    name: 'gemini',
    async generateText(prompt: string, options): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: options?.maxTokens ?? 1024 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown');
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (json.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();
      if (!text) throw new Error('Gemini returned empty content');
      return text;
    },
  };
}

// ============================================================
// Factory
// ============================================================
// Аль провайдерийг ашиглах вэ гэдгийг хүсэлт бүрд CALLER нь
// (per-СӨХ ai_settings-аас) шийднэ. Энэ функц нь env-ээс key байгаа эсэхийг
// л шалгана.

export function getProviderByName(name: ProviderName): AiProvider | null {
  switch (name) {
    case 'template':
      return templateProvider();
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      const model = process.env.KHOTOL_ANTHROPIC_MODEL || 'claude-sonnet-4-6';
      return key ? anthropicProvider(key, model) : null;
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      const model = process.env.KHOTOL_OPENAI_MODEL || 'gpt-4o-mini';
      return key ? openaiProvider(key, model) : null;
    }
    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      const model = process.env.KHOTOL_GEMINI_MODEL || 'gemini-1.5-flash';
      return key ? geminiProvider(key, model) : null;
    }
  }
}

export function isRealProvider(p: AiProvider): boolean {
  return p.name !== 'template';
}

// ============================================================
// Layer 3 — enhanceWithAi() helper
// ============================================================
// Layer 2-аас гарсан template текстийг LLM-р дамжуулж сайжруулна.
// Алдаа гарвал нэн даруу template-руу унана.

export interface EnhanceOptions {
  provider: AiProvider;
  /** Сайжруулах текст (Layer 2 output) */
  text: string;
  /** Хэрхэн сайжруулахыг тайлбарлах prompt prefix */
  instruction: string;
  /** Хариу хэдэн token-оор хязгаарлах */
  maxTokens?: number;
}

export interface EnhanceResult {
  text: string;
  ok: boolean;
  error?: string;
  promptTokens?: number;
  outputTokens?: number;
}

export async function enhanceWithAi(opts: EnhanceOptions): Promise<EnhanceResult> {
  const prompt = [
    opts.instruction,
    '',
    '=== Оригинал текст ===',
    opts.text,
    '',
    '=== Шаардлага ===',
    '- Анхны утга, мөнгөн дугаар, нэрийг өөрчилж болохгүй',
    '- Зөвхөн өгүүлбэрийн уртаашлал, ойлгомжтой байдлыг сайжруул',
    '- Шинэ тоо, факт зохиож нэмэх хориотой',
    '- Монгол хэлээр, тогтсон өнгө аястай',
  ].join('\n');

  try {
    const text = await opts.provider.generateText(prompt, {
      maxTokens: opts.maxTokens ?? 1024,
    });
    return { text, ok: true };
  } catch (err) {
    return {
      text: opts.text, // fallback to original
      ok: false,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

// ============================================================
// Result builder
// ============================================================

export function makeResult<T>(
  output: T,
  layer: OutputLayer,
  provider: ProviderName,
  extras?: { warnings?: string[]; fallbackReason?: string },
): AiGenerationResult<T> {
  return {
    output,
    layer,
    provider,
    generatedAt: new Date().toISOString(),
    disclaimer: SAFETY_DISCLAIMER,
    warnings: extras?.warnings,
    fallbackReason: extras?.fallbackReason,
  };
}

// ============================================================
// Мөнгөн дүн форматлагч (бүх prompt-д ашиглана)
// ============================================================

export function formatMnt(amount: number): string {
  if (!Number.isFinite(amount)) return '0₮';
  return new Intl.NumberFormat('mn-MN').format(Math.round(amount)) + '₮';
}

export function formatMonth(month: string): string {
  // "2026-04" → "2026 оны 4-р сар"
  const m = /^(\d{4})-(\d{1,2})$/.exec(month);
  if (!m) return month;
  return `${m[1]} оны ${parseInt(m[2], 10)}-р сар`;
}

// Legacy alias (өмнөх API-г хадгалах)
export function getAiProvider(): AiProvider {
  // Default: template (deterministic, key шаардлагагүй)
  const desired = (process.env.KHOTOL_AI_PROVIDER || 'template').toLowerCase() as ProviderName;
  if (desired === 'template') return templateProvider();
  const p = getProviderByName(desired);
  return p ?? templateProvider();
}
