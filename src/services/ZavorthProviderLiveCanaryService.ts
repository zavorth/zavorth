import { LlmRuntimeService } from './llm/LlmRuntimeService.js';

import { config } from '../config/index.js';
import {
  ZAVORTH_PROVIDER_LIVE_CANARY_VERSION,
  type ZavorthProviderLiveCanaryProviderEntry,
  type ZavorthProviderLiveCanarySnapshot,
  type ZavorthProviderLiveCanaryStatus,
} from '../contracts/ZavorthProviderLiveCanaryContract.js';

import { ProviderFactory } from '../providers/ProviderFactory.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { ZavorthSubagentRuntimeService } from './ZavorthSubagentRuntimeService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type LlmRuntimeLike = Pick<LlmRuntimeService, 'isProviderAvailable' | 'getPreferredProviderName'>;
type SubagentRuntimeLike = Pick<ZavorthSubagentRuntimeService, 'execute'>;

type Runtime = {
  now?: () => Date;
  llmRuntime?: LlmRuntimeLike;
  readinessMatrix?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  subagentRuntime?: SubagentRuntimeLike;
};

export type ZavorthProviderLiveCanaryInput = {
  runLive?: boolean | null;
  providerName?: string | null;
  modelName?: string | null;
  timeoutMs?: number | null;
};

const CANARY_MARKER = 'ZAVORTH_LIVE_SUBAGENT_CANARY_OK';

