import {
  ProjectErrorClassifier,
  type ProjectErrorClassification,
} from './ProjectErrorClassifier.js';
import {
  ProjectHookPolicy,
  type ProjectHookPolicyDecision,
} from './ProjectHookPolicy.js';
import type {
  ProjectManifestHook,
  ProjectManifestMode,
  ResolvedProjectManifest,
} from './ProjectManifestContract.js';
import type { ProjectProcessLogEntry } from './ProjectProcessContract.js';
import type { AgentRunExecutionOptions } from '../runtime/agent/AgentRunService.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRunResult,
} from '../runtime/agent/UniversalAgentRuntimeTypes.js';export type ProjectLogWatchEventStatus =
  | 'recorded'
  | 'deduped'
  | 'rate_limited'
  | 'agent_run_created'
  | 'agent_run_unavailable'
  | 'agent_run_failed'
  | 'blocked'
  | 'manual_required';

export type ProjectLogWatchAgentGateway = {
  handle(
    input: UniversalAgentRequest,
    options?: AgentRunExecutionOptions,
  ): Promise<UniversalAgentRunResult>;
};

export type ProjectLogWatchSupervisor = {
  on(event: 'process:log', handler: (log: ProjectProcessLogEntry) => void): unknown;
  off?(event: 'process:log', handler: (log: ProjectProcessLogEntry) => void): unknown;
  removeListener?(event: 'process:log', handler: (log: ProjectProcessLogEntry) => void): unknown;
};

export type ProjectLogWatchBinding = {
  manifestPath: string;
  detach(): void;
};

export type ProjectLogWatchLogReceipt = {
  id: string;
  sequence: number;
  processId: string;
  stream: ProjectProcessLogEntry['stream'];
  timestamp: string;
  textSnippet: string;
};

export type ProjectLogWatchAuditReceipt = {
  id: string;
  manifestPath: string;
  projectName: string;
  hookId: string;
  processId: string;
  mode: ProjectManifestMode;
  matchedPattern: string;
  dedupeKey: string;
  duplicateCount: number;
  rateLimited: boolean;
  reason: string;
  tags: string[];
  createdAt: string;
};

export type ProjectLogWatchEvent = {
  id: string;
  manifestPath: string;
  projectRoot: string;
  projectName: string;
  hookId: string;
  processId: string;
  mode: ProjectManifestMode;
  status: ProjectLogWatchEventStatus;
  createdAt: string;
  updatedAt: string;
  classification: ProjectErrorClassification;
  policyDecision: ProjectHookPolicyDecision;
  log: ProjectLogWatchLogReceipt;
  audit: ProjectLogWatchAuditReceipt;
  agentRunId: string | null;
  agentRunStatus: string | null;
  error: string | null;
};

export type ProjectLogWatchInspectionResult = {
  matched: boolean;
  status: ProjectLogWatchEventStatus;
  event: ProjectLogWatchEvent | null;
};

export type ProjectLogWatchSnapshot = {
  generatedAt: string;
  summary: {
    events: number;
    suggestions: number;
    blocked: number;
    manualRequired: number;
    rateLimited: number;
    lastEventAt: string | null;
  };
  events: ProjectLogWatchEvent[];
};

export type ProjectLogWatchServiceOptions = {
  classifier?: ProjectErrorClassifier;
  hookPolicy?: ProjectHookPolicy;
  agentGateway?: ProjectLogWatchAgentGateway | null;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  dedupeWindowMs?: number;
  rateLimitWindowMs?: number;
  maxEventsPerHookWindow?: number;
  maxEvents?: number;
};

type RateBucket = {
  windowStartedAtMs: number;
  count: number;
};

type DedupeEntry = {
  eventId: string;
  lastSeenAtMs: number;
  count: number;
};

const DEFAULT_DEDUPE_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MAX_EVENTS_PER_HOOK_WINDOW = 5;
const DEFAULT_MAX_EVENTS = 200;

export class ProjectLogWatchService {
  private readonly classifier: ProjectErrorClassifier;
  private readonly hookPolicy: ProjectHookPolicy;
  private readonly agentGateway: ProjectLogWatchAgentGateway | null;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly dedupeWindowMs: number;
  private readonly rateLimitWindowMs: number;
  private readonly maxEventsPerHookWindow: number;
  private readonly maxEvents: number;
  private readonly events: ProjectLogWatchEvent[] = [];
  private readonly dedupeIndex = new Map<string, DedupeEntry>();
  private readonly rateBuckets = new Map<string, RateBucket>();
  private readonly supervisorBindings = new WeakMap<object, Map<string, ProjectLogWatchBinding>>();

