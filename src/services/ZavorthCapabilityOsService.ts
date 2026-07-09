import type {
  CapabilityDefinition,
  CapabilityDispatchMode,
  CapabilityPolicy,
  CapabilitySummary,
  CapabilityType,
} from '../contracts/CapabilityContract.js';
import {
  getDefaultCapabilityRegistry,
  type CapabilityRegistry,
} from '../capabilities/CapabilityRegistry.js';
import { TrustPlanePolicyLedgerService } from './TrustPlanePolicyLedgerService.js';
import type { TrustPlanePolicyLedgerEntry } from './TrustPlanePolicyLedgerService.js';
import { logger } from '../logger.js';

type CapabilityRegistryLike = Pick<
  CapabilityRegistry,
  'findByCommand' | 'getAll' | 'getSummary' | 'matchImplicit'
>;

export type ZavorthCapabilityOsRiskLevel = 'low' | 'medium' | 'high';
export type ZavorthCapabilityOsHealth = 'ready' | 'needs_approval' | 'dormant' | 'disabled';

export type ZavorthCapabilityOsManifest = {
  id: string;
  label: string;
  type: CapabilityType;
  source: 'builtin' | 'plugin';
  enabled: boolean;
  intent: string;
  dispatchMode: CapabilityDispatchMode;
  executorPreference: string | null;
  command: string | null;
  aliases: string[];
  matcherCount: number;
  allowedCommandTypes: string[];
  risk: {
    level: ZavorthCapabilityOsRiskLevel;
    reason: string;
  };
  permissions: {
    requiresApproval: boolean;
    policySource: 'manifest' | 'inferred';
    scopes: string[];
    networkScope: CapabilityPolicy['networkScope'];
    allowedHosts: string[];
  };
  artifacts: {
    kinds: string[];
  };
  lifecycle: CapabilityPolicy['lifecycle'];
  health: {
    status: ZavorthCapabilityOsHealth;
    reason: string;
  };
  fallback: {
    chain: string[];
    reason: string;
  };
  routing: {
    reason: string;
    confidence: number | null;
    requiresPlanning: boolean;
    workspaceHint: string | null;
  };
};

export type ZavorthCapabilityOsRouteDecision = {
  phase: '26';
  surface: 'capability-route';
  generatedAt: string;
  input: string;
  commandType: string;
  selected: ZavorthCapabilityOsManifest | null;
  fallbackChain: string[];
  decision: {
    intent: string;
    dispatchMode: CapabilityDispatchMode | 'conversation';
    executorPreference: string | null;
    reason: string;
    confidence: number;
    requiresApproval: boolean;
    riskLevel: ZavorthCapabilityOsRiskLevel;
  };
  ledger: {
    recorded: boolean;
    entryId: string | null;
    status: TrustPlanePolicyLedgerEntry['status'] | null;
    reason: string;
  };
};

