import {
  AI_FIRST_RUNTIME_ENTRYPOINT_ADAPTER_CONTRACT_VERSION,
  type AiFirstRuntimeEntrypointAdapterSnapshot,
  type AiFirstRuntimeEntrypointCanarySummary,
  type AiFirstRuntimeEntrypointEffectiveDecision,
  type AiFirstRuntimeEntrypointFallbackReason,
  type AiFirstRuntimeEntrypointStatus,
} from '../contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import type {
  AiFirstLimitedCanaryRouteDecision,
  AiFirstLimitedCanaryRouteProbe,
  AiFirstLimitedCanarySwitchboardSnapshot,
} from '../contracts/AiFirstLimitedCanarySwitchboardContract.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';

type AiFirstRuntimeEntrypointAdapterRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstRuntimeEntrypointAdapterInput = {
  adapterName?: string | null;
  requestId?: string | null;
  surface?: string | null;
  userMessage?: string | null;
  currentDecision: ZavorthResponseDecision;
  switchboardSnapshot?: AiFirstLimitedCanarySwitchboardSnapshot | null;
  canaryDecision?: AiFirstLimitedCanaryRouteDecision | null;
  routeProbe?: AiFirstLimitedCanaryRouteProbe | null;
};

export class AiFirstRuntimeEntrypointAdapterService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstRuntimeEntrypointAdapterRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public adapt(input: AiFirstRuntimeEntrypointAdapterInput): AiFirstRuntimeEntrypointAdapterSnapshot {
    const requestId = safeId(input.requestId || input.routeProbe?.requestId || input.canaryDecision?.requestId || 'runtime-request');
    const surface = safeText(input.surface || input.currentDecision.diagnostics.surface || input.routeProbe?.surface || 'unknown');
    const canaryDecision = this.resolveCanaryDecision({
      requestId,
      input,
    });
    const canary = this.buildCanarySummary({
      switchboard: input.switchboardSnapshot || null,
      canaryDecision,
    });
    const effective = this.buildEffectiveDecision(canary);