export class ZavorthProviderLiveCanaryService {
  private readonly now: () => Date;
  private readonly llmRuntime: LlmRuntimeLike;
  private readonly readinessMatrix: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;
  private readonly subagentRuntime: SubagentRuntimeLike;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.llmRuntime = runtime.llmRuntime || new LlmRuntimeService();
    this.readinessMatrix = runtime.readinessMatrix || new ZavorthProviderReadinessMatrixService();
    this.subagentRuntime = runtime.subagentRuntime || new ZavorthSubagentRuntimeService();
  }

  public async buildSnapshot(
    input: ZavorthProviderLiveCanaryInput = {},
  ): Promise<ZavorthProviderLiveCanarySnapshot> {
    const generatedAt = this.now().toISOString();
    const timeoutMs = positiveInteger(input.timeoutMs, 60000);
    const providerEntries = this.buildProviderEntries(input.providerName);
    const selected = providerEntries.find((entry) => entry.selected) || null;
    const modelName = normalizeNullable(input.modelName);
    const base = {
      generatedAt,
      contractVersion: ZAVORTH_PROVIDER_LIVE_CANARY_VERSION,
      source: 'ZavorthProviderLiveCanaryService' as const,
      mode: input.runLive ? 'live' as const : 'dry-run' as const,
      selectedProviderName: selected?.providerName || null,
      selectedModelName: modelName,
      timeoutMs,
      canaryMarker: CANARY_MARKER,
      providerEntries,
      guarantees: {
        noSecretValuesSerialized: true as const,
        noWorkspaceMutationRequested: true as const,
        noToolsRequestedByCanary: true as const,
        singleWorkerOnly: true as const,
        boundedTimeout: true as const,
        providerCredentialsOnlyPresenceChecked: true as const,
      },
      commands: {
        dryRun: 'npm run zavorth:provider-live-canary' as const,
        live: 'npm run zavorth:provider-live-canary -- --run-live' as const,
        json: 'npm run zavorth:provider-live-canary:json -- --run-live' as const,
        check: 'npm run zavorth:provider-live-canary:check --silent' as const,
      },
    };

    if (!selected) {
      return {
        ...base,
        status: 'blocked',
        live: emptyLive(false, 'No configured provider credentials were detected.'),
        narrative: this.narrative('blocked', false, false, 'Configure a provider credential, then rerun the live canary.'),
      };
    }

    if (!input.runLive) {
      return {
        ...base,
        status: 'attention',
        live: emptyLive(false, null),
        narrative: this.narrative('attention', false, false, 'Dry-run only. Add --run-live to perform a real provider canary.'),
      };
    }

    const requestedProvider = normalizeNullable(input.providerName);
    if (requestedProvider) {
      const requestedProviderKey = requestedProvider.toLowerCase();
      const providerProbe = await this.readinessMatrix.buildLiveSnapshot({
        providerId: requestedProvider,
        probe: true,
        live: true,
      });
      const probeEntry = providerProbe.entries.find((entry) => routeEntryKeys(entry).includes(requestedProviderKey));
      if (!probeEntry || probeEntry.probe.status !== 'passed') {
        const reason = probeEntry?.probe.summary || `No live probe entry was found for ${requestedProvider}.`;
        return {
          ...base,
          status: 'blocked',
          live: emptyLive(true, reason),
          narrative: this.narrative(
            'blocked',
            true,
            false,
            `Provider live probe failed before subagent canary: ${redact(reason)}`,
          ),
        };
      }
      const directProviderProbe = await this.runDirectProviderChatProbe(requestedProvider, modelName, timeoutMs);
      if (directProviderProbe.status !== 'passed') {
        return {
          ...base,
          status: 'blocked',
          live: emptyLive(true, directProviderProbe.error || 'Direct provider chat probe failed.'),
          narrative: this.narrative(
            'blocked',
            true,
            false,
            `Provider chat probe failed before subagent canary: ${redact(directProviderProbe.error || 'unknown error')}`,
          ),
        };
      }
    }

    try {
      const snapshot = await withTimeout(this.subagentRuntime.execute({
        action: 'subagents.spawn',
        task: [
          'use subagentes e rode um canary read-only do provider.',
          `Responda de forma curta e inclua exatamente o marcador ${CANARY_MARKER}.`,
          'Nao use ferramentas. Nao leia arquivos. Nao faca rede adicional. Nao escreva nada.',
        ].join(' '),
        roleIds: ['planner'],
        explicitSubagents: true,
        live: true,
        providerName: selected.providerName,
        modelName,
        maxLiveWorkers: 1,
        maxToolCalls: 0,
        persistState: false,
      }), timeoutMs);
      const output = snapshot.runs.map((run) => [
        run.summary || '',
        run.output || '',
        ...(run.workerResults || []).flatMap((worker) => [worker.summary, worker.output]),
      ].join('\n')).join('\n');
      const markerObserved = output.includes(CANARY_MARKER);
      const completed = snapshot.status === 'completed';
      const status: ZavorthProviderLiveCanaryStatus = completed && markerObserved
        ? 'passed'
        : completed
          ? 'attention'
          : 'blocked';
      return {
        ...base,
        status,
        live: {
          executed: true,
          completed,
          markerObserved,
          subagentStatus: snapshot.status,
          workerResults: snapshot.summary.workerResults,
          failedWorkerResults: snapshot.summary.failedWorkerResults,
          externalIoPerformed: snapshot.summary.externalIoPerformed,
          workspaceMutationPerformed: snapshot.summary.workspaceMutationPerformed,
          upstreamRuntimeCodeExecuted: snapshot.summary.upstreamRuntimeCodeExecuted,
          error: null,
        },
        narrative: this.narrative(
          status,
          true,
          markerObserved,
          status === 'passed'
            ? 'Provider credentials and live subagent path worked on this host.'
            : 'Provider responded, but the exact canary marker was not observed.',
        ),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        ...base,
        status: 'blocked',
        live: emptyLive(true, message),
        narrative: this.narrative('blocked', true, false, `Live canary failed: ${redact(message)}`),
      };
    }
  }

  public renderReport(snapshot: ZavorthProviderLiveCanarySnapshot): string {
    const providers = snapshot.providerEntries
      .filter((entry) => entry.available || entry.selected)
      .map((entry) => `- ${entry.providerName}: ${entry.available ? 'available' : 'missing'}${entry.selected ? ' (selected)' : ''}`)
      .join('\n') || '- nenhum provider disponivel';
    return [
      'Zavorth Provider Live Canary',
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Provider: ${snapshot.selectedProviderName || 'n/d'}`,
      `Marker: ${snapshot.live.markerObserved ? 'observed' : 'not-observed'}`,
      `Subagent: ${snapshot.live.subagentStatus || 'not-run'} | workers=${snapshot.live.workerResults} failed=${snapshot.live.failedWorkerResults}`,
      '',
      'Providers:',
      providers,
      '',
      snapshot.narrative.operatorSummary,
      `Next: ${snapshot.narrative.nextAction}`,
    ].join('\n');
  }

  private async runDirectProviderChatProbe(
    providerName: string,
    modelName: string | null,
    timeoutMs: number,
  ): Promise<{ status: 'passed' | 'failed'; error: string | null }> {
    try {
      ProviderFactory.clearCache();
      const provider = ProviderFactory.create(providerName);
      const response = await withTimeout(provider.chat([
        {
          role: 'user',
          content: `Reply with exactly this marker and nothing else: ${CANARY_MARKER}`,
        },
      ], [], modelName ? { modelName } : undefined), timeoutMs);
      const content = String(response.content || '');
      if (!content.includes(CANARY_MARKER)) {
        return { status: 'failed', error: 'Provider answered, but the exact canary marker was not observed.' };
      }
      return { status: 'passed', error: null };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth  Live Canary] filesystem check failed', error);
    return {
        status: 'failed',
        error: error instanceof Error ? err.message : String(error),
      };
  } finally {
      ProviderFactory.clearCache();
    }
  }

  private buildProviderEntries(requestedProviderName?: string | null): ZavorthProviderLiveCanaryProviderEntry[] {
    const requested = normalizeNullable(requestedProviderName);
    const preferred = normalizeNullable(this.llmRuntime.getPreferredProviderName?.()) || normalizeNullable(config.llmProvider) || 'gemini';
    const candidates = unique([
      requested,
      preferred,
      'aigateway',
      'gemini',
      'openai',
      'openrouter',
      'deepseek',
      'groq',
      'minimax',
      'qwen',
      'opencode',
      'claude-agent-sdk',
      'anthropic-direct',
      'google-genai',
    ].filter(Boolean) as string[]);
    const availability = candidates.map((providerName) => {
      let available = false;
      let reason = 'not configured';
      try {
        available = this.llmRuntime.isProviderAvailable(providerName);
        reason = available ? 'credential or endpoint presence detected' : 'credential or endpoint not detected';
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn('[Zavorth  Live Canary] array operation failed', error);
    available = false;
        reason = error instanceof Error ? err.message : String(error);
  }
      return {
        providerName,
        available,
        selected: false,
        reason,
      };
    });
    const selected = requested
      ? availability.find((entry) => entry.providerName === requested && entry.available) || null
      : availability.find((entry) => entry.available) || null;
    return availability.map((entry) => ({
      ...entry,
      selected: Boolean(selected && selected.providerName === entry.providerName),
    }));
  }

  private narrative(
    status: ZavorthProviderLiveCanaryStatus,
    executed: boolean,
    markerObserved: boolean,
    nextAction: string,
  ): ZavorthProviderLiveCanarySnapshot['narrative'] {
    return {
      headline: 'Provider live canary',
      operatorSummary: executed
        ? `Canary live ${status}; marker=${markerObserved ? 'observed' : 'not-observed'}.`
        : `Canary ${status}; no external provider call was made.`,
      nextAction,
    };
  }
}

function emptyLive(executed: boolean, error: string | null): ZavorthProviderLiveCanarySnapshot['live'] {
  return {
    executed,
    completed: false,
    markerObserved: false,
    subagentStatus: null,
    workerResults: 0,
    failedWorkerResults: 0,
    externalIoPerformed: false,
    workspaceMutationPerformed: false,
    upstreamRuntimeCodeExecuted: false,
    error: error ? redact(error) : null,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Provider live canary timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeNullable(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function routeEntryKeys(entry: { id?: string | null; providerName?: string | null; providerId?: string | null; familyIds?: string[] | null }): string[] {
  return unique([
    normalizeNullable(entry.id),
    normalizeNullable(entry.providerName),
    normalizeNullable(entry.providerId),
    ...(entry.familyIds || []).map(normalizeNullable),
  ].filter(Boolean) as string[]).map((value) => value.toLowerCase());
}

function redact(value: string): string {
  return String(value || '')
    .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]')
    .replace(/(api[_-]?key|token|secret|password|senha)[=:]\s*[^,\s]+/gi, '$1=[redacted]');
}