  constructor(options: ProjectLogWatchServiceOptions = {}) {
    this.classifier = options.classifier || new ProjectErrorClassifier();
    this.hookPolicy = options.hookPolicy || new ProjectHookPolicy();
    this.agentGateway = options.agentGateway || null;
    this.now = options.now || (() => new Date());
    this.idFactory = options.idFactory || defaultIdFactory;
    this.dedupeWindowMs = Math.max(1000, options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS);
    this.rateLimitWindowMs = Math.max(1000, options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS);
    this.maxEventsPerHookWindow = Math.max(1, options.maxEventsPerHookWindow ?? DEFAULT_MAX_EVENTS_PER_HOOK_WINDOW);
    this.maxEvents = Math.max(1, options.maxEvents ?? DEFAULT_MAX_EVENTS);
  }

  public bindSupervisor(
    supervisor: ProjectLogWatchSupervisor,
    resolved: ResolvedProjectManifest,
  ): ProjectLogWatchBinding {
    const supervisorKey = supervisor as object;
    const existingBindings = this.supervisorBindings.get(supervisorKey) || new Map<string, ProjectLogWatchBinding>();
    const existing = existingBindings.get(resolved.manifestPath);
    if (existing) {
      return existing;
    }

    const handler = (log: ProjectProcessLogEntry) => {
      void this.inspectLog({ resolved, log }).catch((error: unknown) => {
        this.recordInternalError(resolved, log, error);
      });
    };
    supervisor.on('process:log', handler);
    const binding: ProjectLogWatchBinding = {
      manifestPath: resolved.manifestPath,
      detach: () => {
        if (typeof supervisor.off === 'function') {
          supervisor.off('process:log', handler);
        } else {
          supervisor.removeListener?.('process:log', handler);
        }
        existingBindings.delete(resolved.manifestPath);
      },
    };
    existingBindings.set(resolved.manifestPath, binding);
    this.supervisorBindings.set(supervisorKey, existingBindings);
    return binding;
  }

  public async inspectLog(input: {
    resolved: ResolvedProjectManifest;
    log: ProjectProcessLogEntry;
  }): Promise<ProjectLogWatchInspectionResult[]> {
    const hooks = this.matchHooks(input.resolved, input.log);
    if (hooks.length === 0) {
      return [{
        matched: false,
        status: 'recorded',
        event: null,
      }];
    }

    const results: ProjectLogWatchInspectionResult[] = [];
    for (const hook of hooks) {
      results.push(await this.handleMatchedHook(input.resolved, hook, input.log));
    }
    return results;
  }

  public async inspectLogs(input: {
    resolved: ResolvedProjectManifest;
    logs: ProjectProcessLogEntry[];
  }): Promise<ProjectLogWatchInspectionResult[]> {
    const results: ProjectLogWatchInspectionResult[] = [];
    for (const log of input.logs) {
      results.push(...await this.inspectLog({ resolved: input.resolved, log }));
    }
    return results;
  }

  public listEvents(options: {
    manifestPath?: string | null;
    processId?: string | null;
    limit?: number | null;
  } = {}): ProjectLogWatchEvent[] {
    const manifestPath = normalizeText(options.manifestPath);
    const processId = normalizeText(options.processId);
    const limit = Math.max(1, Number(options.limit || this.maxEvents));
    return this.events
      .filter((event) => !manifestPath || event.manifestPath === manifestPath)
      .filter((event) => !processId || event.processId === processId)
      .slice(-limit)
      .map((event) => cloneEvent(event));
  }

  public buildSnapshot(options: {
    resolved?: ResolvedProjectManifest | null;
    limit?: number | null;
  } = {}): ProjectLogWatchSnapshot {
    const events = this.listEvents({
      manifestPath: options.resolved?.manifestPath || null,
      limit: options.limit ?? 20,
    });
    const lastEventAt = events.length > 0 ? events[events.length - 1].createdAt : null;
    return {
      generatedAt: this.nowIso(),
      summary: {
        events: events.length,
        suggestions: events.filter((event) => (
          event.status === 'agent_run_created' || event.status === 'agent_run_unavailable'
        )).length,
        blocked: events.filter((event) => event.status === 'blocked').length,
        manualRequired: events.filter((event) => event.status === 'manual_required').length,
        rateLimited: events.filter((event) => event.status === 'rate_limited').length,
        lastEventAt,
      },
      events,
    };
  }