export type ZavorthCapabilityOsSnapshot = {
  generatedAt: string;
  phase: '26';
  surface: 'capability-os';
  summary: CapabilitySummary & {
    byType: Record<CapabilityType, number>;
    approvalRequired: number;
    highRisk: number;
    dormant: number;
    mcpAllowlisted: number;
  };
  manifests: ZavorthCapabilityOsManifest[];
  mcpAllowlist: Array<{
    id: string;
    label: string;
    command: string | null;
    health: ZavorthCapabilityOsHealth;
  }>;
  mcpHost: {
    mode: 'local-allowlist';
    folderScope: 'workspace';
    secrets: 'redacted';
    serverAllowlist: string[];
    reason: string;
  };
  fallbackMatrix: Record<string, string[]>;
  examples: ZavorthCapabilityOsRouteDecision[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

type ZavorthCapabilityOsRuntime = {
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  ledgerService?: Pick<TrustPlanePolicyLedgerService, 'append'> | null;
};

const FALLBACK_MATRIX: Record<string, string[]> = {
  codex: ['local_executor', 'conversation'],
  external_executor: ['codex', 'local_executor', 'conversation'],
  zavorthBridge: ['codex', 'conversation'],
  stitch: ['codex', 'conversation'],
  aistudio: ['gemini_cli', 'conversation'],
  jules: ['codex', 'conversation'],
  gemini_cli: ['codex', 'conversation'],
  web_research: ['research', 'conversation'],
  'workflow:review': ['external_executor', 'codex', 'conversation'],
  'workflow:ship': ['codex', 'conversation'],
  planner: ['codex', 'conversation'],
  local_executor: ['conversation'],
  none: ['conversation'],
};

const DEFAULT_ROUTE_EXAMPLES = [
  'pesquise noticias de IA de hoje na web',
  'gere uma landing page moderna com hero e CTA',
  'investigue esse bug no projeto e revise o codigo',
  'corrija src/app.ts e rode os testes',
];

export class ZavorthCapabilityOsService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly ledgerService: Pick<TrustPlanePolicyLedgerService, 'append'> | null;

  constructor(runtime: ZavorthCapabilityOsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.ledgerService = runtime.ledgerService === undefined
      ? new TrustPlanePolicyLedgerService()
      : runtime.ledgerService;
  }

  public buildSnapshot(): ZavorthCapabilityOsSnapshot {
    const manifests = this.capabilityRegistry.getAll().map((capability) =>
      this.toManifest(capability));
    const summary = this.capabilityRegistry.getSummary();
    const byType = this.countByType(manifests);
    const mcpAllowlist = this.buildMcpAllowlist(manifests);
    const examples = DEFAULT_ROUTE_EXAMPLES.map((example) =>
      this.explainRoute(example, { commandType: '/task', writeLedger: false }));
    const mcpHost = this.buildMcpHost(mcpAllowlist);

    return {
      generatedAt: this.now().toISOString(),
      phase: '26',
      surface: 'capability-os',
      summary: {
        ...summary,
        byType,
        approvalRequired: manifests.filter((manifest) => manifest.permissions.requiresApproval).length,
        highRisk: manifests.filter((manifest) => manifest.risk.level === 'high').length,
        dormant: manifests.filter((manifest) => manifest.health.status === 'dormant').length,
        mcpAllowlisted: mcpAllowlist.length,
      },
      manifests,
      mcpAllowlist,
      mcpHost,
      fallbackMatrix: { ...FALLBACK_MATRIX },
      examples,
      narrative: this.buildNarrative(summary, manifests, mcpAllowlist),
    };
  }

  public explainRoute(
    input: string,
    options: {
      commandType?: string | null;
      requestedBy?: string | null;
      sourceSurface?: string | null;
      writeLedger?: boolean;
    } = {},
  ): ZavorthCapabilityOsRouteDecision {
    const generatedAt = this.now().toISOString();
    const normalizedInput = String(input || '').trim();
    const parsed = this.parseRouteInput(normalizedInput, options.commandType || null);
    const explicit = parsed.isExplicit
      ? this.capabilityRegistry.findByCommand(parsed.commandType)
      : null;
    const implicit = explicit
      ? null
      : this.capabilityRegistry.matchImplicit(parsed.commandType, this.normalizeText(parsed.payload));
    const selected = explicit || implicit;
    const manifest = selected ? this.toManifest(selected) : null;
    const fallbackChain = manifest?.fallback.chain || FALLBACK_MATRIX.none;
    const decision = {
      intent: manifest?.intent || 'hybrid_task',
      dispatchMode: manifest?.dispatchMode || 'conversation',
      executorPreference: manifest?.executorPreference || null,
      reason: manifest
        ? manifest.routing.reason
        : 'Nenhuma capability teve confianca suficiente; o pedido fica no fluxo conversacional.',
      confidence: manifest?.routing.confidence ?? 0.35,
      requiresApproval: manifest?.permissions.requiresApproval || false,
      riskLevel: manifest?.risk.level || 'low',
    };
    const ledger = options.writeLedger === false
      ? {
          recorded: false,
          entryId: null,
          status: null,
          reason: 'Registro omitido porque esta decisao e exemplo, teste ou preview read-only.',
        }
      : this.recordRouteDecision({
          generatedAt,
          input: normalizedInput,
          commandType: parsed.commandType,
          manifest,
          fallbackChain,
          decision,
          requestedBy: options.requestedBy || null,
          sourceSurface: options.sourceSurface || null,
        });

    return {
      phase: '26',
      surface: 'capability-route',
      generatedAt,
      input: normalizedInput,
      commandType: parsed.commandType,
      selected: manifest,
      fallbackChain,
      decision,
      ledger,
    };
  }

  private toManifest(capability: CapabilityDefinition): ZavorthCapabilityOsManifest {
    const policy = capability.policy || null;
    const risk = this.deriveRisk(capability, policy);
    const fallbackChain = this.resolveFallbackChain(capability);
    const permissionScopes = this.resolvePermissionScopes(capability, policy);
    const enabled = capability.enabled !== false;
    const requiresApproval = policy
      ? Boolean(policy.requiresApproval)
      : this.inferRequiresApproval(capability, risk.level);
    const networkScope = policy?.networkScope ?? this.inferNetworkScope(capability);
    const artifactKinds = policy?.artifactKinds || this.inferArtifactKinds(capability);

    return {
      id: capability.id,
      label: capability.label,
      type: capability.type,
      source: capability.source === 'plugin' ? 'plugin' : 'builtin',
      enabled,
      intent: capability.intent,
      dispatchMode: capability.dispatch_mode,
      executorPreference: capability.executor_preference ?? null,
      command: capability.command?.command || null,
      aliases: capability.command?.aliases || [],
      matcherCount: capability.matchers?.length || 0,
      allowedCommandTypes: capability.allowed_command_types || [],
      risk,
      permissions: {
        requiresApproval,
        policySource: policy ? 'manifest' : 'inferred',
        scopes: permissionScopes,
        networkScope,
        allowedHosts: policy?.allowedHosts || [],
      },
      artifacts: {
        kinds: artifactKinds,
      },
      lifecycle: policy?.lifecycle ?? null,
      health: this.deriveHealth(capability, enabled, requiresApproval),
      fallback: {
        chain: fallbackChain,
        reason: fallbackChain.length > 0
          ? `Se ${capability.executor_preference || 'a rota principal'} falhar, tente ${fallbackChain[0]}.`
          : 'Sem fallback automatico alem da conversa supervisionada.',
      },
      routing: {
        reason: capability.routing_reason || capability.description,
        confidence: capability.routing_confidence ?? null,
        requiresPlanning: Boolean(capability.requires_planning),
        workspaceHint: capability.workspace_hint ?? null,
      },
    };
  }

  private deriveRisk(
    capability: CapabilityDefinition,
    policy: CapabilityPolicy | null,
  ): ZavorthCapabilityOsManifest['risk'] {
    const danger = String(policy?.dangerLevel || '').trim().toLowerCase();
    if (danger === 'high' || danger === 'critical') {
      return { level: 'high', reason: `Policy declarou risco ${danger}.` };
    }
    if (danger === 'medium') {
      return { level: 'medium', reason: 'Policy declarou risco medio.' };
    }
    if (policy?.requiresApproval || policy?.networkScope === 'external-policy') {
      return { level: 'high', reason: 'Capability exige aprovacao ou rede externa governada.' };
    }
    if (!policy && this.inferNetworkScope(capability) === 'external-policy') {
      return { level: 'high', reason: 'Capability usa rede externa e recebe guardrail inferido.' };
    }
    if (!policy && this.isSensitiveCapability(capability)) {
      return { level: 'high', reason: 'Capability sensivel sem policy explicita recebe guardrail inferido.' };
    }
    if (capability.type === 'automation' || capability.type === 'workflow' || capability.requires_planning) {
      return { level: 'medium', reason: 'Capability pode encadear acoes ou planejamento.' };
    }
    if (capability.type === 'executor') {
      return { level: 'medium', reason: 'Capability delega trabalho para executor.' };
    }
    return { level: 'low', reason: 'Capability informativa ou de baixo impacto operacional.' };
  }

  private deriveHealth(
    capability: CapabilityDefinition,
    enabled: boolean,
    requiresApproval: boolean,
  ): ZavorthCapabilityOsManifest['health'] {
    if (!enabled) {
      return { status: 'disabled', reason: 'Capability desabilitada no manifesto.' };
    }
    if (requiresApproval) {
      return { status: 'needs_approval', reason: 'Capability pode agir, mas precisa de aprovacao.' };
    }
    if (capability.source === 'plugin') {
      return { status: 'dormant', reason: 'Capability de plugin carregada sob demanda.' };
    }
    if (capability.command?.handler_action === 'mcp_management') {
      return { status: 'dormant', reason: 'MCP e gerenciado por manifesto e sobe sob demanda.' };
    }
    return { status: 'ready', reason: 'Capability registrada e pronta para roteamento.' };
  }

  private resolvePermissionScopes(
    capability: CapabilityDefinition,
    policy: CapabilityPolicy | null,
  ): string[] {
    const scopes = new Set<string>();
    if (policy?.requiresApproval) {
      scopes.add('approval');
    }
    if (!policy && this.inferRequiresApproval(capability, this.deriveRisk(capability, null).level)) {
      scopes.add('approval:inferred');
    }
    const networkScope = policy?.networkScope ?? this.inferNetworkScope(capability);
    if (networkScope) {
      scopes.add(`network:${networkScope}`);
    }
    if (policy?.lifecycle) {
      scopes.add(`lifecycle:${policy.lifecycle}`);
    }
    if (capability.executor_preference) {
      scopes.add(`executor:${capability.executor_preference}`);
    }
    if (capability.dispatch_mode) {
      scopes.add(`dispatch:${capability.dispatch_mode}`);
    }
    if (capability.command?.handler_action === 'mcp_management' || /\bmcp\b/i.test(capability.id)) {
      scopes.add('mcp:allowlisted');
      scopes.add('folder:workspace');
      scopes.add('secrets:redacted');
    }
    return Array.from(scopes).sort();
  }

  private inferRequiresApproval(
    capability: CapabilityDefinition,
    riskLevel: ZavorthCapabilityOsRiskLevel,
  ): boolean {
    if (riskLevel === 'high') {
      return true;
    }
    if (capability.type === 'executor' || capability.type === 'automation' || capability.type === 'workflow') {
      return true;
    }
    return false;
  }

  private inferNetworkScope(capability: CapabilityDefinition): CapabilityPolicy['networkScope'] {
    const executor = String(capability.executor_preference || '').toLowerCase();
    const command = String(capability.command?.command || '').toLowerCase();
    if (
      capability.type === 'research'
      || executor === 'aistudio'
      || executor === 'stitch'
      || executor === 'gemini_cli'
      || executor === 'web_research'
    ) {
      return 'external-policy';
    }
    if (command === '/mcp' || /\bmcp\b/i.test(capability.id)) {
      return 'local';
    }
    if (capability.type === 'executor' || capability.type === 'automation' || capability.type === 'workflow') {
      return 'local';
    }
    return 'none';
  }

  private inferArtifactKinds(capability: CapabilityDefinition): string[] {
    const executor = String(capability.executor_preference || '').toLowerCase();
    if (capability.intent.includes('design') || executor === 'stitch') {
      return ['design', 'screenshot', 'html'];
    }
    if (capability.intent.includes('research') || capability.type === 'research') {
      return ['briefing', 'sources'];
    }
    if (capability.intent.includes('code') || capability.type === 'executor') {
      return ['patch', 'logs', 'test-report'];
    }
    if (capability.type === 'automation') {
      return ['runbook', 'audit-log'];
    }
    return ['report'];
  }

  private isSensitiveCapability(capability: CapabilityDefinition): boolean {
    const handler = String(capability.command?.handler_action || '').trim().toLowerCase();
    return capability.type === 'executor'
      || capability.type === 'automation'
      || capability.type === 'workflow'
      || Boolean(capability.executor_preference)
      || handler === 'mcp_management'
      || handler === 'workflow_named'
      || handler === 'workflow_dynamic';
  }

  private resolveFallbackChain(capability: CapabilityDefinition): string[] {
    const executor = capability.executor_preference || capability.command?.explicit_executor || 'none';
    const direct = FALLBACK_MATRIX[this.resolveFallbackMatrixKey(executor)];
    if (direct) {
      return [...direct];
    }
    if (String(executor).startsWith('workflow:')) {
      return ['codex', 'conversation'];
    }
    return [...FALLBACK_MATRIX.none];
  }

  private resolveFallbackMatrixKey(executor: string): string {
    const normalized = String(executor || '').trim().toLowerCase();
    return normalized;
  }

  private countByType(manifests: ZavorthCapabilityOsManifest[]): Record<CapabilityType, number> {
    const result: Record<CapabilityType, number> = {
      executor: 0,
      workflow: 0,
      research: 0,
      automation: 0,
      integration: 0,
    };
    for (const manifest of manifests) {
      result[manifest.type] += 1;
    }
    return result;
  }

  private buildMcpAllowlist(
    manifests: ZavorthCapabilityOsManifest[],
  ): ZavorthCapabilityOsSnapshot['mcpAllowlist'] {
    return manifests
      .filter((manifest) =>
        /\bmcp\b/i.test([
          manifest.id,
          manifest.label,
          manifest.command || '',
          manifest.intent,
        ].join(' ')))
      .map((manifest) => ({
        id: manifest.id,
        label: manifest.label,
        command: manifest.command,
        health: manifest.health.status,
      }));
  }

  private buildMcpHost(
    mcpAllowlist: ZavorthCapabilityOsSnapshot['mcpAllowlist'],
  ): ZavorthCapabilityOsSnapshot['mcpHost'] {
    return {
      mode: 'local-allowlist',
      folderScope: 'workspace',
      secrets: 'redacted',
      serverAllowlist: mcpAllowlist.map((entry) => entry.id),
      reason: 'Servidores MCP ficam em allowlist local, escopados ao workspace e sem expor payloads sensiveis no snapshot.',
    };
  }

  private recordRouteDecision(input: {
    generatedAt: string;
    input: string;
    commandType: string;
    manifest: ZavorthCapabilityOsManifest | null;
    fallbackChain: string[];
    decision: ZavorthCapabilityOsRouteDecision['decision'];
    requestedBy: string | null;
    sourceSurface: string | null;
  }): ZavorthCapabilityOsRouteDecision['ledger'] {
    if (!this.ledgerService) {
      return {
        recorded: false,
        entryId: null,
        status: null,
        reason: 'Ledger de trust indisponivel neste runtime.',
      };
    }

    try {
      const selectedId = input.manifest?.id || 'conversation';
      const status: TrustPlanePolicyLedgerEntry['status'] =
        input.decision.requiresApproval ? 'previewed' : 'noop';
      const entry = this.ledgerService.append({
        id: `capability-route:${this.hashReference(`${input.generatedAt}:${input.commandType}:${selectedId}:${input.input}`)}`,
        at: input.generatedAt,
        domain: 'capabilities',
        actionId: `capability.route.${selectedId}`,
        requestedBy: input.requestedBy,
        sourceSurface: input.sourceSurface || 'cli',
        status,
        riskLevel: input.decision.riskLevel,
        approvalScope: input.decision.requiresApproval ? 'once' : 'session',
        planId: null,
        permissionId: null,
        summary: `Rota ${selectedId} escolhida para ${input.commandType}; fallback ${input.fallbackChain.join(' -> ')}.`,
        diff: [],
        rollback: {
          available: false,
          reason: 'Decisao de roteamento nao muta codigo nem policy; fallback preserva a tarefa e artefatos esperados.',
        },
        result: `input=${this.redactSensitiveText(input.input)}; reason=${this.redactSensitiveText(input.decision.reason)}`,
      });
      return {
        recorded: true,
        entryId: entry.id,
        status: entry.status,
        reason: 'Decisao registrada no Trust Plane ledger com entrada redigida.',
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Capability Os] filesystem check failed', error);
    return {
        recorded: false,
        entryId: null,
        status: null,
        reason: `Nao foi possivel registrar no ledger: ${error?.message || String(error)}`,
      };
  }
  }

  private redactSensitiveText(value: string): string {
    return String(value || '')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
      .replace(/\b(?:sk|pk|rk|ghp|github_pat)_[A-Za-z0-9_=-]{12,}\b/g, '[redacted-secret]')
      .replace(/\b(?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*\S+/gi, '$1=[redacted]')
      .slice(0, 500);
  }

  private hashReference(value: string): string {
    let hash = 0;
    const normalized = String(value || '');
    for (let index = 0; index < normalized.length; index += 1) {
      hash = ((hash << 5) - hash + normalized.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 12);
  }

  private buildNarrative(
    summary: CapabilitySummary,
    manifests: ZavorthCapabilityOsManifest[],
    mcpAllowlist: ZavorthCapabilityOsSnapshot['mcpAllowlist'],
  ): ZavorthCapabilityOsSnapshot['narrative'] {
    const ready = manifests.filter((manifest) => manifest.health.status === 'ready').length;
    const approval = manifests.filter((manifest) => manifest.permissions.requiresApproval).length;
    return {
      headline: `${summary.total} capabilities registradas; ${ready} prontas para roteamento.`,
      operatorSummary: `${summary.commands} comandos, ${summary.implicitRoutes} rotas implicitas, ${approval} com aprovacao e ${mcpAllowlist.length} entradas MCP allowlisted.`,
    };
  }

  private parseRouteInput(input: string, commandType: string | null): {
    commandType: string;
    payload: string;
    isExplicit: boolean;
  } {
    const trimmed = String(input || '').trim();
    if (trimmed.startsWith('/')) {
      const [first, ...rest] = trimmed.split(/\s+/);
      return {
        commandType: this.normalizeCommand(first),
        payload: rest.join(' ').trim(),
        isExplicit: true,
      };
    }
    return {
      commandType: this.normalizeCommand(commandType || '/task'),
      payload: trimmed,
      isExplicit: false,
    };
  }

  private normalizeCommand(value: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
      return '/task';
    }
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}

export type { CapabilityRegistryLike };
