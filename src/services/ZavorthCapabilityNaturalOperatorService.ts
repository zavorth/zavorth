import { ZavorthCapabilitySetupQueueService } from './ZavorthCapabilitySetupQueueService.js';

import {
  CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION,
  type CapabilityNaturalOperatorAction,
  type CapabilityNaturalOperatorDecision,
  type CapabilityNaturalOperatorInput,
  type CapabilityNaturalOperatorResult,
} from '../contracts/CapabilityNaturalOperatorContract.js';
import type { CapabilityHubItem } from '../contracts/CapabilityHubContract.js';
import type { CapabilityConsoleView } from '../contracts/CapabilityConsoleContract.js';
import { ZavorthNaturalSetupAssistantService } from './ZavorthNaturalSetupAssistantService.js';
import {
  ZavorthCapabilityConsoleService,
  type ZavorthCapabilityConsoleRuntime,
} from './ZavorthCapabilityConsoleService.js';

import { ZavorthCapabilitySetupExecutorService } from './ZavorthCapabilitySetupExecutorService.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthCapabilityNaturalOperatorRuntime = ZavorthCapabilityConsoleRuntime;

const SECRET_PATTERNS: RegExp[] = [
  /\bxox[baprs]-[A-Za-z0-9-]{8}\b/g,
  /\bsk-[A-Za-z0-9_-]{12}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12}\b/g,
  /\bAIza[0-9A-Za-z_-]{12}\b/g,
  /\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{16}\b/g,
  /\b(?:token|api[_ -]?key|secret|password)\s*[:=]\s*([^\s,;]+)/gi,
];

export class ZavorthCapabilityNaturalOperatorService {
  private readonly now: () => Date;
  private readonly naturalSetup: ZavorthNaturalSetupAssistantService;
  private readonly console: ZavorthCapabilityConsoleService;
  private readonly queue: ZavorthCapabilitySetupQueueService;
  private readonly executor: ZavorthCapabilitySetupExecutorService;

  constructor(runtime: ZavorthCapabilityNaturalOperatorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.naturalSetup = new ZavorthNaturalSetupAssistantService(runtime);
    this.console = new ZavorthCapabilityConsoleService(runtime);
    this.queue = new ZavorthCapabilitySetupQueueService(runtime);
    this.executor = new ZavorthCapabilitySetupExecutorService(runtime);
  }

  public execute(input: CapabilityNaturalOperatorInput): CapabilityNaturalOperatorResult {
    const text = this.redact(String(input.text || '').trim());
    const naturalSetup = this.naturalSetup.buildSnapshot({
      text,
      actorLabel: input.actorLabel || null,
      preferredCapabilityId: input.targetItemId || null,
      approvalId: input.ownerApprovalId || null,
    });
    const decision = this.decide(input, naturalSetup.selectedCapability, text);
    const createdTicket =
      decision.action === 'create_setup_ticket'
        ? this.createOrReuseTicket({
            ticketId: input.ticketId || null,
            text,
            actorLabel: input.actorLabel || null,
            packId: decision.packId,
            targetItemId: decision.targetItemId,
            availableSecretRefs: input.availableSecretRefs,
            availableEnvKeys: input.availableEnvKeys,
            availableBinaries: input.availableBinaries,
            completedManualSteps: input.completedManualSteps,
            completedReadinessChecks: input.completedReadinessChecks,
            localRoutes: input.localRoutes,
          })
        : null;
    const executorResult =
      decision.action === 'prepare_activation_request' && decision.ticketId
        ? this.executor.execute({
            ticketId: decision.ticketId,
            actorLabel: input.actorLabel || null,
            ownerApprovalId: input.ownerApprovalId || null,
            confirmOwnerControlledActivation: input.confirmOwnerControlledActivation === true,
            dryRun: input.execute !== true,
          })
        : null;
    const consoleSnapshot = this.console.buildSnapshot({
      view: this.viewForAction(decision.action),
      query: naturalSetup.detectedIntent.targetText || text,
      packId: decision.packId,
      targetItemId: decision.targetItemId,
      status: decision.action === 'show_queue' ? 'open' : null,
      availableSecretRefs: input.availableSecretRefs,
      availableEnvKeys: input.availableEnvKeys,
      availableBinaries: input.availableBinaries,
      completedManualSteps: input.completedManualSteps,
      completedReadinessChecks: input.completedReadinessChecks,
      localRoutes: input.localRoutes,
    });

    return {
      contractVersion: CAPABILITY_NATURAL_OPERATOR_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      decision,
      naturalSetup,
      console: consoleSnapshot,
      createdTicket,
      executorResult,
      safety: {
        rawSecretsSerialized: false,
        liveActivationApplied: false,
        ownerApprovalBeforeLive: true,
        naturalLanguageMayOnlyPlan: true,
      },
      reply: this.reply(decision, createdTicket, executorResult),
    };
  }