  private async handleMatchedHook(
    resolved: ResolvedProjectManifest,
    hook: ProjectManifestHook,
    log: ProjectProcessLogEntry,
  ): Promise<ProjectLogWatchInspectionResult> {
    const classification = this.classifier.classify({ resolved, hook, log });
    const policyDecision = this.hookPolicy.evaluate({ resolved, hook, log, classification });
    const dedupeKey = this.buildDedupeKey(resolved, hook, log, classification);
    const duplicate = this.findFreshDuplicate(dedupeKey);
    if (duplicate) {
      duplicate.audit.duplicateCount += 1;
      duplicate.audit.reason = `${duplicate.policyDecision.reason} Evento repetido deduplicado.`;
      duplicate.updatedAt = this.nowIso();
      this.dedupeIndex.set(dedupeKey, {
        eventId: duplicate.id,
        lastSeenAtMs: this.nowMs(),
        count: duplicate.audit.duplicateCount,
      });
      return {
        matched: true,
        status: 'deduped',
        event: cloneEvent(duplicate),
      };
    }

    if (!this.consumeRateLimit(resolved, hook)) {
      const event = this.createEvent({
        resolved,
        hook,
        log,
        classification,
        policyDecision,
        dedupeKey,
        status: 'rate_limited',
        rateLimited: true,
      });
      this.storeEvent(event, dedupeKey);
      return {
        matched: true,
        status: event.status,
        event: cloneEvent(event),
      };
    }

    const event = this.createEvent({
      resolved,
      hook,
      log,
      classification,
      policyDecision,
      dedupeKey,
      status: this.initialStatusFor(policyDecision),
      rateLimited: false,
    });
    this.storeEvent(event, dedupeKey);

    if (policyDecision.allowed && policyDecision.action === 'create-agent-run') {
      await this.createAgentRunForEvent(event, resolved, hook, log, classification);
    }

    return {
      matched: true,
      status: event.status,
      event: cloneEvent(event),
    };
  }

  private async createAgentRunForEvent(
    event: ProjectLogWatchEvent,
    resolved: ResolvedProjectManifest,
    hook: ProjectManifestHook,
    log: ProjectProcessLogEntry,
    classification: ProjectErrorClassification,
  ): Promise<void> {
    if (!this.agentGateway) {
      event.status = 'agent_run_unavailable';
      event.updatedAt = this.nowIso();
      return;
    }

    try {
      const result = await this.agentGateway.handle(this.buildAgentRunRequest(
        event,
        resolved,
        hook,
        log,
        classification,
      ));
      event.agentRunId = result.run.id;
      event.agentRunStatus = result.run.status;
      event.status = 'agent_run_created';
      event.updatedAt = this.nowIso();
    } catch (error: unknown) {event.status = 'agent_run_failed';
      event.error = errorMessage(error);
      event.updatedAt = this.nowIso();
    }
  }

  private buildAgentRunRequest(
    event: ProjectLogWatchEvent,
    resolved: ResolvedProjectManifest,
    hook: ProjectManifestHook,
    log: ProjectProcessLogEntry,
    classification: ProjectErrorClassification,
  ): UniversalAgentRequest {
    const text = [
      classification.suggestedPrompt,
      '',
      'Contexto do Log Watch:',
      `- Evento: ${event.id}`,
      `- Hook: ${hook.id}`,
      `- Modo: ${hook.action.mode}`,
      `- Policy: ${event.policyDecision.reason}`,
      `- Log ID: ${log.id}`,
      '',
      'Entregue diagnostico, plano e proposta de acao. Nao aplique mudancas sensiveis sem approval.',
    ].join('\n');

    return {
      requestId: this.idFactory('project-log-watch-request'),
      traceId: event.audit.id,
      userId: 'project-log-watch',
      sessionId: `project-log-watch:${resolved.manifest.project.name}:${log.processId}`,
      channel: 'api',
      text,
      workspace: resolved.projectRoot,
      metadata: {
        source: 'project-log-watch',
        manifestPath: resolved.manifestPath,
        projectName: resolved.manifest.project.name,
        hookId: hook.id,
        processId: log.processId,
        eventId: event.id,
        mode: hook.action.mode,
        classification: {
          category: classification.category,
          severity: classification.severity,
          risk: classification.risk,
          signals: classification.signals,
        },
        policyDecision: {
          action: event.policyDecision.action,
          allowed: event.policyDecision.allowed,
          requiresApproval: event.policyDecision.requiresApproval,
          blockedScopes: event.policyDecision.blockedScopes,
        },
      },
    };
  }