    return {
      contractVersion: AI_FIRST_RUNTIME_ENTRYPOINT_ADAPTER_CONTRACT_VERSION,
      source: 'ai-first-runtime-entrypoint-adapter',
      generatedAt: this.now().toISOString(),
      adapterId: this.idFactory('adapter'),
      input: {
        adapterName: safeText(input.adapterName || 'ai-first-runtime-entrypoint-adapter'),
        requestId,
        surface,
        userMessage: safeText(input.userMessage || ''),
      },
      currentRuntime: {
        mode: input.currentDecision.mode,
        responsePath: input.currentDecision.responsePath,
        confidence: input.currentDecision.confidence,
        shouldExecute: input.currentDecision.diagnostics.shouldExecute,
        requestedTools: uniqueStrings(input.currentDecision.requestedTools),
        target: input.currentDecision.target,
        reason: safeText(input.currentDecision.reason),
        sourceReason: safeText(input.currentDecision.sourceReason),
        diagnosticRisk: nullableText(input.currentDecision.diagnostics.universalIntent?.risk),
        diagnosticNextSafeAction: nullableText(input.currentDecision.diagnostics.universalIntent?.nextSafeAction),
        retainedAsFallback: true,
      },
      canary,
      effective,
      sideBySide: {
        currentRuntimeWouldHandle: true,
        aiFirstCanaryWouldHandle: effective.canarySelected,
        selectedDecisionRecordedBesideCurrent: true,
        canaryDecisionSource: canary.decision === 'unavailable' ? 'missing' : 'phase-6-switchboard',
      },
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'entrypoint',
          detail: 'Runtime entrypoint adapter evaluated current runtime and AI-first canary side by side.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'current-runtime',
          detail: `Current runtime decision retained as fallback through ${input.currentDecision.responsePath}.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'canary',
          detail: effective.canarySelected
            ? 'AI-first canary selected by Phase 6 switchboard.'
            : 'AI-first canary was not selected; fallback/current runtime remains active.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'fallback',
          detail: 'Fallback to current runtime remains instantly available.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Adapter does not change the default runtime route.',
        },
      ],
      gates: [
        {
          id: 'phase-7-switchboard-required',
          status: 'passed',
          detail: 'Canary selection requires a Phase 6 switchboard decision.',
        },
        {
          id: 'phase-7-current-runtime-retained',
          status: 'passed',
          detail: 'Current runtime decision is retained beside the canary decision.',
        },
        {
          id: 'phase-7-fallback-preserved',
          status: 'passed',
          detail: 'Every adapted decision preserves fallback to the current runtime.',
        },
        {
          id: 'phase-7-adapter-only-no-execution',
          status: 'passed',
          detail: 'Adapter records selected path but does not execute.',
        },
        {
          id: 'phase-7-default-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public renderMarkdown(snapshot: AiFirstRuntimeEntrypointAdapterSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router Phase 7');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- adapterId: ${snapshot.adapterId}`);
    lines.push(`- requestId: ${snapshot.input.requestId}`);
    lines.push(`- selectedPath: ${snapshot.effective.selectedPath}`);
    lines.push(`- status: ${snapshot.effective.status}`);
    lines.push(`- canarySelected: ${String(snapshot.effective.canarySelected)}`);
    lines.push(`- currentRuntimeDecisionRetained: ${String(snapshot.effective.currentRuntimeDecisionRetained)}`);
    lines.push(`- canExecuteNow: ${String(snapshot.effective.canExecuteNow)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.effective.defaultRuntimeChanged)}`);
    lines.push('');
    lines.push('## Current runtime');
    lines.push(`- mode: ${snapshot.currentRuntime.mode}`);
    lines.push(`- responsePath: ${snapshot.currentRuntime.responsePath}`);
    lines.push(`- shouldExecute: ${String(snapshot.currentRuntime.shouldExecute)}`);
    lines.push('');
    lines.push('## Canary');
    lines.push(`- switchboardId: ${snapshot.canary.switchboardId || 'none'}`);
    lines.push(`- decision: ${snapshot.canary.decision}`);
    lines.push(`- routeKey: ${snapshot.canary.matchedRouteKey || 'none'}`);
    lines.push(`- fallbackReason: ${snapshot.canary.fallbackReason || 'none'}`);
    return lines.join('\n');
  }

  private resolveCanaryDecision(input: {
    requestId: string;
    input: AiFirstRuntimeEntrypointAdapterInput;
  }): AiFirstLimitedCanaryRouteDecision | null {
    if (input.input.canaryDecision) {
      return input.input.canaryDecision;
    }
    const decisions = input.input.switchboardSnapshot?.decisions || [];
    const byRequestId = decisions.find((decision) => decision.requestId === input.requestId);
    if (byRequestId) {
      return byRequestId;
    }
    const probe = input.input.routeProbe;
    if (probe) {
      return decisions.find((decision) =>
        decision.familyId === probe.familyId
        && decision.surface === probe.surface
        && decision.risk === probe.risk) || null;
    }
    return decisions.length === 1 ? decisions[0] || null : null;
  }

  private buildCanarySummary(input: {
    switchboard: AiFirstLimitedCanarySwitchboardSnapshot | null;
    canaryDecision: AiFirstLimitedCanaryRouteDecision | null;
  }): AiFirstRuntimeEntrypointCanarySummary {
    if (!input.switchboard || !input.canaryDecision) {
      return {
        switchboardId: input.switchboard?.switchboardId || null,
        switchboardReadiness: input.switchboard?.recommendation.readiness || null,
        decision: 'unavailable',
        requestId: input.canaryDecision?.requestId || null,
        matchedRouteKey: null,
        fallbackReason: input.switchboard ? 'canary-decision-missing' : 'switchboard-missing',
        phase3GuardrailRequired: true,
        registryReceiptRequired: true,
        fallbackAvailable: true,
        defaultRuntimeChanged: false,
        canExecuteNow: false,
      };
    }
    return {
      switchboardId: input.switchboard.switchboardId,
      switchboardReadiness: input.switchboard.recommendation.readiness,
      decision: input.canaryDecision.decision,
      requestId: input.canaryDecision.requestId,
      matchedRouteKey: input.canaryDecision.matchedRouteKey,
      fallbackReason: input.canaryDecision.decision === 'select-ai-first-canary'
        ? null
        : input.canaryDecision.fallbackReason || 'canary-not-selected',
      phase3GuardrailRequired: true,
      registryReceiptRequired: true,
      fallbackAvailable: true,
      defaultRuntimeChanged: false,
      canExecuteNow: false,
    };
  }

  private buildEffectiveDecision(canary: AiFirstRuntimeEntrypointCanarySummary): AiFirstRuntimeEntrypointEffectiveDecision {
    const canarySelected = canary.decision === 'select-ai-first-canary';
    const status: AiFirstRuntimeEntrypointStatus = canarySelected
      ? 'canary-selected'
      : canary.decision === 'unavailable'
        ? 'current-runtime-only'
        : 'fallback-current-runtime';
    const selectedPath = canarySelected ? 'ai-first-canary' : 'current-runtime';
    return {
      status,
      selectedPath,
      dispatchTarget: selectedPath,
      reason: canarySelected
        ? 'Phase 6 switchboard selected AI-first canary for this request.'
        : `Current runtime selected because canary is not available (${canary.fallbackReason || 'unknown'}).`,
      canarySelected,
      currentRuntimeDecisionRetained: true,
      fallbackAvailable: true,
      defaultRuntimeChanged: false,
      keepCurrentRuntimeDecision: true,
      adapterOnly: true,
      canExecuteNow: false,
    };
  }
}

function safeText(value: unknown): string {
  return redactSensitiveText(String(value || '').trim() || 'unknown');
}

function nullableText(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? redactSensitiveText(text) : null;
}

function safeId(value: unknown): string {
  const text = safeText(value).toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'runtime-request';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = safeText(value);
    const key = normalized.toLowerCase();
    if (key === 'unknown' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}
