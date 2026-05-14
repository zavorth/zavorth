import os from 'os';
import { config } from '../config/index.js';
import type { PermissionRequest, PermissionScope } from '../contracts/PermissionRequest.js';
import type {
  ZavorthApprovalScope,
  ZavorthMutationDomain,
  ZavorthMutationRiskLevel,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';
import { CapabilityLifecycleService } from './CapabilityLifecycleService.js';
import { PermissionService } from './PermissionService.js';
import { RuntimeProfileService } from './RuntimeProfileService.js';

export type TrustDecision = {
  generatedAt: string;
  decision: 'allowed' | 'requires_approval' | 'blocked';
  ok: boolean;
  reason: string;
  permission: PermissionRequest | null;
  profile: 'core' | 'ops' | 'full';
  capabilityId: string | null;
  recommendedScope: ZavorthApprovalScope;
};

export type TrustDecisionInput = {
  domain: ZavorthMutationDomain;
  actionId: string;
  planId?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  riskLevel?: ZavorthMutationRiskLevel;
  approvalRequired?: boolean;
  capabilityId?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  resourceImpact?: Partial<ZavorthResourceImpact> | null;
  approvalScope?: ZavorthApprovalScope | null;
};

type TrustDecisionRuntime = {
  now?: () => Date;
  hostId?: string | null;
  runtimeProfileService?: Pick<RuntimeProfileService, 'getProfile' | 'isCore' | 'supportsRecurringAutomation'>;
  capabilityLifecycleService?: Pick<
    CapabilityLifecycleService,
    'shouldBootCapability' | 'describeCapability' | 'registerCapabilityDemand'
  >;
  permissionService?: Pick<PermissionService, 'createRequest' | 'findApprovedRequest'>;
};

const SAFE_DIRECT_ACTIONS = new Set([
  'automation.pause',
  'automation.remove',
  'automation.maintenance-off',
  'watch.stop',
  'watch.pause',
  'trust.set-mcp-profile:safe',
  'trust.remove-mcp-tool',
  'trust.set-skill-default:deny',
  'trust.set-skill-source-mode:none',
  'watch.set-strict-default:true',
]);

const PRIVILEGE_EXPANDING_TRUST_ACTIONS = new Set([
  'set-mcp-profile:trusted',
  'set-mcp-profile:dangerous',
  'allow-mcp-tool',
  'set-skill-default:allow',
  'set-skill-source-mode:all',
  'set-skill-source-mode:explicit',
]);

export class TrustDecisionService {
  private readonly now: () => Date;
  private readonly hostId: string;
  private readonly runtimeProfile: Pick<RuntimeProfileService, 'getProfile' | 'isCore' | 'supportsRecurringAutomation'>;
  private readonly capabilityLifecycle: Pick<
    CapabilityLifecycleService,
    'shouldBootCapability' | 'describeCapability' | 'registerCapabilityDemand'
  >;
  private readonly permissionService: Pick<PermissionService, 'createRequest' | 'findApprovedRequest'>;

  constructor(runtime: TrustDecisionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.hostId = String(runtime.hostId || process.env.ZAVORTH_HOST_ID || os.hostname() || 'local-host').trim();
    this.runtimeProfile = runtime.runtimeProfileService || new RuntimeProfileService();
    this.capabilityLifecycle = runtime.capabilityLifecycleService || new CapabilityLifecycleService();
    this.permissionService = runtime.permissionService || new PermissionService();
  }

  public async evaluate(input: TrustDecisionInput): Promise<TrustDecision> {
    const domain = input.domain;
    const actionId = this.normalizeActionId(input.actionId);
    const profile = this.runtimeProfile.getProfile();
    const capabilityId = this.nullableText(input.capabilityId);
    const actionKey = this.buildActionKey(domain, actionId, input.payload || {});
    const scope = input.approvalScope || 'once';

    if (SAFE_DIRECT_ACTIONS.has(actionKey)) {
      return this.allowed(input, 'Acao segura de reducao de risco liberada sem approval.', null);
    }

    if (domain === 'automation' && this.isAutomationActivation(actionId) && this.runtimeProfile.isCore()) {
      return this.blocked(
        input,
        'Perfil core nao ativa loops recorrentes; gere preview e mude para ops/full antes de aplicar.',
      );
    }

    if (domain === 'watch' && capabilityId && !this.capabilityLifecycle.shouldBootCapability(capabilityId)) {
      this.capabilityLifecycle.registerCapabilityDemand(
        capabilityId,
        this.nullableText(input.requestedBy) || 'operator',
        this.cleanText(input.reason, 'Watch Mode solicitado sob demanda.'),
      );
      return this.requiresApproval(input, 'Capability watch-mode esta dormente e precisa de approval para ativar.', scope);
    }

    if (domain === 'setup' && capabilityId && !this.capabilityLifecycle.shouldBootCapability(capabilityId)) {
      this.capabilityLifecycle.registerCapabilityDemand(
        capabilityId,
        this.nullableText(input.requestedBy) || 'operator',
        this.cleanText(input.reason, 'Natural Setup solicitado sob demanda.'),
      );
      return this.requiresApproval(input, `Capability ${capabilityId} esta dormente e precisa de approval antes de ativar canal.`, scope);
    }

    if (domain === 'trust' && PRIVILEGE_EXPANDING_TRUST_ACTIONS.has(actionKey.replace(/^trust\./, ''))) {
      return this.requiresApproval(input, 'Acao amplia privilegios do Trust Plane e exige approval canonico.', scope);
    }

    if (domain === 'watch' && this.isWatchPowerIncreasing(actionId, input.payload || {})) {
      return this.requiresApproval(input, 'Watch Mode aumenta poder visual/mutavel e exige approval.', scope);
    }

    if (domain === 'automation' && this.isAutomationActivation(actionId)) {
      return this.requiresApproval(input, 'Automacao recorrente exige budget salvo e approval.', scope);
    }

    if (input.approvalRequired === true || input.riskLevel === 'high' || input.riskLevel === 'critical') {
      return this.requiresApproval(input, this.cleanText(input.reason, 'Mutacao sensivel exige approval.'), scope);
    }

    return this.allowed(input, 'TrustDecision permitiu execucao leve sem ampliar poder.', null);
  }

  private async requiresApproval(
    input: TrustDecisionInput,
    reason: string,
    scope: ZavorthApprovalScope,
  ): Promise<TrustDecision> {
    const existing = await this.permissionService.findApprovedRequest(
      'zavorth-mutation',
      this.permissionKind(input),
      config.projectRoot,
      this.metadataMatch(input, scope),
    );
    if (existing) {
      return this.allowed(input, 'Approval persistente/session encontrado para esta mutacao.', existing);
    }

    const permission = await this.permissionService.createRequest({
      task_id: input.planId ? `mutation:${input.planId}` : null,
      executor: 'zavorth-mutation',
      kind: this.permissionKind(input),
      scope: this.toPermissionScope(scope),
      workspace: config.projectRoot,
      requested_value: this.requestedValue(input),
      resolved_value: this.requestedValue(input),
      reason,
      requested_by: this.nullableText(input.requestedBy),
      metadata: {
        ...this.metadataMatch(input, scope),
        source_surface: this.nullableText(input.sourceSurface),
        risk_level: input.riskLevel || 'medium',
        resource_impact: input.resourceImpact || {},
      },
    });

    return {
      generatedAt: this.now().toISOString(),
      decision: 'requires_approval',
      ok: false,
      reason,
      permission,
      profile: this.runtimeProfile.getProfile(),
      capabilityId: this.nullableText(input.capabilityId),
      recommendedScope: scope,
    };
  }

  private allowed(input: TrustDecisionInput, reason: string, permission: PermissionRequest | null): TrustDecision {
    return {
      generatedAt: this.now().toISOString(),
      decision: 'allowed',
      ok: true,
      reason,
      permission,
      profile: this.runtimeProfile.getProfile(),
      capabilityId: this.nullableText(input.capabilityId),
      recommendedScope: input.approvalScope || 'once',
    };
  }

  private blocked(input: TrustDecisionInput, reason: string): TrustDecision {
    return {
      generatedAt: this.now().toISOString(),
      decision: 'blocked',
      ok: false,
      reason,
      permission: null,
      profile: this.runtimeProfile.getProfile(),
      capabilityId: this.nullableText(input.capabilityId),
      recommendedScope: input.approvalScope || 'once',
    };
  }

  private permissionKind(input: TrustDecisionInput): string {
    return `${input.domain}.${this.normalizeActionId(input.actionId)}`;
  }

  private requestedValue(input: TrustDecisionInput): string {
    return [
      input.domain,
      this.normalizeActionId(input.actionId),
      this.nullableText(input.capabilityId) || '',
      input.planId ? `plan:${input.planId}` : '',
    ].filter(Boolean).join(':');
  }

  private metadataMatch(input: TrustDecisionInput, scope: ZavorthApprovalScope): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      domain: input.domain,
      action_id: this.normalizeActionId(input.actionId),
      capability_id: this.nullableText(input.capabilityId),
    };
    if (scope === 'host') {
      metadata.host_id = this.hostId;
    }
    if (input.planId) {
      metadata.plan_id = input.planId;
    }
    return metadata;
  }

  private toPermissionScope(scope: ZavorthApprovalScope): PermissionScope {
    if (scope === 'host') {
      return 'persistent';
    }
    return scope;
  }

  private buildActionKey(domain: ZavorthMutationDomain, actionId: string, payload: Record<string, unknown>): string {
    if (domain === 'trust' && actionId === 'set-mcp-profile') {
      return `trust.set-mcp-profile:${String(payload.profile || '').trim().toLowerCase()}`;
    }
    if (domain === 'trust' && actionId === 'set-skill-default') {
      return `trust.set-skill-default:${String(payload.defaultPolicy || '').trim().toLowerCase()}`;
    }
    if (domain === 'trust' && actionId === 'set-skill-source-mode') {
      return `trust.set-skill-source-mode:${String(payload.mode || '').trim().toLowerCase()}`;
    }
    if (domain === 'watch' && actionId === 'set-strict-default') {
      return `watch.set-strict-default:${String(payload.strictApproval || payload.value || '').trim().toLowerCase()}`;
    }
    return `${domain}.${actionId}`;
  }

  private isAutomationActivation(actionId: string): boolean {
    return actionId === 'create' || actionId === 'resume' || actionId === 'maintenance-on' || actionId === 'maintenance-run';
  }

  private isWatchPowerIncreasing(actionId: string, payload: Record<string, unknown>): boolean {
    if (actionId === 'start') {
      return true;
    }
    if (actionId === 'allow-app' || actionId === 'allow-site') {
      return true;
    }
    if (actionId === 'set-strict-default') {
      return String(payload.strictApproval ?? payload.value ?? '').trim().toLowerCase() === 'false';
    }
    return false;
  }

  private normalizeActionId(actionId: string): string {
    return String(actionId || '').trim().toLowerCase();
  }

  private cleanText(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = this.cleanText(value);
    return normalized || null;
  }
}