  private matchHooks(
    resolved: ResolvedProjectManifest,
    log: ProjectProcessLogEntry,
  ): ProjectManifestHook[] {
    if (log.stream === 'system' && /^\[process:(?:start|restart)\]/i.test(log.text)) {
      return [];
    }
    return resolved.manifest.hooks.filter((hook) => (
      hook.when.process === log.processId && matchesPattern(log.text, hook.when.pattern)
    ));
  }

  private createEvent(input: {
    resolved: ResolvedProjectManifest;
    hook: ProjectManifestHook;
    log: ProjectProcessLogEntry;
    classification: ProjectErrorClassification;
    policyDecision: ProjectHookPolicyDecision;
    dedupeKey: string;
    status: ProjectLogWatchEventStatus;
    rateLimited: boolean;
  }): ProjectLogWatchEvent {
    const now = this.nowIso();
    const id = this.idFactory('project-log-watch-event');
    const auditId = this.idFactory('project-log-watch-audit');
    return {
      id,
      manifestPath: input.resolved.manifestPath,
      projectRoot: input.resolved.projectRoot,
      projectName: input.resolved.manifest.project.name,
      hookId: input.hook.id,
      processId: input.log.processId,
      mode: input.hook.action.mode,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      classification: input.classification,
      policyDecision: input.policyDecision,
      log: {
        id: input.log.id,
        sequence: input.log.sequence,
        processId: input.log.processId,
        stream: input.log.stream,
        timestamp: input.log.timestamp,
        textSnippet: redactLogText(input.log.text).slice(0, 500),
      },
      audit: {
        id: auditId,
        manifestPath: input.resolved.manifestPath,
        projectName: input.resolved.manifest.project.name,
        hookId: input.hook.id,
        processId: input.log.processId,
        mode: input.hook.action.mode,
        matchedPattern: input.hook.when.pattern,
        dedupeKey: input.dedupeKey,
        duplicateCount: 1,
        rateLimited: input.rateLimited,
        reason: input.policyDecision.reason,
        tags: [...input.policyDecision.auditTags],
        createdAt: now,
      },
      agentRunId: null,
      agentRunStatus: null,
      error: null,
    };
  }

  private initialStatusFor(decision: ProjectHookPolicyDecision): ProjectLogWatchEventStatus {
    if (decision.action === 'record-only') {
      return 'recorded';
    }
    if (decision.action === 'manual') {
      return 'manual_required';
    }
    if (decision.action === 'blocked') {
      return 'blocked';
    }
    return 'recorded';
  }

  private storeEvent(event: ProjectLogWatchEvent, dedupeKey: string): void {
    this.events.push(event);
    this.dedupeIndex.set(dedupeKey, {
      eventId: event.id,
      lastSeenAtMs: this.nowMs(),
      count: event.audit.duplicateCount,
    });
    if (this.events.length > this.maxEvents) {
      const removed = this.events.splice(0, this.events.length - this.maxEvents);
      for (const eventToRemove of removed) {
        const entry = this.dedupeIndex.get(eventToRemove.audit.dedupeKey);
        if (entry?.eventId === eventToRemove.id) {
          this.dedupeIndex.delete(eventToRemove.audit.dedupeKey);
        }
      }
    }
  }

  private findFreshDuplicate(dedupeKey: string): ProjectLogWatchEvent | null {
    const entry = this.dedupeIndex.get(dedupeKey);
    if (!entry) {
      return null;
    }
    if (this.nowMs() - entry.lastSeenAtMs > this.dedupeWindowMs) {
      this.dedupeIndex.delete(dedupeKey);
      return null;
    }
    return this.events.find((event) => event.id === entry.eventId) || null;
  }

