import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import type { ChatMessage, ToolDefinition } from '../../providers/ILlmProvider.js';
import { ZavorthI18nService } from '../../i18n/ZavorthI18nService.js';
import { LlmRuntimeService, type LlmRuntimeResult } from '../llm/LlmRuntimeService.js';
import { resolveUserProviderSelection, type UserProviderSelection } from '../UserSelectionResolver.js';

export const LIVE_PROBE_TOKEN = 'ZAVORTH_LIVE_OK';
export const LIVE_MULTI_STEP_TOKEN = 'ZAVORTH_LIVE_MS_OK';

export type LiveProviderFamily = 'gemini' | 'openai' | 'anthropic';

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

export type ResolvedLiveCredentials = {
  family: LiveProviderFamily | null;
  providerId: string;
  modelId: string;
  apiKey: string;
  selection: UserProviderSelection;
  credentialSource: 'selection' | 'single-key-infer' | 'none';
  reason?: string;
};

export type LiveHarnessResult = {
  status: 'pass' | 'fail' | 'blocked';
  notes: string;
  evidence: Record<string, unknown>;
};

const DEFAULT_MODELS: Record<LiveProviderFamily, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
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

function familyFromProviderId(providerId: string | null | undefined): LiveProviderFamily | null {
  const id = String(providerId || '').trim().toLowerCase();
  if (!id) return null;
  if (
    id === 'gemini'
    || id === 'gemma'
    || id === 'google'
    || id === 'google-ai-studio'
    || id.includes('gemini')
  ) {
    return 'gemini';
  }
  if (id === 'openai' || id === 'oa' || id.startsWith('openai')) {
    return 'openai';
  }
  if (id === 'anthropic' || id === 'claude' || id.includes('anthropic')) {
    return 'anthropic';
  }
  return null;
}

function keyForFamily(family: LiveProviderFamily, env: NodeJS.ProcessEnv): string {
  if (family === 'gemini') return String(env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '').trim();
  if (family === 'openai') return String(env.OPENAI_API_KEY || '').trim();
  return String(env.ANTHROPIC_API_KEY || '').trim();
}

function availableKeyFamilies(env: NodeJS.ProcessEnv): LiveProviderFamily[] {
  const out: LiveProviderFamily[] = [];
  if (keyForFamily('gemini', env).length >= 12) out.push('gemini');
  if (keyForFamily('openai', env).length >= 12) out.push('openai');
  if (keyForFamily('anthropic', env).length >= 12) out.push('anthropic');
  return out;
}

/**
 * Resolve which provider to use for live harnesses.
 * Never invents Gemini when the user chose another provider or none.
 */
