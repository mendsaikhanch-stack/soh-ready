'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AiSettings } from '@/app/lib/ai/settings';
import type { ProviderName } from '@/app/lib/ai/core';

// ============================================================
// /admin/ai/settings
// ============================================================
// СӨХ-ийн AI ашиглалтын тохиргоо. Default нь "AI disabled" — системийн
// үндсэн ажиллагаа AI-гүйгээр явна.

const PROVIDER_OPTIONS: Array<{
  value: ProviderName;
  label: string;
  envKey: string;
  description: string;
}> = [
  {
    value: 'template',
    label: 'Template (AI бус)',
    envKey: '—',
    description: 'AI шаардахгүй. Системийн үндсэн тогтсон template-уудыг ашиглана.',
  },
  {
    value: 'anthropic',
    label: 'Anthropic Claude',
    envKey: 'ANTHROPIC_API_KEY',
    description: 'Сэдвийн ойлголт, монгол хэлний натурал rewrite-д сайн.',
  },
  {
    value: 'openai',
    label: 'OpenAI GPT',
    envKey: 'OPENAI_API_KEY',
    description: 'Хямд, хурдан. Энгийн зар, мэдэгдэлд тохиромжтой.',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    description: 'Гүн ойлголт, баримт бичигт сайн.',
  },
];

export default function AdminAiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Татаж чадсангүй');
      setSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (
    p: Partial<Pick<AiSettings, 'ai_enabled' | 'ai_provider' | 'monthly_limit'>>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Хадгалж чадсангүй');
      setSettings(data.settings);
      setSavedAt(new Date().toLocaleTimeString('mn-MN'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Ачаалж байна...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error || 'Тохиргоо олдсонгүй'}</p>
      </div>
    );
  }

  const remaining = Math.max(0, settings.monthly_limit - settings.used_this_month);
  const usagePct =
    settings.monthly_limit > 0
      ? Math.min(100, Math.round((settings.used_this_month / settings.monthly_limit) * 100))
      : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <header className="mb-6">
        <Link href="/admin/ai" className="text-xs text-gray-500 hover:text-gray-900">
          ← AI Command Center
        </Link>
        <div className="flex items-center gap-2 mt-2 mb-2">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-bold">AI тохиргоо</h1>
        </div>
        <p className="text-sm text-gray-600">
          Энэхүү СӨХ дээр AI ашиглалт болон сарын квотыг тохируулна. Системийн үндсэн ажиллагаа AI-гүйгээр явж байгаа тул AI идэвхгүй ч бүх функц ажиллана.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Enabled toggle */}
      <section className="mb-6 border border-gray-200 bg-white rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-bold mb-1">AI ашиглалтыг идэвхжүүлэх</h2>
            <p className="text-sm text-gray-600">
              {'Идэвхтэй бол /admin/ai дотроос "AI-аар сайжруулах" сонголт боломжтой болно. Идэвхгүй бол бүх ажил Layer 1/2-аас гарна.'}
            </p>
          </div>
          <button
            onClick={() => patch({ ai_enabled: !settings.ai_enabled })}
            disabled={saving}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              settings.ai_enabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {settings.ai_enabled ? '✓ Идэвхтэй' : 'Идэвхгүй'}
          </button>
        </div>
      </section>

      {/* Provider */}
      <section className="mb-6 border border-gray-200 bg-white rounded-2xl p-5">
        <h2 className="font-bold mb-1">AI Provider</h2>
        <p className="text-sm text-gray-600 mb-4">
          Аль үйлчилгээ үзүүлэгчийг ашиглах вэ. <code>template</code> бол AI бус — системийн дотоод template.
        </p>
        <div className="space-y-2">
          {PROVIDER_OPTIONS.map((opt) => {
            const selected = settings.ai_provider === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  selected
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  checked={selected}
                  onChange={() => patch({ ai_provider: opt.value })}
                  disabled={saving}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <code className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      env: {opt.envKey}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Monthly limit */}
      <section className="mb-6 border border-gray-200 bg-white rounded-2xl p-5">
        <h2 className="font-bold mb-1">Сарын AI квот</h2>
        <p className="text-sm text-gray-600 mb-4">
          Layer 3 AI дуудлагын сарын дээд хязгаар. Хэтэрсэн бол автоматаар Layer 2-руу унана. <code>0</code> бол AI бүрэн хаагдсан.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Сарын хязгаар
            </label>
            <input
              type="number"
              min={0}
              value={settings.monthly_limit}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 0) {
                  setSettings({ ...settings, monthly_limit: n });
                }
              }}
              onBlur={() => patch({ monthly_limit: settings.monthly_limit })}
              disabled={saving}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Enter, эсвэл талбараас гарах үед хадгална.</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Энэ сард хэрэглэгдсэн</p>
            <p className="text-2xl font-bold">
              {settings.used_this_month}
              <span className="text-sm text-gray-400 font-normal"> / {settings.monthly_limit}</span>
            </p>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  usagePct < 70 ? 'bg-green-500' : usagePct < 90 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{remaining} дуудлага үлдсэн</p>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="border border-gray-200 bg-gray-50 rounded-2xl p-5 text-xs text-gray-600 space-y-1">
        <p>
          <strong>Период:</strong> {new Date(settings.period_started_at).toLocaleDateString('mn-MN')} -аас эхэлсэн
        </p>
        <p>
          <strong>Сүүлд шинэчилсэн:</strong>{' '}
          {new Date(settings.updated_at).toLocaleString('mn-MN')}
        </p>
        {savedAt && <p className="text-green-700">✓ Хадгалсан ({savedAt})</p>}
      </section>

      <div className="mt-6 border border-gray-200 bg-white rounded-2xl p-5">
        <h3 className="font-bold mb-2 text-sm">3-layer архитектур</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>
            <strong>Layer 1 — Rule engine.</strong> DB query, cron, тогтсон логик. AI шаардахгүй.
            {' '}
            {'Жишээ: "15-наас хойш төлбөр төлөөгүй айл" гэх scan.'}
          </li>
          <li>
            <strong>Layer 2 — Template generator.</strong> Placeholder-тэй template, өнгө аяс. AI шаардахгүй.
            Жишээ: сануулгын SMS, FB пост загвар.
          </li>
          <li>
            <strong>Layer 3 — AI enhancement.</strong> LLM провайдерээр текстийг сайжруулна. Сонголтоор.
            Алдаа гарвал автоматаар Layer 2-руу унана.
          </li>
        </ul>
      </div>
    </div>
  );
}
