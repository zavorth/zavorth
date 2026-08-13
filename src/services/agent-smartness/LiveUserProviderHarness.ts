import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';
import { ZavorthI18nService } from '../../i18n/ZavorthI18nService.js';
import { LlmRuntimeService, type LlmRuntimeResult } from '../llm/LlmRuntimeService.js';
import { resolveUserProviderSelection, type UserProviderSelection } from '../UserSelectionResolver.js';
import {
  DEFAULT_LIVE_PROVIDER_MODELS as DEFAULT_MODELS,
  liveProviderFamilyFromId as familyFromProviderId,
  resolveLiveCredentials,
  type LiveProviderFamily,
  type ResolvedLiveCredentials,
} from './LiveProviderCredentials.js';
import {
  extractAnthropicText,
  extractAnthropicToolUse,
  extractGeminiFunctionCall,
  extractGeminiText,
  extractOpenAiText,
  extractOpenAiToolCall,
  multiStepTextPasses,
} from './LiveProviderResponseParsers.js';

export {
  resolveLiveCredentials,
  type LiveProviderFamily,
  type ResolvedLiveCredentials,
} from './LiveProviderCredentials.js';

export const LIVE_PROBE_TOKEN = 'ZAVORTH_LIVE_OK';
export const LIVE_MULTI_STEP_TOKEN = 'ZAVORTH_LIVE_MS_OK';

export type LiveHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

export type LiveHttpResponse = {
  status: number;
  body: string;
};

export type LiveHttpTransport = (req: LiveHttpRequest) => Promise<LiveHttpResponse>;
type LiveLlmRuntime = Pick<LlmRuntimeService, 'chatDetailed'>;

export type LiveHarnessResult = {
  status: 'pass' | 'fail' | 'blocked';
  notes: string;
  evidence: Record<string, unknown>;
};