export function resolveLiveCredentials(input: {
  projectRoot?: string;
  env?: NodeJS.ProcessEnv;
}): ResolvedLiveCredentials {
  const env = input.env || process.env;
  const selection = resolveUserProviderSelection({ projectRoot: input.projectRoot, env });
  const selectedFamily = familyFromProviderId(selection.providerId);
  const available = availableKeyFamilies(env);

  if (selectedFamily) {
    const apiKey = keyForFamily(selectedFamily, env);
    if (apiKey.length < 12) {
      return {
        family: selectedFamily,
        providerId: selection.providerId || selectedFamily,
        modelId: selection.modelId || DEFAULT_MODELS[selectedFamily],
        apiKey: '',
        selection,
        credentialSource: 'none',
        reason: `Provider "${selection.providerId}" is selected but no matching API key is configured.`,
      };
    }
    return {
      family: selectedFamily,
      providerId: selection.providerId || selectedFamily,
      modelId: selection.modelId || DEFAULT_MODELS[selectedFamily],
      apiKey,
      selection,
      credentialSource: 'selection',
    };
  }

  if (available.length === 1) {
    const family = available[0];
    return {
      family,
      providerId: family,
      modelId: DEFAULT_MODELS[family],
      apiKey: keyForFamily(family, env),
      selection,
      credentialSource: 'single-key-infer',
    };
  }

  if (available.length > 1) {
    return {
      family: null,
      providerId: 'unconfigured',
      modelId: '',
      apiKey: '',
      selection,
      credentialSource: 'none',
      reason:
        'Multiple provider keys present and no user provider selected. '
        + 'Set LLM_PROVIDER / preference or leave a single key family.',
    };
  }

  return {
    family: null,
    providerId: 'unconfigured',
    modelId: '',
    apiKey: '',
    selection,
    credentialSource: 'none',
    reason: 'No provider selected and no API keys found (OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY).',
  };
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
function looksLikeRateLimit(text: string | number | null | undefined): boolean {
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

function multiStepNoToolNotes(providerLabel: string, body: string, status?: number): {
  notes: string;
  rateLimited: boolean;
} {
  const rateLimited = looksLikeRateLimit(body) || status === 429;
  return {
    rateLimited,
    notes: rateLimited
      ? `Multi-step round 1 failed: rate limited / quota exhausted (429) on ${providerLabel}. Retry with an alternate provider or API key — do not treat as multi-step pass.`
      : `Multi-step round 1 did not produce a tool call (${providerLabel}).`,
  };
}

function exactProbeToken(text: string): boolean {
  return String(text || '').trim() === LIVE_PROBE_TOKEN;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class LiveUserProviderHarness {
  private readonly i18n: ZavorthI18nService;

  constructor(
    private readonly options: {
      projectRoot?: string;
      env?: NodeJS.ProcessEnv;
      transport?: LiveHttpTransport;
      runtimeFactory?: (providerId: string) => LiveLlmRuntime;
    } = {},
  ) {
    this.i18n = new ZavorthI18nService();
    this.i18n.setLocale(this.i18n.resolveFromSource({ env: this.options.env || process.env }));
  }

  private transport(): LiveHttpTransport {
    return this.options.transport || defaultTransport;
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

  private runtimeFailure(selection: UserProviderSelection, error: unknown, phase: string): LiveHarnessResult {
    const message = error instanceof Error ? error.message : String(error);
    const missingConfiguration = /api key|credential|not configured|not available|unavailable|no provider/i.test(message);
    const rateLimited = looksLikeRateLimit(message);
    const base = this.t('runtime_failure', '{phase} via production runtime: {message}', {
      phase,
      message: redact(message),
    });
    const notes = rateLimited
      ? `${base} Rate limited / quota exhausted (429). Retry with an alternate provider or API key — do not treat as multi-step pass.`
      : base;
    return {
      status: missingConfiguration ? 'blocked' : 'fail',
      notes,
      evidence: {
        providerId: selection.providerId,
        configured: selection.configured,
        runtimePath: true,
        phase,
        rateLimited,
      },
    };
  }

  private t(key: string, fallback: string, vars?: Record<string, string>): string {
    return this.i18n.t(`services.live_smartness.${key}`, { fallback, vars });
  }

  private async probeGemini(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    // Probe only the selected/default model — never certify a fallback model as the user's route.
    const model = creds.modelId || DEFAULT_MODELS.gemini;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      + `?key=${encodeURIComponent(creds.apiKey)}`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }] }],
      generationConfig: { maxOutputTokens: 64, temperature: 0 },
    });
    const res = await this.transport()({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      timeoutMs: 45000,
    });
    const text = extractGeminiText(res.body);
    const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
    return {
      status: exact ? 'pass' : 'fail',
      notes: exact
        ? `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
        : `Gemini probe failed status=${res.status}`,
      evidence: {
        family: 'gemini',
        providerId: creds.providerId,
        model,
        exactToken: exact,
        credentialSource: creds.credentialSource,
        outputPreview: redact(res.body),
      },
    };
  }

  private async probeOpenAi(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    const body = JSON.stringify({
      model: creds.modelId || DEFAULT_MODELS.openai,
      messages: [{ role: 'user', content: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }],
      max_tokens: 32,
      temperature: 0,
    });
    const res = await this.transport()({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body,
      timeoutMs: 45000,
    });
    const text = extractOpenAiText(res.body);
    const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
    return {
      status: exact ? 'pass' : 'fail',
      notes: exact
        ? `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
        : `OpenAI probe failed status=${res.status}`,
      evidence: {
        family: 'openai',
        providerId: creds.providerId,
        model: creds.modelId,
        exactToken: exact,
        credentialSource: creds.credentialSource,
        outputPreview: redact(res.body),
      },
    };
  }

  private async probeAnthropic(creds: ResolvedLiveCredentials): Promise<LiveHarnessResult> {
    const body = JSON.stringify({
      model: creds.modelId || DEFAULT_MODELS.anthropic,
      max_tokens: 32,
      temperature: 0,
      messages: [{ role: 'user', content: `Reply with exactly the token ${LIVE_PROBE_TOKEN} and nothing else.` }],
    });
    const res = await this.transport()({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
      timeoutMs: 45000,
    });
    const text = extractAnthropicText(res.body);
    const exact = res.status >= 200 && res.status < 300 && exactProbeToken(text);
    return {
      status: exact ? 'pass' : 'fail',
      notes: exact
        ? `Live ${creds.providerId} probe returned exact token ${LIVE_PROBE_TOKEN}.`
        : `Anthropic probe failed status=${res.status}`,
      evidence: {
        family: 'anthropic',
        providerId: creds.providerId,
        model: creds.modelId,
        exactToken: exact,
        credentialSource: creds.credentialSource,
        outputPreview: redact(res.body),
      },
    };
  }

  private async multiStepGemini(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const model = creds.modelId || DEFAULT_MODELS.gemini;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      + `?key=${encodeURIComponent(creds.apiKey)}`;
    const toolDecl = {
      functionDeclarations: [{
        name: 'zavorth_live_marker',
        description: 'Read the live multi-step workspace marker. Call this before answering.',
        parameters: { type: 'object', properties: {} },
      }],
    };
    const round1 = await this.transport()({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text:
              'You must call the tool zavorth_live_marker first. '
              + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`,
          }],
        }],
        tools: [toolDecl],
        toolConfig: { functionCallingConfig: { mode: 'ANY' } },
        generationConfig: { maxOutputTokens: 128, temperature: 0 },
      }),
      timeoutMs: 60000,
    });

    const call = extractGeminiFunctionCall(round1.body);
    if (!call || call.name !== 'zavorth_live_marker') {
      const fail = multiStepNoToolNotes('Gemini', round1.body, round1.status);
      return {
        status: 'fail',
        notes: fail.notes,
        evidence: {
          family: 'gemini',
          providerId: creds.providerId,
          round: 1,
          outputPreview: redact(round1.body),
          autoCertified: false,
          rateLimited: fail.rateLimited,
          httpStatus: round1.status,
        },
      };
    }

    const markerValue = toolResult();
    if (!markerValue || markerValue !== expectedMarker) {
      return {
        status: 'fail',
        notes: 'Workspace marker tool execution failed.',
        evidence: { expectedMarker, markerValue, autoCertified: false },
      };
    }

    // Keep the user turn placeholder-only; secret marker lives only in functionResponse.
    const history = [
      {
        role: 'user',
        parts: [{
          text:
            'You must call the tool zavorth_live_marker first. '
            + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`,
        }],
      },
      {
        role: 'model',
        parts: [{ functionCall: { name: call.name, args: call.args || {} } }],
      },
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

    let round2 = await this.transport()({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: history,
        generationConfig: { maxOutputTokens: 96, temperature: 0 },
      }),
      timeoutMs: 60000,
    });

    let finalText = extractGeminiText(round2.body);
    // Forced finish: some models emit tool follow-ups instead of the token; one plain turn is still a real multi-step completion.
    if (!multiStepTextPasses(finalText, markerValue)) {
      const forced = await this.transport()({
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      round2 = forced;
      finalText = extractGeminiText(forced.body);
    }

    const pass = multiStepTextPasses(finalText, markerValue);
    return {
      status: pass ? 'pass' : 'fail',
      notes: pass
        ? `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
        : 'Multi-step round 2 did not return required token + marker.',
      evidence: {
        family: 'gemini',
        providerId: creds.providerId,
        model,
        toolName: call.name,
        toolRounds: 1,
        exactToken: finalText.includes(LIVE_MULTI_STEP_TOKEN),
        markerMatched: finalText.includes(markerValue),
        autoCertified: pass,
        credentialSource: creds.credentialSource,
        outputPreview: redact(finalText || round2.body),
      },
    };
  }

  private async multiStepOpenAi(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const model = creds.modelId || DEFAULT_MODELS.openai;
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

    const round1 = await this.transport()({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
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

    const toolCall = extractOpenAiToolCall(round1.body);
    if (!toolCall) {
      const fail = multiStepNoToolNotes('OpenAI', round1.body, round1.status);
      return {
        status: 'fail',
        notes: fail.notes,
        evidence: {
          family: 'openai',
          providerId: creds.providerId,
          round: 1,
          outputPreview: redact(round1.body),
          autoCertified: false,
          rateLimited: fail.rateLimited,
          httpStatus: round1.status,
        },
      };
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

    const round2 = await this.transport()({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
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

    let finalText = extractOpenAiText(round2.body);
    if (!multiStepTextPasses(finalText, markerValue)) {
      const forced = await this.transport()({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.apiKey}`,
        },
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
                `Read the marker from the tool message only. `
                + `Reply with exactly: ${LIVE_MULTI_STEP_TOKEN} and that marker value.`,
            },
          ],
          temperature: 0,
          max_tokens: 48,
        }),
        timeoutMs: 60000,
      });
      finalText = extractOpenAiText(forced.body);
    }
    const pass = multiStepTextPasses(finalText, markerValue);
    return {
      status: pass ? 'pass' : 'fail',
      notes: pass
        ? `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
        : 'Multi-step round 2 did not return required token + marker.',
      evidence: {
        family: 'openai',
        providerId: creds.providerId,
        model,
        toolName: toolCall.name,
        toolRounds: 1,
        exactToken: finalText.includes(LIVE_MULTI_STEP_TOKEN),
        markerMatched: finalText.includes(markerValue),
        autoCertified: pass,
        credentialSource: creds.credentialSource,
        outputPreview: redact(finalText || round2.body),
      },
    };
  }

  private async multiStepAnthropic(
    creds: ResolvedLiveCredentials,
    expectedMarker: string,
    toolResult: () => string,
  ): Promise<LiveHarnessResult> {
    const model = creds.modelId || DEFAULT_MODELS.anthropic;
    const tools = [{
      name: 'zavorth_live_marker',
      description: 'Read the live multi-step workspace marker. Call this before answering.',
      input_schema: { type: 'object', properties: {} },
    }];
    const userText =
      'Call zavorth_live_marker exactly once. '
      + `After the tool result, reply with exactly: ${LIVE_MULTI_STEP_TOKEN} <marker-value>`;

    const round1 = await this.transport()({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
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

    const toolUse = extractAnthropicToolUse(round1.body);
    if (!toolUse) {
      const fail = multiStepNoToolNotes('Anthropic', round1.body, round1.status);
      return {
        status: 'fail',
        notes: fail.notes,
        evidence: {
          family: 'anthropic',
          providerId: creds.providerId,
          round: 1,
          outputPreview: redact(round1.body),
          autoCertified: false,
          rateLimited: fail.rateLimited,
          httpStatus: round1.status,
        },
      };
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

    const round2 = await this.transport()({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
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

    let finalText = extractAnthropicText(round2.body);
    if (!multiStepTextPasses(finalText, markerValue)) {
      const forced = await this.transport()({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': creds.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 48,
          temperature: 0,
          messages: [
            { role: 'user', content: userText },
            { role: 'assistant', content: assistantContent },
            // Single user turn: tool_result + finish instruction (Anthropic forbids consecutive users).
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
      finalText = extractAnthropicText(forced.body);
    }
    const pass = multiStepTextPasses(finalText, markerValue);
    return {
      status: pass ? 'pass' : 'fail',
      notes: pass
        ? `Live multi-step tool plan passed with ${creds.providerId} (real tool round + model finish).`
        : 'Multi-step round 2 did not return required token + marker.',
      evidence: {
        family: 'anthropic',
        providerId: creds.providerId,
        model,
        toolName: toolUse.name,
        toolRounds: 1,
        exactToken: pass,
        markerMatched: pass,
        autoCertified: pass,
        credentialSource: creds.credentialSource,
        outputPreview: redact(finalText || round2.body),
      },
    };
  }
}

/**
 * Strict multi-step finish: token + marker only (optional surrounding quotes/punctuation).
 * Rejects long prose that merely embeds the token string.
 */
function multiStepTextPasses(text: string, markerValue: string): boolean {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  const pattern = new RegExp(
    `^["'\`]*${escapeRegExp(LIVE_MULTI_STEP_TOKEN)}\\s+${escapeRegExp(markerValue)}["'\`.,!;:]*$`,
    'i',
  );
  return pattern.test(normalized);
}

