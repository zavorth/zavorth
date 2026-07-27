/**
 * Product checks for turn-cost intent + model stack hop selection.
 *
 * 1) Multilingual free-text classification (structured-only vs LLM)
 * 2) ZAVORTH_TURN_COST_LLM=0 path
 * 3) Latency of classification hop
 * 4) How cheap/normal/strong maps when user has 1 vs N models/providers
 *
 * Usage: npx tsx scripts/measure-turn-cost-intent-and-stack.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  classifyTurnCostFromStructured,
  classifyTurnCostIntent,
} from '../src/services/llm/TurnCostIntentService.js';
import { classifyAggressiveModelRoute } from '../src/services/llm/AggressiveModelRouter.js';
import { resolveCheapUserStackHop } from '../src/services/llm/UserStackCostRoute.js';
import type { UserProviderSelection } from '../src/services/UserSelectionResolver.js';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const PHRASES = [
  { lang: 'pt', text: 'oi', expectSoft: 'background' },
  { lang: 'en', text: 'hello', expectSoft: 'background' },
  { lang: 'es', text: 'hola', expectSoft: 'background' },
  { lang: 'pt', text: 'thanks!', expectSoft: 'background' },
  { lang: 'en', text: 'thanks', expectSoft: 'background' },
  { lang: 'pt', text: 'liste os files da folder src', expectSoft: 'standard' },
  { lang: 'en', text: 'list files in the src folder', expectSoft: 'standard' },
  { lang: 'es', text: 'lista los archivos de la carpeta src', expectSoft: 'standard' },
  {
    lang: 'en',
    text: 'Refactor the security architecture across multi-file production migration with race conditions',
    expectSoft: 'premium',
  },
  {
    lang: 'pt',
    text: 'Redesign the production security architecture for a high-risk multi-module system',
    expectSoft: 'premium',
  },
] as const;

function selection(partial: Partial<UserProviderSelection> & Pick<UserProviderSelection, 'providerId'>): UserProviderSelection {
  return {
    providerId: partial.providerId,
    modelId: partial.modelId ?? null,
    secondaryModelId: partial.secondaryModelId ?? null,
    fallbackProviderIds: partial.fallbackProviderIds ?? [],
    source: partial.source ?? 'test',
  } as UserProviderSelection;
}

async function main(): Promise<void> {
  console.log('=== A) Structured-only (no free-text word match) ===');
  for (const p of PHRASES) {
    const d = classifyTurnCostFromStructured({ userMessage: p.text });
    console.log(
      `  [${p.lang}] "${p.text.slice(0, 48)}" -> class=${d.class} source=${d.source} (expect~${p.expectSoft})`
    );
  }

  console.log('\n=== B) Structured signals (same for any language) ===');
  const cases = [
    { label: 'useFastModel', input: { userMessage: 'any text', metadata: { useFastModel: true } } },
    { label: 'forceStrong', input: { userMessage: 'any text', forceStrong: true } },
    { label: 'effort high', input: { userMessage: 'any text', effortLevel: 'high' } },
    { label: 'taskKind architecture', input: { userMessage: 'any text', taskKind: 'architecture' } },
    { label: 'empty', input: { userMessage: '' } },
  ];
  for (const c of cases) {
    const d = classifyTurnCostFromStructured(c.input);
    console.log(`  ${c.label} -> ${d.class} (${d.source})`);
  }

  console.log('\n=== C) ZAVORTH_TURN_COST_LLM=0 (async should match structured) ===');
  process.env.ZAVORTH_TURN_COST_LLM = '0';
  const offStart = Date.now();
  const off = await classifyTurnCostIntent({ userMessage: 'oi', allowLlm: true });
  const offMs = Date.now() - offStart;
  console.log(`  "hello" with LLM off -> class=${off.class} source=${off.source} latencyMs=${offMs}`);

  console.log('\n=== D) LLM semantic classification (if provider available) ===');
  process.env.ZAVORTH_TURN_COST_LLM = '1';
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY);
  console.log(`  geminiKeyPresent=${hasGemini}`);

  let llmProvider: { chat: (m: Array<{ role: string; content: string }>) => Promise<{ content?: string | null }> } | null = null;
  try {
    const { GoogleGenAiProviderAdapter } =
      await import('../src/adapters/providers/GoogleGenAiProviderAdapter.js');
    const adapter = new GoogleGenAiProviderAdapter();
    if (adapter.isConfigured()) {
      llmProvider = adapter as any;
      console.log('  provider=GoogleGenAi (configured)');
    } else {
      console.log('  provider=GoogleGenAi (NOT configured)');
    }
  } catch (error) {
    console.log(`  provider load failed: ${String((error as Error)?.message || error)}`);
  }

  const llmRows: Array<{ lang: string; text: string; class: string; source: string; ms: number; ok: boolean }> = [];
  if (llmProvider) {
    for (const p of PHRASES) {
      const t0 = Date.now();
      const d = await classifyTurnCostIntent({
        userMessage: p.text,
        allowLlm: true,
        provider: llmProvider as any,
        // Prefer background hop for classification (same as production resolver).
        modelName:
          process.env.ZAVORTH_TURN_COST_MODEL
          || process.env.ZAVORTH_BACKGROUND_MODEL
          || process.env.ZAVORTH_SECONDARY_MODEL
          || process.env.GEMINI_MODEL
          || 'gemini-2.5-flash',
      });
      const ms = Date.now() - t0;
      const ok =
        p.expectSoft === 'background'
          ? d.class === 'background'
          : p.expectSoft === 'premium'
            ? d.class === 'premium' || d.class === 'standard'
            : d.class === 'standard' || d.class === 'premium';
      llmRows.push({ lang: p.lang, text: p.text, class: d.class, source: d.source, ms, ok });
      console.log(
        `  [${p.lang}] "${p.text.slice(0, 40)}" -> ${d.class} source=${d.source} conf~ ms=${ms} match~${ok ? 'Y' : 'N'} reason=${d.reason.slice(0, 80)}`,
      );
      // light pacing to avoid provider rate blips during batch measurement
      await new Promise((r) => setTimeout(r, 250));
    }
    const avg = llmRows.reduce((s, r) => s + r.ms, 0) / Math.max(1, llmRows.length);
    const hit = llmRows.filter((r) => r.ok).length;
    console.log(`\n  LLM hop summary: avgLatencyMs=${avg.toFixed(0)} hits=${hit}/${llmRows.length}`);
  } else {
    console.log('  SKIPPED live LLM (no configured provider)');
  }

  console.log('\n=== E) Cheap hop selection by user stack shape ===');
  const stacks: Array<{ label: string; sel: UserProviderSelection; env?: NodeJS.ProcessEnv }> = [
    {
      label: '1 provider + 1 model only',
      sel: selection({ providerId: 'gemini', modelId: 'gemini-2.5-flash', fallbackProviderIds: [] }),
    },
    {
      label: '1 provider + secondary model',
      sel: selection({
        providerId: 'gemini',
        modelId: 'gemini-2.5-pro',
        secondaryModelId: 'gemini-2.5-flash',
        fallbackProviderIds: [],
      }),
    },
    {
      label: 'multi provider fallbacks',
      sel: selection({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4',
        secondaryModelId: null,
        fallbackProviderIds: ['gemini:gemini-2.5-flash', 'openai:gpt-4o-mini', 'ollama:llama3.2'],
      }),
    },
    {
      label: 'env ZAVORTH_BACKGROUND_MODEL on stack',
      sel: selection({
        providerId: 'gemini',
        modelId: 'gemini-2.5-pro',
        secondaryModelId: 'gemini-2.5-flash',
        fallbackProviderIds: [],
      }),
      env: {
        ...process.env,
        ZAVORTH_BACKGROUND_MODEL: 'gemini-2.5-flash',
        ZAVORTH_BACKGROUND_PROVIDER: 'gemini',
      },
    },
  ];

  for (const s of stacks) {
    const cheap = resolveCheapUserStackHop({ selection: s.sel, env: s.env || process.env });
    const routeBg = classifyAggressiveModelRoute({
      userMessage: 'oi',
      preclassified: {
        class: 'background',
        trivialTurn: true,
        useFastModel: true,
        forceStrong: false,
        reason: 'test',
        source: 'llm',
        confidence: 0.9,
      },
      userModelPinned: false,
    });
    // Re-resolve cheap using same selection via monkey by calling resolveCheap again - router uses process env stack.
    // Report both stack pick and what background route would suggest if stack had that hop.
    console.log(`  ${s.label}`);
    console.log(`    cheapHop: ${cheap.providerName || '-'}/${cheap.modelName || '-'} source=${cheap.source}`);
    console.log(`    reason: ${cheap.reason}`);
    console.log(
      `    backgroundRoute.useFastModel=${routeBg.useFastModel} suggested=${routeBg.suggestedProviderName || '-'}/${routeBg.suggestedModelName || '-'} hopSource=${routeBg.hopSource || '-'}`,
    );
  }

  console.log('\\n=== F) End-to-end class -> model suggestion (live stack from env) ===');
  for (const label of ['background', 'standard', 'premium'] as const) {
    const pre = {
      class: label,
      trivialTurn: label === 'background',
      useFastModel: label === 'background',
      forceStrong: label === 'premium',
      reason: `forced ${label}`,
      source: 'structured' as const,
      confidence: 1,
    };
    const r = classifyAggressiveModelRoute({
      userMessage: 'x',
      preclassified: pre,
      userModelPinned: false,
    });
    console.log(
      `  class=${label} -> useFast=${r.useFastModel} forceStrong=${r.forceStrong} suggest=${r.suggestedProviderName || 'none'}/${r.suggestedModelName || 'none'} hop=${r.hopSource || 'n/a'}`,
    );
  }

  console.log('\nDONE');
}

main().catch((error) => {
  console.error('FATAL', error);
  process.exitCode = 1;
});