function defaultTransport(req: LiveHttpRequest): Promise<LiveHttpResponse> {
  return new Promise((resolve) => {
    const lib = req.url.startsWith('https') ? https : http;
    const request = lib.request(
      req.url,
      {
        method: req.method || 'GET',
        headers: req.headers || {},
        timeout: req.timeoutMs || 45000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    request.on('error', (error) => resolve({ status: 0, body: error.message }));
    request.on('timeout', () => {
      request.destroy();
      resolve({ status: 0, body: 'timeout' });
    });
    if (req.body) request.write(req.body);
    request.end();
  });
}


function redact(text: string): string {
  return text
    .replace(/key=[^&\s"']+/gi, 'key=REDACTED')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer REDACTED')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-REDACTED')
    .replace(/AIza[0-9A-Za-z_-]+/g, 'AIzaREDACTED')
    .replace(/x-api-key["\s:=]+[^\s"',}]+/gi, 'x-api-key=REDACTED')
    .slice(0, 500);
}

/** Detect 429 / quota / rate-limit signals so notes recommend alternate provider, not greenwash. */
export function looksLikeRateLimit(text: string | number | null | undefined): boolean {
  const s = String(text ?? '');
  return (
    /\b429\b/.test(s)
    || /too many requests/i.test(s)
    || /RESOURCE_EXHAUSTED/i.test(s)
    || /rate[- ]?limit/i.test(s)
    || /quota exceeded/i.test(s)
    || /exceeded your current quota/i.test(s)
  );
}

/** Model id missing / not supported — try next fallback model, not hard-fail the whole family. */
export function looksLikeModelNotFound(body: string, status?: number): boolean {
  const s = String(body || '');
  return (
    status === 404
    || /model[s]?\/[^\s"]+\s+is not found/i.test(s)
    || /not found for API version/i.test(s)
    || /does not exist|model_not_found|not supported for generateContent/i.test(s)
  );
}

/** Parse provider "retry in N.Ns" hints (Gemini free tier). Caps at 90s. */
export function parseRetryAfterMs(body: string, status?: number): number {
  const m = String(body || '').match(/retry in\s+([\d.]+)\s*s/i);
  if (m) {
    const sec = Number(m[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return Math.min(Math.ceil(sec * 1000) + 300, 90_000);
    }
  }
  if (status === 429 || looksLikeRateLimit(body)) return 0;
  return 0;
}

const RATE_LIMIT_BACKOFF_MS = [2_000, 5_000, 12_000] as const;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Gemini keys: primary + GEMINI_API_KEY_2.._7 (only non-empty ≥12 chars). */
export function listGeminiApiKeys(env: NodeJS.ProcessEnv): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const candidates = [
    env.GEMINI_API_KEY,
    env.GOOGLE_API_KEY,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
    env.GEMINI_API_KEY_4,
    env.GEMINI_API_KEY_5,
    env.GEMINI_API_KEY_6,
    env.GEMINI_API_KEY_7,
  ];
  for (const raw of candidates) {
    const key = String(raw || '').trim();
    if (key.length < 12 || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Same-family model fallbacks after rate-limit exhaustion (never invents other vendors). */
export function listModelFallbacks(
  family: LiveProviderFamily,
  preferredModel: string | null | undefined,
): string[] {
  const preferred = String(preferredModel || DEFAULT_MODELS[family]).trim();
  const pool: Record<LiveProviderFamily, string[]> = {
    // Prefer current free-tier flash ids; avoid retired 1.5-flash (404 on v1beta).
    gemini: [preferred, 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
    openai: [preferred, 'gpt-4o-mini', 'gpt-4o'],
    anthropic: [preferred, 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
  };
  const out: string[] = [];
  const seen = new Set<string>();
  for (const model of pool[family]) {
    const id = String(model || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function multiStepNoToolNotes(providerLabel: string, body: string, status?: number): {
  notes: string;
  rateLimited: boolean;
} {
  const rateLimited = looksLikeRateLimit(body) || status === 429;
  return {
    rateLimited,
    notes: rateLimited ? `Multi-step round 1 failed: rate limited / quota exhausted (429) on ${providerLabel}. Retry with an alternate provider or API key — do not treat as multi-step pass.`
      : `Multi-step round 1 did not produce a tool call (${providerLabel}).`,
  };
}

function exactProbeToken(text: string): boolean {
  return String(text || '').trim() === LIVE_PROBE_TOKEN;
}

export class LiveUserProviderHarness {
  private readonly i18n: ZavorthI18nService;

  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      transport?: LiveHttpTransport;
      runtimeFactory?: (providerId: string) => LiveLlmRuntime;
      /** Injectable sleep for hermetic rate-limit retry tests. */
      sleep?: (ms: number) => Promise<void>;
      /** Max 429 retries per HTTP call (default 3). */
      maxRateLimitRetries?: number;
      /** When true (default), try same-family alternate models after rate-limit exhaustion. */
      enableModelFallbackOnRateLimit?: boolean;
    } = {},
  ) {
    this.i18n = new ZavorthI18nService();
    this.i18n.setLocale(this.i18n.resolveFromSource({ env: this.options.env || process.env }));
  }

  private transport(): LiveHttpTransport {
    return this.options.transport || defaultTransport;
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    const sleeper = this.options.sleep || defaultSleep;
    await sleeper(ms);
  }

  private maxRateLimitRetries(): number {
    const n = this.options.maxRateLimitRetries;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.min(Math.floor(n), 6);
    return RATE_LIMIT_BACKOFF_MS.length;
  }

  /**
   * HTTP with rate-limit retries. Honors "retry in Ns" when present; otherwise exponential backoff.
   * Does not invent success — exhausted 429 still returns the last response.
   */
  private async requestWithRateLimitRetry(
    req: LiveHttpRequest,
  ): Promise<LiveHttpResponse & { rateLimitRetries: number }> {
    const max = this.maxRateLimitRetries();
    let last: LiveHttpResponse = { status: 0, body: 'no response' };
    let rateLimitRetries = 0;
    for (let attempt = 0; attempt <= max; attempt += 1) {
      last = await this.transport()(req);
      const limited = last.status === 429 || looksLikeRateLimit(last.body);
      if (!limited) {
        return { ...last, rateLimitRetries };
      }
      if (attempt >= max) {
        return { ...last, rateLimitRetries };
      }
      const hinted = parseRetryAfterMs(last.body, last.status);
      const backoff = hinted > 0
        ? hinted
        : RATE_LIMIT_BACKOFF_MS[Math.min(attempt, RATE_LIMIT_BACKOFF_MS.length - 1)];
      rateLimitRetries += 1;
      await this.sleep(backoff);
    }
    return { ...last, rateLimitRetries };
  }

  public resolveCredentials(): ResolvedLiveCredentials {
    return resolveLiveCredentials({
      projectRoot: this.options.projectRoot,
      env: this.options.env,
    });
  }

  public async runProbe(): Promise<LiveHarnessResult> {
    const selection = this.resolveSelection();
    if (selection.providerId && !familyFromProviderId(selection.providerId) && !this.options.transport) {
      return this.runRuntimeProbe(selection);
    }
    const creds = this.resolveCredentials();
    if (!creds.apiKey) {
      return {
        status: 'blocked',
        notes: creds.reason || 'No live credentials.',
        evidence: {
          providerId: creds.providerId,
          credentialSource: creds.credentialSource,
          configured: creds.selection.configured,
        },
      };
    }
    if (!creds.family) {
      return {
        status: 'blocked',
        notes: creds.reason || 'No supported live provider family selected.',
        evidence: { providerId: creds.providerId, configured: creds.selection.configured },
      };
    }

    try {
      if (creds.family === 'gemini') return await this.probeGemini(creds);
      if (creds.family === 'openai') return await this.probeOpenAi(creds);
      return await this.probeAnthropic(creds);
    } catch (error) {
      return {
        status: 'fail',
        notes: error instanceof Error ? error.message : String(error),
        evidence: { providerId: creds.providerId, family: creds.family },
      };
    }
  }

  public async runMultiStepToolPlan(): Promise<LiveHarnessResult> {
    const selection = this.resolveSelection();
    if (selection.providerId && !familyFromProviderId(selection.providerId) && !this.options.transport) {
      return this.runRuntimeMultiStep(selection);
    }
    const creds = this.resolveCredentials();
    if (!creds.apiKey) {
      return {
        status: 'blocked',
        notes: creds.reason || 'No live credentials for multi-step harness.',
        evidence: {
          providerId: creds.providerId,
          credentialSource: creds.credentialSource,
          configured: creds.selection.configured,
        },
      };
    }
    if (!creds.family) {
      return {
        status: 'blocked',
        notes: creds.reason || 'No supported live provider family selected.',
        evidence: { providerId: creds.providerId, configured: creds.selection.configured },
      };
    }

    const root = this.options.projectRoot || process.cwd();
    const marker = `MS-${crypto.randomBytes(6).toString('hex')}`;
    const markerDir = path.join(root, 'data', 'runtime');
    const markerPath = path.join(markerDir, 'live-multi-step-marker.txt');
    fs.mkdirSync(markerDir, { recursive: true });
    fs.writeFileSync(markerPath, marker, 'utf8');

    const toolResult = () => {
      try {
        return fs.readFileSync(markerPath, 'utf8').trim();
      } catch {
        return '';
      }
    };

    try {
      if (creds.family === 'gemini') {
        return await this.multiStepGemini(creds, marker, toolResult);
      }
      if (creds.family === 'openai') {
        return await this.multiStepOpenAi(creds, marker, toolResult);
      }
      return await this.multiStepAnthropic(creds, marker, toolResult);
    } catch (error) {
      return {
        status: 'fail',
        notes: error instanceof Error ? error.message : String(error),
        evidence: {
          providerId: creds.providerId,
          family: creds.family,
          autoCertified: false,
        },
      };
    }
  }

  private resolveSelection(): UserProviderSelection {
    return resolveUserProviderSelection({
      projectRoot: this.options.projectRoot,
      env: this.options.env,
    });
  }

  private runtime(providerId: string): LiveLlmRuntime {
    return this.options.runtimeFactory?.(providerId) || new LlmRuntimeService(providerId);
  }

  private async runRuntimeProbe(selection: UserProviderSelection): Promise<LiveHarnessResult> {
    const providerId = String(selection.providerId || '').trim();
    if (!providerId) return this.blockedRuntimeResult(selection, this.t('no_selected_provider', 'No user-selected provider.'));
    try {
      const result = await this.runtime(providerId).chatDetailed([
        { role: 'user', content: `Reply with exactly ${LIVE_PROBE_TOKEN} and nothing else.` },
      ], [], {
        providerName: providerId,
        ...(selection.modelId ? { modelName: selection.modelId } : {}),
        allowFallback: false,
      });
      const exact = String(result.response.content || '').trim() === LIVE_PROBE_TOKEN;
      return {
        status: exact ? 'pass' : 'fail',
        notes: exact
          ? this.t('runtime_probe_pass', 'Live {provider} probe passed through the production LLM runtime.', { provider: providerId })
          : this.t('runtime_probe_token_mismatch', 'Provider {provider} replied, but did not return the exact certification token.', { provider: providerId }),
        evidence: this.runtimeEvidence(result, { exactToken: exact, runtimePath: true }),
      };
    } catch (error) {
      return this.runtimeFailure(selection, error, 'probe');
    }
  }

  private async runRuntimeMultiStep(selection: UserProviderSelection): Promise<LiveHarnessResult> {
    const providerId = String(selection.providerId || '').trim();
    if (!providerId) return this.blockedRuntimeResult(selection, this.t('no_selected_provider', 'No user-selected provider.'));
    const marker = `MS-${crypto.randomBytes(6).toString('hex')}`;
    const tools: ToolDefinition[] = [{
      name: 'zavorth_live_marker',
      description: 'Return a deterministic, read-only certification marker.',
      category: 'read-only',
      dangerLevel: 'safe',
      requiresPermission: false,
      parameters: { type: 'object', properties: {}, required: [] },
    }];
    const messages: ChatMessage[] = [{
      role: 'user',
      content:
        `Call zavorth_live_marker exactly once. After receiving its result, reply exactly: ${LIVE_MULTI_STEP_TOKEN} followed by the marker value from the tool result (nothing else).`,
    }];
    const options = {
      providerName: providerId,
      ...(selection.modelId ? { modelName: selection.modelId } : {}),
      allowFallback: false,
      toolPolicy: {
        requestedTools: ['zavorth_live_marker'],
        approvedToolIds: ['zavorth_live_marker'],
        approvalGranted: true,
        exposedTools: [{ id: 'zavorth_live_marker', risk: 'safe', requiresApproval: false }],
      },
    };
    try {
      const runtime = this.runtime(providerId);
      const first = await runtime.chatDetailed(messages, tools, options);
      const toolCall = first.response.toolCalls?.find((call) => call.name === 'zavorth_live_marker');
      if (!toolCall) {
        return {
          status: 'fail',
          notes: this.t('runtime_tool_missing', 'Provider {provider} did not issue the required tool call.', { provider: providerId }),
          evidence: this.runtimeEvidence(first, { runtimePath: true, toolCallObserved: false, autoCertified: false }),
        };
      }
      messages.push({ role: 'assistant', content: first.response.content || '', toolCalls: first.response.toolCalls });
      messages.push({
        role: 'tool',
        content: JSON.stringify({ marker, readOnly: true }),
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      });
      let second = await runtime.chatDetailed(messages, tools, options);
      let finalText = String(second.response.content || '');
      if (!multiStepTextPasses(finalText, marker)) {
        messages.push({ role: 'assistant', content: finalText || '(empty)' });
        messages.push({
          role: 'user',
          content: `Read the marker from the tool result only. Reply with exactly: ${LIVE_MULTI_STEP_TOKEN} and that marker value.`,
        });
        second = await runtime.chatDetailed(messages, tools, options);
        finalText = String(second.response.content || '');
      }
      const exact = multiStepTextPasses(finalText, marker);
      return {
        status: exact ? 'pass' : 'fail',
        notes: exact
          ? this.t('runtime_multi_pass', 'Live multi-step tool round passed through the production runtime with {provider}.', { provider: providerId })
          : this.t('runtime_multi_token_mismatch', 'Provider {provider} completed a tool round but missed the exact final token.', { provider: providerId }),
        evidence: this.runtimeEvidence(second, {
          runtimePath: true,
          autoCertified: exact,
          toolCallObserved: true,
          toolName: toolCall.name,
          toolRounds: 2,
          marker,
        }),
      };
    } catch (error) {
      return this.runtimeFailure(selection, error, 'multi-step');
    }
  }

  private runtimeEvidence(result: LlmRuntimeResult, extra: Record<string, unknown>): Record<string, unknown> {
    return {
      providerId: result.providerName,
      modelId: result.modelName,
      fallbackUsed: result.route.fallbackUsed,
      attempts: result.route.attempts.map((attempt) => ({
        providerName: attempt.providerName,
        status: attempt.status,
        fallback: attempt.fallback,
        durationMs: attempt.durationMs,
      })),
      ...extra,
    };
  }

  private blockedRuntimeResult(selection: UserProviderSelection, notes: string): LiveHarnessResult {
    return {
      status: 'blocked',
      notes,
      evidence: { providerId: selection.providerId, configured: selection.configured, runtimePath: true },
    };
  }

  private runtimeFailure(selection: UserProviderSelection, error: unknown, stage: string): LiveHarnessResult {
    const message = error instanceof Error ? error.message : String(error);
    const missingConfiguration = hasAnyLowercaseFragment(message, ['api key', 'credential', 'not configured', 'not available', 'unavailable', 'no provider']);
    const rateLimited = looksLikeRateLimit(message);
    const base = this.t('runtime_failure', '{stage} via production runtime: {message}', {
      stage,
      message: redact(message),
    });
    const notes = rateLimited ? `${base} Rate limited / quota exhausted (429). Retry with an alternate provider or API key — do not treat as multi-step pass.`
      : base;
    return {
      status: missingConfiguration ? 'blocked' : 'fail',
      notes,
      evidence: {
        providerId: selection.providerId,
        configured: selection.configured,
        runtimePath: true,
        stage,
        rateLimited,
      },
    };
  }

  private t(key: string, fallback: string, vars?: Record<string, string>): string {
    return this.i18n.t(`services.live_smartness.${key}`, { fallback, vars });
  }

  private async probeGemini(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    const env = this.options.env || process.env;
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('gemini', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.gemini];
    const keys = listGeminiApiKeys(env);
    const keyList = keys.length ? keys : (creds.apiKey ? [creds.apiKey] : []);
    if (!keyList.length) {
      return {
        status: 'blocked',
        notes: 'No Gemini API key configured for live probe.',
        evidence: { family: 'gemini', providerId: creds.providerId },
      };
    }

    let lastStatus = 0;
    let lastBody = '';
    let totalRetries = 0;
    let modelUsed = models[0];
    let keyIndex = 0;
    let rateLimited = false;

    for (let ki = 0; ki < keyList.length; ki += 1) {
      const apiKey = keyList[ki];
      for (let mi = 0; mi < models.length; mi += 1) {
        const model = models[mi];
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const res = await this.requestWithRateLimitRetry({
          url,
          method: 'POST',
          // Keep credentials out of URLs so proxies, access logs, and error traces
          // cannot persist the Gemini key as part of the request target.
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }] }],
            generationConfig: { maxOutputTokens: 64, temperature: 0 },
          }),
          timeoutMs: 45000,
        });
        lastStatus = res.status;
        lastBody = res.body;
        totalRetries += res.rateLimitRetries;
        modelUsed = model;
        keyIndex = ki;
        const text = extractGeminiText(res.body);
        const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
        if (exact) {
          const modelFallbackUsed = model !== (creds.modelId || DEFAULT_MODELS.gemini);
          const keyRotated = ki > 0;
          return {
            status: 'pass',
            notes: `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
              + (modelFallbackUsed ? ` (model fallback → ${model})` : '')
              + (keyRotated ? ` (gemini key slot ${ki + 1})` : ''),
            evidence: {
              family: 'gemini',
              providerId: creds.providerId,
              model,
              requestedModel: creds.modelId || DEFAULT_MODELS.gemini,
              modelFallbackUsed,
              keyRotated,
              geminiKeySlot: ki + 1,
              rateLimitRetries: totalRetries,
              exactToken: true,
              credentialSource: creds.credentialSource,
            },
          };
        }
        rateLimited = res.status === 429 || looksLikeRateLimit(res.body);
        const modelMissing = looksLikeModelNotFound(res.body, res.status);
        // Auth / hard errors stop cascade; 404 model-not-found tries next model.
        if (!rateLimited && !modelMissing) {
          if (mi === 0 && ki === 0) break;
          break;
        }
      }
      if (!rateLimited && !looksLikeModelNotFound(lastBody, lastStatus)) break;
    }

    return {
      status: 'fail',
      notes: rateLimited ? `Gemini probe rate-limited/quota exhausted after retries (status=${lastStatus}). Try another provider key or wait.`
        : `Gemini probe failed status=${lastStatus}`,
      evidence: {
        family: 'gemini',
        providerId: creds.providerId,
        model: modelUsed,
        rateLimited,
        rateLimitRetries: totalRetries,
        geminiKeySlot: keyIndex + 1,
        credentialSource: creds.credentialSource,
        outputPreview: redact(lastBody),
      },
    };
  }

  private async probeOpenAi(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('openai', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.openai];
    let lastStatus = 0;
    let lastBody = '';
    let totalRetries = 0;
    let modelUsed = models[0];
    let rateLimited = false;

    for (const model of models) {
      const res = await this.requestWithRateLimitRetry({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }],
          max_tokens: 32,
          temperature: 0,
        }),
        timeoutMs: 45000,
      });
      lastStatus = res.status;
      lastBody = res.body;
      totalRetries += res.rateLimitRetries;
      modelUsed = model;
      const text = extractOpenAiText(res.body);
      const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
      if (exact) {
        const modelFallbackUsed = model !== (creds.modelId || DEFAULT_MODELS.openai);
        return {
          status: 'pass',
          notes: `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
            + (modelFallbackUsed ? ` (model fallback → ${model})` : ''),
          evidence: {
            family: 'openai',
            providerId: creds.providerId,
            model,
            requestedModel: creds.modelId || DEFAULT_MODELS.openai,
            modelFallbackUsed,
            rateLimitRetries: totalRetries,
            exactToken: true,
            credentialSource: creds.credentialSource,
          },
        };
      }
      rateLimited = res.status === 429 || looksLikeRateLimit(res.body);
      if (!rateLimited) break;
    }

    return {
      status: 'fail',
      notes: rateLimited ? `OpenAI probe rate-limited after retries (status=${lastStatus}).`
        : `OpenAI probe failed status=${lastStatus}`,
      evidence: {
        family: 'openai',
        providerId: creds.providerId,
        model: modelUsed,
        rateLimited,
        rateLimitRetries: totalRetries,
        credentialSource: creds.credentialSource,
        outputPreview: redact(lastBody),
      },
    };
  }

  private async probeAnthropic(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('anthropic', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.anthropic];
    let lastStatus = 0;
    let lastBody = '';
    let totalRetries = 0;
    let modelUsed = models[0];
    let rateLimited = false;

    for (const model of models) {
      const res = await this.requestWithRateLimitRetry({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': creds.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 32,
          temperature: 0,
          messages: [{ role: 'user', content: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }],
        }),
        timeoutMs: 45000,
      });
      lastStatus = res.status;
      lastBody = res.body;
      totalRetries += res.rateLimitRetries;
      modelUsed = model;
      const text = extractAnthropicText(res.body);
      const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
      if (exact) {
        const modelFallbackUsed = model !== (creds.modelId || DEFAULT_MODELS.anthropic);
        return {
          status: 'pass',
          notes: `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
            + (modelFallbackUsed ? ` (model fallback → ${model})` : ''),
          evidence: {
            family: 'anthropic',
            providerId: creds.providerId,
            model,
            requestedModel: creds.modelId || DEFAULT_MODELS.anthropic,
            modelFallbackUsed,
            rateLimitRetries: totalRetries,
            exactToken: true,
            credentialSource: creds.credentialSource,
          },
        };
      }
      rateLimited = res.status === 429 || looksLikeRateLimit(res.body);
      if (!rateLimited) break;
    }

    return {
      status: 'fail',
      notes: rateLimited ? `Anthropic probe rate-limited after retries (status=${lastStatus}).`
        : `Anthropic probe failed status=${lastStatus}`,
      evidence: {
        family: 'anthropic',
        providerId: creds.providerId,
        model: modelUsed,
        rateLimited,
        rateLimitRetries: totalRetries,
        credentialSource: creds.credentialSource,
        outputPreview: redact(lastBody),
      },
    };
  }

  private async multiStepGemini(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const env = this.options.env || process.env;
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('gemini', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.gemini];
    const keys = listGeminiApiKeys(env);
    const keyList = keys.length ? keys : (creds.apiKey ? [creds.apiKey] : []);
    const toolDecl = {
      functionDeclarations: [{
        name: 'zavorth_live_marker',
        description: 'Read the live multi-step workspace marker. Call this before answering.',
        parameters: { type: 'object', properties: {} },
      }],
    };
    const userText =
      'You must call the tool zavorth_live_marker first. '
      + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`;

    let lastFail: LiveHarnessResult | null = null;
    let totalRetries = 0;

    for (let ki = 0; ki < keyList.length; ki += 1) {
      const apiKey = keyList[ki];
      for (let mi = 0; mi < models.length; mi += 1) {
        const model = models[mi];
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

        const round1 = await this.requestWithRateLimitRetry({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            tools: [toolDecl],
            toolConfig: { functionCallingConfig: { mode: 'ANY' } },
            generationConfig: { maxOutputTokens: 128, temperature: 0 },
          }),
          timeoutMs: 60000,
        });
        totalRetries += round1.rateLimitRetries;

        const call = extractGeminiFunctionCall(round1.body);
        if (!call || call.name !== 'zavorth_live_marker') {
          const fail = multiStepNoToolNotes('Gemini', round1.body, round1.status);
          lastFail = {
            status: 'fail',
            notes: fail.notes,
            evidence: {
              family: 'gemini',
              providerId: creds.providerId,
              model,
              round: 1,
              outputPreview: redact(round1.body),
              autoCertified: false,
              rateLimited: fail.rateLimited,
              rateLimitRetries: totalRetries,
              httpStatus: round1.status,
              geminiKeySlot: ki + 1,
            },
          };
          // Rate-limit or missing model id → try next model/key; auth/other hard fail stops.
          if (fail.rateLimited || looksLikeModelNotFound(round1.body, round1.status)) continue;
          return lastFail;
        }

        const markerValue = toolResult();
        if (!markerValue || markerValue !== expectedMarker) {
          return {
            status: 'fail',
            notes: 'Workspace marker tool execution failed.',
            evidence: { expectedMarker, markerValue, autoCertified: false },
          };
        }

        // Placeholder-only user turn; marker only in functionResponse.
        const history = [
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ functionCall: { name: call.name, args: call.args || {} } }] },
          {
            role: 'user',
            parts: [{
              functionResponse: {
                name: call.name,
                response: { marker: markerValue, status: 'ok' },
              },
            }],
          },
        ];

        let round2 = await this.requestWithRateLimitRetry({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify({
            contents: history,
            generationConfig: { maxOutputTokens: 96, temperature: 0 },
          }),
          timeoutMs: 60000,
        });
        totalRetries += round2.rateLimitRetries;

        let finalText = extractGeminiText(round2.body);
        if (!multiStepTextPasses(finalText, markerValue)) {
          if (round2.status === 429 || looksLikeRateLimit(round2.body)) {
            lastFail = {
              status: 'fail',
              notes: multiStepNoToolNotes('Gemini', round2.body, round2.status).notes.replace('round 1', 'round 2'),
              evidence: {
                family: 'gemini',
                providerId: creds.providerId,
                model,
                round: 2,
                rateLimited: true,
                rateLimitRetries: totalRetries,
                autoCertified: false,
                outputPreview: redact(round2.body),
                geminiKeySlot: ki + 1,
              },
            };
            continue;
          }
          const forced = await this.requestWithRateLimitRetry({
            url,
            method: 'POST',
            headers,
            body: JSON.stringify({
              contents: [
                ...history,
                { role: 'model', parts: [{ text: finalText || '(no text)' }] },
                {
                  role: 'user',
                  parts: [{
                    text:
                      'Read the marker from the tool functionResponse only. '
                      + `Reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value> and nothing else.`,
                  }],
                },
              ],
              generationConfig: { maxOutputTokens: 48, temperature: 0 },
            }),
            timeoutMs: 60000,
          });
          totalRetries += forced.rateLimitRetries;
          round2 = forced;
          finalText = extractGeminiText(forced.body);
          if (!multiStepTextPasses(finalText, markerValue)
            && (forced.status === 429 || looksLikeRateLimit(forced.body))) {
            lastFail = {
              status: 'fail',
              notes: 'Multi-step forced-finish rate-limited after retries (Gemini).',
              evidence: {
                family: 'gemini',
                providerId: creds.providerId,
                model,
                rateLimited: true,
                rateLimitRetries: totalRetries,
                autoCertified: false,
                outputPreview: redact(forced.body),
                geminiKeySlot: ki + 1,
              },
            };
            continue;
          }
        }

        const pass = multiStepTextPasses(finalText, markerValue);
        if (pass) {
          const requestedModel = creds.modelId || DEFAULT_MODELS.gemini;
          return {
            status: 'pass',
            notes: `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
              + (model !== requestedModel ? ` modelFallback=${model}` : '')
              + (ki > 0 ? ` geminiKeySlot=${ki + 1}` : '')
              + (totalRetries > 0 ? ` rateLimitRetries=${totalRetries}` : ''),
            evidence: {
              family: 'gemini',
              providerId: creds.providerId,
              model,
              requestedModel,
              modelFallbackUsed: model !== requestedModel,
              keyRotated: ki > 0,
              geminiKeySlot: ki + 1,
              rateLimitRetries: totalRetries,
              toolName: call.name,
              toolRounds: 1,
              exactToken: true,
              markerMatched: true,
              autoCertified: true,
              credentialSource: creds.credentialSource,
              outputPreview: redact(finalText || round2.body),
            },
          };
        }

        lastFail = {
          status: 'fail',
          notes: 'Multi-step round 2 did not return required token + marker.',
          evidence: {
            family: 'gemini',
            providerId: creds.providerId,
            model,
            toolName: call.name,
            toolRounds: 1,
            exactToken: false,
            markerMatched: false,
            autoCertified: false,
            rateLimitRetries: totalRetries,
            credentialSource: creds.credentialSource,
            outputPreview: redact(finalText || round2.body),
            geminiKeySlot: ki + 1,
          },
        };
        // Token mismatch is not fixed by another key/model usually — stop cascade.
        return lastFail;
      }
    }

    return lastFail || {
      status: 'fail',
      notes: 'Multi-step Gemini failed after rate-limit retries and model/key fallbacks.',
      evidence: {
        family: 'gemini',
        providerId: creds.providerId,
        rateLimited: true,
        rateLimitRetries: totalRetries,
        autoCertified: false,
      },
    };
  }

  private async multiStepOpenAi(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('openai', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.openai];
    const tools = [{
      type: 'function',
      function: {
        name: 'zavorth_live_marker',
        description: 'Read the live multi-step workspace marker. Call this before answering.',
        parameters: { type: 'object', properties: {} },
      },
    }];
    const userMsg = {
      role: 'user',
      content:
        'Call zavorth_live_marker exactly once. '
        + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`,
    };

    let lastFail: LiveHarnessResult | null = null;
    let totalRetries = 0;

    for (const model of models) {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      };

      const round1 = await this.requestWithRateLimitRetry({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          model,
          messages: [userMsg],
          tools,
          tool_choice: 'required',
          temperature: 0,
          max_tokens: 128,
        }),
        timeoutMs: 60000,
      });
      totalRetries += round1.rateLimitRetries;

      const toolCall = extractOpenAiToolCall(round1.body);
      if (!toolCall) {
        const fail = multiStepNoToolNotes('OpenAI', round1.body, round1.status);
        lastFail = {
          status: 'fail',
          notes: fail.notes,
          evidence: {
            family: 'openai',
            providerId: creds.providerId,
            model,
            round: 1,
            outputPreview: redact(round1.body),
            autoCertified: false,
            rateLimited: fail.rateLimited,
            rateLimitRetries: totalRetries,
            httpStatus: round1.status,
          },
        };
        if (fail.rateLimited) continue;
        return lastFail;
      }

      const markerValue = toolResult();
      if (!markerValue || markerValue !== expectedMarker) {
        return {
          status: 'fail',
          notes: 'Workspace marker tool execution failed.',
          evidence: { expectedMarker, markerValue, autoCertified: false },
        };
      }

      let assistantMessage: Record<string, unknown> = { role: 'assistant', tool_calls: [toolCall.raw] };
      try {
        const parsed = JSON.parse(round1.body);
        assistantMessage = parsed?.choices?.[0]?.message || assistantMessage;
      } catch {
        // keep fallback
      }

      let round2 = await this.requestWithRateLimitRetry({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          model,
          messages: [
            userMsg,
            assistantMessage,
            {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ marker: markerValue }),
            },
          ],
          temperature: 0,
          max_tokens: 64,
        }),
        timeoutMs: 60000,
      });
      totalRetries += round2.rateLimitRetries;

      let finalText = extractOpenAiText(round2.body);
      if (!multiStepTextPasses(finalText, markerValue)) {
        if (round2.status === 429 || looksLikeRateLimit(round2.body)) {
          lastFail = {
            status: 'fail',
            notes: 'Multi-step round 2 rate-limited after retries (OpenAI).',
            evidence: {
              family: 'openai',
              providerId: creds.providerId,
              model,
              rateLimited: true,
              rateLimitRetries: totalRetries,
              autoCertified: false,
            },
          };
          continue;
        }
        round2 = await this.requestWithRateLimitRetry({
          url: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            model,
            messages: [
              userMsg,
              assistantMessage,
              {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ marker: markerValue }),
              },
              {
                role: 'user',
                content:
                  'Read the marker from the tool message only. '
                  + `Reply with exactly: ${LIVE_MULTI_STEP_TOKEN} and that marker value.`,
              },
            ],
            temperature: 0,
            max_tokens: 48,
          }),
          timeoutMs: 60000,
        });
        totalRetries += round2.rateLimitRetries;
        finalText = extractOpenAiText(round2.body);
      }
      const pass = multiStepTextPasses(finalText, markerValue);
      if (pass) {
        const requestedModel = creds.modelId || DEFAULT_MODELS.openai;
        return {
          status: 'pass',
          notes: `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
            + (model !== requestedModel ? ` modelFallback=${model}` : '')
            + (totalRetries > 0 ? ` rateLimitRetries=${totalRetries}` : ''),
          evidence: {
            family: 'openai',
            providerId: creds.providerId,
            model,
            requestedModel,
            modelFallbackUsed: model !== requestedModel,
            rateLimitRetries: totalRetries,
            toolName: toolCall.name,
            toolRounds: 1,
            exactToken: true,
            markerMatched: true,
            autoCertified: true,
            credentialSource: creds.credentialSource,
            outputPreview: redact(finalText || round2.body),
          },
        };
      }
      lastFail = {
        status: 'fail',
        notes: 'Multi-step round 2 did not return required token + marker.',
        evidence: {
          family: 'openai',
          providerId: creds.providerId,
          model,
          rateLimitRetries: totalRetries,
          autoCertified: false,
          outputPreview: redact(finalText || round2.body),
        },
      };
      return lastFail;
    }

    return lastFail || {
      status: 'fail',
      notes: 'Multi-step OpenAI failed after rate-limit retries.',
      evidence: {
        family: 'openai',
        providerId: creds.providerId,
        rateLimited: true,
        rateLimitRetries: totalRetries,
        autoCertified: false,
      },
    };
  }

  private async multiStepAnthropic(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const allowModelFb = this.options.enableModelFallbackOnRateLimit !== false;
    const models = allowModelFb
      ? listModelFallbacks('anthropic', creds.modelId)
      : [creds.modelId || DEFAULT_MODELS.anthropic];
    const tools = [{
      name: 'zavorth_live_marker',
      description: 'Read the live multi-step workspace marker. Call this before answering.',
      input_schema: { type: 'object', properties: {} },
    }];
    const userText =
      'Call zavorth_live_marker exactly once. '
      + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`;

    let lastFail: LiveHarnessResult | null = null;
    let totalRetries = 0;

    for (const model of models) {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      };

      const round1 = await this.requestWithRateLimitRetry({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 128,
          temperature: 0,
          tools,
          tool_choice: { type: 'any' },
          messages: [{ role: 'user', content: userText }],
        }),
        timeoutMs: 60000,
      });
      totalRetries += round1.rateLimitRetries;

      const toolUse = extractAnthropicToolUse(round1.body);
      if (!toolUse) {
        const fail = multiStepNoToolNotes('Anthropic', round1.body, round1.status);
        lastFail = {
          status: 'fail',
          notes: fail.notes,
          evidence: {
            family: 'anthropic',
            providerId: creds.providerId,
            model,
            round: 1,
            outputPreview: redact(round1.body),
            autoCertified: false,
            rateLimited: fail.rateLimited,
            rateLimitRetries: totalRetries,
            httpStatus: round1.status,
          },
        };
        if (fail.rateLimited) continue;
        return lastFail;
      }

      const markerValue = toolResult();
      if (!markerValue || markerValue !== expectedMarker) {
        return {
          status: 'fail',
          notes: 'Workspace marker tool execution failed.',
          evidence: { expectedMarker, markerValue, autoCertified: false },
        };
      }

      let assistantContent: unknown[] = [toolUse.raw];
      try {
        const parsed = JSON.parse(round1.body);
        if (Array.isArray(parsed?.content)) assistantContent = parsed.content;
      } catch {
        // keep fallback
      }

      let round2 = await this.requestWithRateLimitRetry({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 64,
          temperature: 0,
          messages: [
            { role: 'user', content: userText },
            { role: 'assistant', content: assistantContent },
            {
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify({ marker: markerValue }),
              }],
            },
          ],
        }),
        timeoutMs: 60000,
      });
      totalRetries += round2.rateLimitRetries;

      let finalText = extractAnthropicText(round2.body);
      if (!multiStepTextPasses(finalText, markerValue)) {
        if (round2.status === 429 || looksLikeRateLimit(round2.body)) {
          lastFail = {
            status: 'fail',
            notes: 'Multi-step round 2 rate-limited after retries (Anthropic).',
            evidence: {
              family: 'anthropic',
              providerId: creds.providerId,
              model,
              rateLimited: true,
              rateLimitRetries: totalRetries,
              autoCertified: false,
            },
          };
          continue;
        }
        round2 = await this.requestWithRateLimitRetry({
          url: 'https://api.anthropic.com/v1/messages',
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            max_tokens: 48,
            temperature: 0,
            messages: [
              { role: 'user', content: userText },
              { role: 'assistant', content: assistantContent },
              {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({ marker: markerValue }),
                  },
                  {
                    type: 'text',
                    text:
                      'Read the tool result marker. '
                      + `Reply with exactly: ${LIVE_MULTI_STEP_TOKEN} and that marker value only.`,
                  },
                ],
              },
            ],
          }),
          timeoutMs: 60000,
        });
        totalRetries += round2.rateLimitRetries;
        finalText = extractAnthropicText(round2.body);
      }
      const pass = multiStepTextPasses(finalText, markerValue);
      if (pass) {
        const requestedModel = creds.modelId || DEFAULT_MODELS.anthropic;
        return {
          status: 'pass',
          notes: `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
            + (model !== requestedModel ? ` modelFallback=${model}` : '')
            + (totalRetries > 0 ? ` rateLimitRetries=${totalRetries}` : ''),
          evidence: {
            family: 'anthropic',
            providerId: creds.providerId,
            model,
            requestedModel,
            modelFallbackUsed: model !== requestedModel,
            rateLimitRetries: totalRetries,
            toolName: toolUse.name,
            toolRounds: 1,
            exactToken: true,
            markerMatched: true,
            autoCertified: true,
            credentialSource: creds.credentialSource,
            outputPreview: redact(finalText || round2.body),
          },
        };
      }
      return {
        status: 'fail',
        notes: 'Multi-step round 2 did not return required token + marker.',
        evidence: {
          family: 'anthropic',
          providerId: creds.providerId,
          model,
          toolName: toolUse.name,
          toolRounds: 1,
          exactToken: false,
          markerMatched: false,
          autoCertified: false,
          rateLimitRetries: totalRetries,
          credentialSource: creds.credentialSource,
          outputPreview: redact(finalText || round2.body),
        },
      };
    }

    return lastFail || {
      status: 'fail',
      notes: 'Multi-step Anthropic failed after rate-limit retries.',
      evidence: {
        family: 'anthropic',
        providerId: creds.providerId,
        rateLimited: true,
        rateLimitRetries: totalRetries,
        autoCertified: false,
      },
    };
  }
}

function hasAnyLowercaseFragment(value: string, fragments: string[]): boolean {
  const lower = String(value || '').toLowerCase();
  return fragments.some((fragment) => lower.includes(fragment));
}