function extractGeminiText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part: { text?: string }) => String(part?.text || '')).join('\n');
  } catch {
    return '';
  }
}

function extractGeminiFunctionCall(body: string): { name: string; args: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(body);
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
      if (part?.functionCall?.name === 'zavorth_live_marker') {
        return {
          name: String(part.functionCall.name),
          args: (part.functionCall.args && typeof part.functionCall.args === 'object')
            ? part.functionCall.args
            : {},
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractOpenAiText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    return String(parsed?.choices?.[0]?.message?.content || '');
  } catch {
    return '';
  }
}

function extractOpenAiToolCall(body: string): { id: string; name: string; raw: unknown } | null {
  try {
    const parsed = JSON.parse(body);
    const toolCalls = parsed?.choices?.[0]?.message?.tool_calls;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;
    const match = toolCalls.find(
      (entry: { function?: { name?: string } }) => String(entry?.function?.name || '') === 'zavorth_live_marker',
    ) || null;
    if (!match) return null;
    return {
      id: String(match.id || 'tool_call_0'),
      name: String(match.function?.name || ''),
      raw: match,
    };
  } catch {
    return null;
  }
}

function extractAnthropicText(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const content = parsed?.content;
    if (!Array.isArray(content)) return '';
    return content
      .filter((part: { type?: string }) => part?.type === 'text')
      .map((part: { text?: string }) => String(part?.text || ''))
      .join('\n');
  } catch {
    return '';
  }
}

function extractAnthropicToolUse(body: string): { id: string; name: string; raw: unknown } | null {
  try {
    const parsed = JSON.parse(body);
    const content = parsed?.content;
    if (!Array.isArray(content)) return null;
    const tool = content.find(
      (part: { type?: string; name?: string }) => part?.type === 'tool_use' && part?.name === 'zavorth_live_marker',
    );
    if (!tool) return null;
    return {
      id: String(tool.id || 'tool_use_0'),
      name: String(tool.name || ''),
      raw: tool,
    };
  } catch {
    return null;
  }
}
