/**
 * Real token measurement for the unified context pipeline.
 * Uses local tiktoken for structure metrics; optionally Gemini for a live completion
 * when GEMINI_API_KEY is present (does not print secrets).
 *
 * Usage:
 *   npx tsx scripts/measure-context-pipeline-tokens.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { AgentTurnContextPipelineService } from '../src/services/AgentTurnContextPipelineService.js';
import { countMessagesTokens, countTokens } from '../src/utils/tokenCounter.js';
import {
  buildProgressiveExposure,
  PROGRESSIVE_TOOL_CATALOG_NAME,
} from '../src/runtime/agent/tools/ProgressiveToolExposure.js';
import type { ToolDefinition, ChatMessage } from '../src/providers/ILlmProvider.js';

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function fakeRegistry(count: number): Map<string, ToolDefinition> {
  const map = new Map<string, ToolDefinition>();
  const core = [
    'web_search',
    'get_datetime',
    'read_file',
    'list_directory',
    'capability_discovery',
    'plugin_suggest',
    'zavorth_action',
    'agent_manager',
  ];
  for (const name of core) {
    map.set(name, {
      name,
      description: `${name} capability`,
      category: 'core',
      dangerLevel: 'safe',
      requiresPermission: false,
      parameters: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: [],
      },
    });
  }
  for (let i = 0; i < count; i += 1) {
    const name = `long_tail_tool_${i}`;
    map.set(name, {
      name,
      description: `Long-tail tool ${i} for token bloat dryRun with a moderately long description of behavior and safety notes.`,
      category: 'long-tail',
      dangerLevel: 'safe',
      requiresPermission: false,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'payload' },
          path: { type: 'string', description: 'optional path' },
          mode: { type: 'string', description: 'optional mode' },
        },
        required: ['input'],
      },
    });
  }
  return map;
}

function estimateToolsTokens(tools: ToolDefinition[]): number {
  return tools.reduce((sum, tool) => {
    const blob = JSON.stringify({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });
    return sum + countTokens(blob);
  }, 0);
}

async function maybeGeminiSmoke(promptTokens: number): Promise<void> {
  const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!key) {
    console.log('Gemini live check: skipped (no GEMINI_API_KEY / GOOGLE_API_KEY)');
    return;
  }
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: 'Reply with exactly: ok',
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 8,
      temperature: 0,
    },
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json() as {
      error?: { message?: string };
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!response.ok) {
      console.log(`Gemini live check: HTTP ${response.status} (${String(data.error?.message || 'error').slice(0, 120)})`);
      return;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini live check: ok');
    console.log(`  model=${model}`);
    console.log(`  promptTokenCount=${data.usageMetadata?.promptTokenCount ?? 'n/a'}`);
    console.log(`  candidatesTokenCount=${data.usageMetadata?.candidatesTokenCount ?? 'n/a'}`);
    console.log(`  totalTokenCount=${data.usageMetadata?.totalTokenCount ?? 'n/a'}`);
    console.log(`  reply=${JSON.stringify(String(text).slice(0, 40))}`);
    console.log(`  local_prompt_estimate=${promptTokens}`);
  } catch (error) {
    console.log(`Gemini live check: failed (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function main(): Promise<void> {
  loadEnvFile(path.join(process.cwd(), '.env'));
  const registry = fakeRegistry(90);
  const fullTools = Array.from(registry.values());
  const progressive = buildProgressiveExposure({
    fullRegistry: registry,
    profile: 'daily-ops',
    brainToolNames: [
      'web_search',
      'get_datetime',
      'read_file',
      'list_directory',
      'capability_discovery',
      'plugin_suggest',
      'zavorth_action',
      'agent_manager',
    ],
    recommendedNames: ['read_file'],
    toCompact: (tool) => ({
      ...tool,
      metadata: { ...(tool.metadata || {}), lazyCompact: true },
      parameters: { type: 'object', properties: {}, required: [] },
    }),
    resolveName: (map, name) => (map.has(name) ? name : null),
  });

  const fullToolTokens = estimateToolsTokens(fullTools);
  const progressiveToolTokens = estimateToolsTokens(progressive.activeTools);

  const bulkyHistory: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You are Zavorth, a local-first governed runtime for AI agents.',
        'Stable policy block used as prompt-cache prefix.',
        'Use tools when they improve correctness. Never invent receipts.',
      ].join('\n'),
    },
  ];
  for (let i = 0; i < 10; i += 1) {
    bulkyHistory.push({ role: 'user', content: `Step ${i}: inspect file module_${i}.ts` });
    bulkyHistory.push({ role: 'assistant', content: `I will read module_${i}.ts` });
    bulkyHistory.push({
      role: 'tool',
      toolName: 'read_file',
      content: JSON.stringify({
        path: `src/module_${i}.ts`,
        lines: Array.from({ length: 80 }, (_, line) => `line ${line} content ${'z'.repeat(40)}`),
      }),
    });
  }
  bulkyHistory.push({
    role: 'user',
    content: 'Continue the inspection and summarize findings so far.',
  });

  const pipeline = new AgentTurnContextPipelineService();
  const beforeTokens = countMessagesTokens(
    bulkyHistory.map((message) => ({
      role: String(message.role),
      content: String(message.content || ''),
      toolName: message.toolName || null,
    })),
  );
  const compacted = pipeline.run({
    messages: bulkyHistory,
    userMessage: 'Continue the inspection and summarize findings so far.',
    usableContextTokens: 6_000,
    skipMemoryInject: true,
    skipConversationSummary: true,
    trivialTurn: false,
  });

  console.log('=== Zavorth context pipeline token measurement ===');
  console.log(`tools.full.count=${fullTools.length} tokens≈${fullToolTokens}`);
  console.log(
    `tools.progressive.count=${progressive.activeTools.length} tokens≈${progressiveToolTokens} catalog=${progressive.activeTools.some((tool) => tool.name === PROGRESSIVE_TOOL_CATALOG_NAME)}`,
  );
  console.log(
    `tools.savings≈${Math.max(0, fullToolTokens - progressiveToolTokens)} (${fullToolTokens > 0 ? Math.round((1 ? progressiveToolTokens / fullToolTokens) * 100) : 0}%)`,
  );
  console.log(`history.before≈${beforeTokens}`);
  console.log(
    `history.after≈${compacted.metrics.tokensAfter} saved≈${compacted.metrics.tokensSaved} mode=${compacted.metrics.compactionMode} triggered=${compacted.metrics.compactionTriggered}`,
  );
  console.log(
    `promptCache.stablePrefixChars=${compacted.metrics.promptCache.stablePrefixChars} variableSuffixChars=${compacted.metrics.promptCache.variableSuffixChars}`,
  );

  try {
    const { ProviderPromptCacheService, getProviderPromptCache } =
      await import('../src/services/llm/ProviderPromptCacheService.js');
    const { classifyAggressiveModelRoute } =
      await import('../src/services/llm/AggressiveModelRouter.js');
    const cache = getProviderPromptCache();
    const sampleMessages = [
      { role: 'system' as const, content: 'You are Zavorth. Stable system policy for cache measurement.' },
      { role: 'user' as const, content: 'oi' },
    ];
    const key = cache.buildKey({
      providerName: 'gemini',
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      messages: sampleMessages,
      tools: [],
    });
    cache.storeResponse({
      key: key.key,
      response: { content: 'Hello!', toolCalls: [], finishReason: 'stop' },
    });
    const hit = cache.lookup({
      providerName: 'gemini',
      modelName: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      messages: sampleMessages,
      tools: [],
    });
    console.log(
      `promptCache.local hit=${hit.hit} enabled=${ProviderPromptCacheService.isEnabled()} stats=${JSON.stringify(cache.getStats())}`,
    );
    const routes = [
      classifyAggressiveModelRoute({ userMessage: 'oi' }),
      classifyAggressiveModelRoute({ userMessage: 'Fix the TypeScript bug in index.ts' }),
      classifyAggressiveModelRoute({ userMessage: 'Refactor security architecture for production multi-file migration' }),
    ];
    console.log(
      `router.routes=${routes.map((route) => `${route.class}:${route.useFastModel ? 'fast' : 'normal'}`).join(',')}`,
    );
  } catch (error) {
    console.log(`promptCache/router measure soft-fail: ${error instanceof Error ? error.message : String(error)}`);
  }

  const systemText = String(compacted.messages.find((message) => message.role === 'system')?.content || '');
  await maybeGeminiSmoke(countTokens(systemText.slice(0, 2_000)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