  public renderReply(input: CapabilityNaturalOperatorInput): string {
    const result = this.execute(input);
    const lines = [
      result.reply.headline,
      '',
      result.reply.body,
      '',
      result.reply.nextAction,
      '',
      `Decision: ${result.decision.action} | target: ${result.decision.targetItemId || 'none'} | pack: ${result.decision.packId || 'none'}`,
    ];
    if (result.createdTicket) {
      lines.push(`Ticket: ${result.createdTicket.id} (${result.createdTicket.status})`);
    }
    if (result.executorResult) {
      lines.push(`Executor: ${result.executorResult.status}`);
    }
    lines.push('Safety: no raw secrets; no live activation from free-text language.');
    return lines.join('\n');
  }

  private createOrReuseTicket(input: Parameters<ZavorthCapabilitySetupQueueService['createTicket']>[0]) {
    try {
      return this.queue.createTicket(input);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      const existingId = /already exists:\s*([^\s]+)/i.exec(message)?.[1] || null;
      if (existingId) {
        const existing = this.queue.getTicket(existingId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  private decide(
    input: CapabilityNaturalOperatorInput,
    selectedCapability: CapabilityHubItem | null,
    _redactedText: string,
  ): CapabilityNaturalOperatorDecision {
    // Free-text keywords never select product actions or pack/target (agent-first purity).
    // Only structured input.action / createTicket / confirmOwnerControlledActivation / ids.
    const ticketId = input.ticketId || null;
    const packId = input.packId || null;
    const targetItemId = input.targetItemId || null;

    const structured = String(input.action || '').trim() as CapabilityNaturalOperatorAction | '';
    if (structured === 'show_queue') {
      return this.decision('show_queue', 0.95, 'Structured show_queue action.', targetItemId, packId, ticketId);
    }
    if (structured === 'run_readiness') {
      return this.decision('run_readiness', 0.95, 'Structured run_readiness action.', targetItemId, packId, ticketId);
    }
    if (structured === 'prepare_activation_request' || (input.confirmOwnerControlledActivation === true && ticketId)) {
      return ticketId
        ? this.decision(
            'prepare_activation_request',
            0.95,
            'Structured activation request for ticket.',
            targetItemId,
            packId,
            ticketId,
          )
        : this.decision('show_queue', 0.7, 'Activation requested without ticketId.', targetItemId, packId, null);
    }
    if (structured === 'create_setup_ticket' || input.createTicket === true) {
      if (!targetItemId && !packId) {
        return this.decision('show_console', 0.55, 'Structured setup without target or pack.', null, packId, ticketId);
      }
      if (input.createTicket === false) {
        return this.decision(
          'show_console',
          0.72,
          'createTicket disabled by structured flag.',
          targetItemId,
          packId,
          ticketId,
        );
      }
      return this.decision(
        'create_setup_ticket',
        0.95,
        'Structured create_setup_ticket action.',
        targetItemId,
        packId,
        ticketId,
      );
    }
    if (structured === 'blocked') {
      return this.decision('blocked', 0.95, 'Structured blocked action.', targetItemId, packId, ticketId);
    }
    if (targetItemId || packId || ticketId) {
      return this.decision(
        'show_console',
        0.72,
        'Structured resource context; show console (no free-text action routing).',
        targetItemId,
        packId,
        ticketId,
      );
    }
    return this.decision(
      'show_console',
      0.5,
      'Safe console fallback; free text does not select capability actions.',
      null,
      null,
      ticketId,
    );
  }

  private decision(
    action: CapabilityNaturalOperatorAction,
    confidence: number,
    reason: string,
    targetItemId: string | null,
    packId: string | null,
    ticketId: string | null,
  ): CapabilityNaturalOperatorDecision {
    return {
      action,
      confidence,
      reason,
      targetItemId,
      packId,
      ticketId,
    };
  }

  private viewForAction(action: CapabilityNaturalOperatorAction): CapabilityConsoleView {
    if (action === 'show_queue' || action === 'create_setup_ticket') {
      return 'queue';
    }
    if (action === 'prepare_activation_request') {
      return 'requests';
    }
    if (action === 'run_readiness') {
      return 'readiness';
    }
    return 'overview';
  }

  private reply(
    decision: CapabilityNaturalOperatorDecision,
    ticket: ReturnType<ZavorthCapabilitySetupQueueService['getTicket']>,
    executorResult: ReturnType<ZavorthCapabilitySetupExecutorService['execute']> | null,
  ): CapabilityNaturalOperatorResult['reply'] {
    if (decision.action === 'create_setup_ticket' && ticket) {
      return {
        headline: 'Created a setup ticket.',
        body: `Ticket ${ticket.id} stored setup for ${ticket.targetItemId || 'resource'} and has not activated anything live.`,
        nextAction: 'Provide secure inputs or open the console for the next step.',
      };
    }
    if (decision.action === 'prepare_activation_request' && executorResult) {
      return {
        headline: executorResult.narrative.headline,
        body: executorResult.narrative.nextAction,
        nextAction:
          executorResult.status === 'activation_request_created'
            ? 'Request recorded; use the ledger for audit and controlled handoff.'
            : 'Provide explicit owner approval and confirm before creating the request.',
      };
    }
    if (decision.action === 'run_readiness') {
      return {
        headline: 'Showed readiness verification.',
        body: 'Readiness is presence-only: it checks references and steps without reading secret values.',
        nextAction: 'Resolve the first pending item before requesting controlled activation.',
      };
    }
    if (decision.action === 'show_queue') {
      return {
        headline: 'Showed the setup queue.',
        body: 'The queue lists open, ready, and closed tickets without executing anything.',
        nextAction: 'Pick an open or ready ticket to continue.',
      };
    }
    return {
      headline: 'Showed the Capability Hub console.',
      body: 'Use this view to pick a resource, pack, readiness, or queue.',
      nextAction:
        'Pass a structured action (create_setup_ticket, run_readiness, show_queue) — free text does not select actions.',
    };
  }

  private inferPackId(selectedCapability: CapabilityHubItem | null, targetItemId: string | null): string | null {
    const id =
      `${selectedCapability?.kind || ''}:${targetItemId || selectedCapability?.id || ''}:${selectedCapability?.label || ''}`.toLowerCase();
    if (
      id.includes('slack') ||
      id.includes('discord') ||
      id.includes('telegram') ||
      id.includes('matrix') ||
      id.includes('channel')
    ) {
      return 'official-communication-channels';
    }
    if (
      id.includes('gemini') ||
      id.includes('openai') ||
      id.includes('ollama') ||
      id.includes('provider') ||
      id.includes('model')
    ) {
      return 'official-ai-access';
    }
    if (id.includes('bridge') || id.includes('sidecar') || id.includes('filesystem') || id.includes('mcp')) {
      return 'official-tool-bridges';
    }
    if (
      id.includes('skill') ||
      id.includes('brief') ||
      id.includes('readiness') ||
      id.includes('maintenance') ||
      id.includes('triage')
    ) {
      return 'official-ops-skills';
    }
    return null;
  }

  private canonicalTargetForPack(
    packId: string | null,
    selectedCapability: CapabilityHubItem | null,
    fallback: string | null,
    sourceText: string = '',
  ): string | null {
    const value =
      `${sourceText}:${fallback || ''}:${selectedCapability?.label || ''}:${selectedCapability?.tags.join(' ') || ''}`.toLowerCase();
    if (packId === 'official-communication-channels') {
      if (value.includes('slack')) {
        return 'channel:slack';
      }
      if (value.includes('discord')) {
        return 'channel:discord';
      }
      if (value.includes('telegram')) {
        return 'channel:telegram';
      }
      if (value.includes('matrix')) {
        return 'channel:matrix';
      }
    }
    if (packId === 'official-ai-access') {
      if (value.includes('gemini')) {
        return 'provider:gemini';
      }
      if (value.includes('openai')) {
        return 'provider:openai-compatible';
      }
      if (value.includes('ollama')) {
        return 'provider:ollama-local';
      }
      if (value.includes('lm-studio') || value.includes('lm studio')) {
        return 'provider:lm-studio-local';
      }
    }
    if (packId === 'official-ops-skills') {
      if (value.includes('zavorth-pulse') || value.includes('zavorth pulse') || value.includes('pulse')) {
        return 'skill:zavorth-pulse';
      }
      if (value.includes('issue-triage') || value.includes('issue triage')) {
        return 'skill:issue-triage';
      }
      if (value.includes('release-readiness') || value.includes('release readiness')) {
        return 'skill:release-readiness';
      }
      if (value.includes('workspace-maintenance') || value.includes('workspace maintenance')) {
        return 'skill:workspace-maintenance';
      }
    }
    return fallback;
  }

  private redact(value: string): string {
    return SECRET_PATTERNS.reduce(
      (current, pattern) =>
        current.replace(pattern, (...args: unknown[]) => {
          const match = String(args[0] || '');
          const captured = args.length > 3 && typeof args[1] === 'string' ? args[1] : null;
          if (captured) {
            return match.replace(captured, '[SECRET_REDACTED]');
          }
          return '[SECRET_REDACTED]';
        }),
      value,
    );
  }
}