  private consumeRateLimit(
    resolved: ResolvedProjectManifest,
    hook: ProjectManifestHook,
  ): boolean {
    const key = `${resolved.manifestPath}:${hook.id}`;
    const nowMs = this.nowMs();
    const bucket = this.rateBuckets.get(key);
    if (!bucket || nowMs - bucket.windowStartedAtMs > this.rateLimitWindowMs) {
      this.rateBuckets.set(key, {
        windowStartedAtMs: nowMs,
        count: 1,
      });
      return true;
    }
    if (bucket.count >= this.maxEventsPerHookWindow) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  private buildDedupeKey(
    resolved: ResolvedProjectManifest,
    hook: ProjectManifestHook,
    log: ProjectProcessLogEntry,
    classification: ProjectErrorClassification,
  ): string {
    return [
      resolved.manifestPath,
      hook.id,
      log.processId,
      classification.category,
      stableHash(normalizeForDedupe(log.text)),
    ].join(':');
  }

  private recordInternalError(
    resolved: ResolvedProjectManifest,
    log: ProjectProcessLogEntry,
    error: unknown,
  ): void {
    const now = this.nowIso();
    const classification: ProjectErrorClassification = {
      category: 'generic_error',
      severity: 'error',
      risk: 'medium',
      summary: 'ProjectLogWatchService falhou ao processar um log.',
      signals: ['project-log-watch-error'],
      confidence: 1,
      autoApplySafe: false,
      suggestedPrompt: 'Investigue a falha interna do ProjectLogWatchService.',
    };
    const policyDecision: ProjectHookPolicyDecision = {
      allowed: false,
      mode: resolved.manifest.policy.defaultMode,
      action: 'blocked',
      reason: errorMessage(error),
      requiresApproval: true,
      risk: 'medium',
      blockedScopes: ['project-log-watch.internal-error'],
      auditTags: ['project-log-watch', 'internal-error'],
    };
    const event: ProjectLogWatchEvent = {
      id: this.idFactory('project-log-watch-event'),
      manifestPath: resolved.manifestPath,
      projectRoot: resolved.projectRoot,
      projectName: resolved.manifest.project.name,
      hookId: 'internal-error',
      processId: log.processId,
      mode: resolved.manifest.policy.defaultMode,
      status: 'agent_run_failed',
      createdAt: now,
      updatedAt: now,
      classification,
      policyDecision,
      log: {
        id: log.id,
        sequence: log.sequence,
        processId: log.processId,
        stream: log.stream,
        timestamp: log.timestamp,
        textSnippet: redactLogText(log.text).slice(0, 500),
      },
      audit: {
        id: this.idFactory('project-log-watch-audit'),
        manifestPath: resolved.manifestPath,
        projectName: resolved.manifest.project.name,
        hookId: 'internal-error',
        processId: log.processId,
        mode: resolved.manifest.policy.defaultMode,
        matchedPattern: '',
        dedupeKey: `${resolved.manifestPath}:internal-error:${log.id}`,
        duplicateCount: 1,
        rateLimited: false,
        reason: errorMessage(error),
        tags: ['project-log-watch', 'internal-error'],
        createdAt: now,
      },
      agentRunId: null,
      agentRunStatus: null,
      error: errorMessage(error),
    };
    this.events.push(event);
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private nowMs(): number {
    return this.now().getTime();
  }
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function matchesPattern(text: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch (error: unknown) {return normalizeText(text).toLowerCase().includes(normalizeText(pattern).toLowerCase());
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeForDedupe(value: unknown): string {
  return normalizeText(value)
    .replace(/\d{2,}/g, '#')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function redactLogText(text: string): string {
  return String(text || '')
    .replace(/\b((?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY|AUTHORIZATION)[A-Z0-9_]*)\s*=\s*)(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]')
    .replace(/(--(?:token|secret|password|passwd|api-key|apikey|authorization)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

function cloneEvent(event: ProjectLogWatchEvent): ProjectLogWatchEvent {
  return {
    ...event,
    classification: {
      ...event.classification,
      signals: [...event.classification.signals],
    },
    policyDecision: {
      ...event.policyDecision,
      blockedScopes: [...event.policyDecision.blockedScopes],
      auditTags: [...event.policyDecision.auditTags],
    },
    log: { ...event.log },
    audit: {
      ...event.audit,
      tags: [...event.audit.tags],
    },
  };
}
