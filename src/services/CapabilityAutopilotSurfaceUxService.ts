import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityReceipt,
  CapabilityReceiptStage,
  CapabilitySurfaceUxAction,
  CapabilitySurfaceUxPayload,
} from '../contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotReceiptService } from './CapabilityAutopilotReceiptService.js';

type CapabilityAutopilotReceiptLike = Pick<CapabilityAutopilotReceiptService, 'buildCapabilityReceipt'>;

export type CapabilityAutopilotSurfaceUxInput = {
  receipt: CapabilityReceipt;
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

export type CapabilityAutopilotSurfaceUxRuntime = {
  now?: () => Date;
  receiptService?: CapabilityAutopilotReceiptLike;
};

const COMPACT_SURFACES = new Set<CapabilityAutopilotSurface>(['chat', 'telegram', 'mobile']);

export class CapabilityAutopilotSurfaceUxService {
  private readonly now: () => Date;
  private readonly receiptService: CapabilityAutopilotReceiptLike;

  constructor(runtime: CapabilityAutopilotSurfaceUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.receiptService = runtime.receiptService || new CapabilityAutopilotReceiptService();
  }

  public async buildCapabilitySurfacePayload(
    capabilityId: string,
    options: {
      surface?: CapabilityAutopilotSurface;
      audience?: CapabilityAutopilotAudience;
    } = {},
  ): Promise<CapabilitySurfaceUxPayload> {
    const receipt = await this.receiptService.buildCapabilityReceipt(capabilityId, {
      surface: options.surface || 'cli',
      audience: options.audience || 'everyday_user',
    });
    return this.buildPayload({ receipt, surface: options.surface, audience: options.audience });
  }

  public buildPayload(input: CapabilityAutopilotSurfaceUxInput): CapabilitySurfaceUxPayload {
    const surface = input.surface || input.receipt.surface;
    const audience = input.audience || input.receipt.audience;
    const permissionCount = input.receipt.repairPlan?.permissionRequirements.length || 0;
    const fallbackCount = input.receipt.repairPlan?.fallbackOptions.length || 0;
    const stage = input.receipt.stage;

    return {
      generatedAt: this.now().toISOString(),
      surface,
      audience,
      capabilityId: input.receipt.capabilityId,
      capabilityLabel: input.receipt.capabilityLabel,
      stage,
      tone: this.resolveTone(stage, input.receipt),
      headline: this.buildHeadline(input.receipt, surface, audience),
      body: this.buildBody(input.receipt, surface, audience),
      technicalBody: audience === 'technical_operator' || surface === 'api'
        ? input.receipt.technicalSummary
        : null,
      permissionSummary: permissionCount > 0
        ? `${permissionCount} pending permission(s) with explicit scope.`
        : null,
      fallbackSummary: fallbackCount > 0
        ? `${fallbackCount} fallback(s) available, none automatic.`
        : null,
      timelineSummary: this.buildTimelineSummary(input.receipt, surface),
      actions: this.buildActions(input.receipt, surface),
      receipt: input.receipt,
      metadata: {
        gate: 'capability-autopilot-cross-surface-ux',
        sourceReceiptId: input.receipt.receiptId,
        permissionCount,
        fallbackCount,
        compact: COMPACT_SURFACES.has(surface),
      },
    };
  }

  public buildPayloads(
    receipt: CapabilityReceipt,
    surfaces: CapabilityAutopilotSurface[],
    audience: CapabilityAutopilotAudience = receipt.audience,
  ): CapabilitySurfaceUxPayload[] {
    return surfaces.map((surface) => this.buildPayload({ receipt, surface, audience }));
  }

  private resolveTone(
    stage: CapabilityReceiptStage,
    receipt: CapabilityReceipt,
  ): CapabilitySurfaceUxPayload['tone'] {
    if (stage === 'completed' || stage === 'resume') {
      return 'success';
    }
    if (stage === 'failed' || receipt.readiness?.severity === 'critical') {
      return 'blocked';
    }
    if (stage === 'permission' || stage === 'repair' || stage === 'validation') {
      return 'attention';
    }
    return 'neutral';
  }

  private buildHeadline(
    receipt: CapabilityReceipt,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): string {
    if (surface === 'api') {
      return `${receipt.capabilityId}:${receipt.stage}`;
    }
    if (audience === 'technical_operator') {
      return receipt.headline;
    }
    if (COMPACT_SURFACES.has(surface) && receipt.stage === 'permission') {
      return `${receipt.capabilityLabel} needs permission.`;
    }
    return receipt.headline;
  }

  private buildBody(
    receipt: CapabilityReceipt,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): string {
    const chunks = [
      audience === 'technical_operator' ? receipt.technicalSummary : receipt.userSummary,
    ];
    if (receipt.repairPlan?.permissionRequirements.length) {
      chunks.push('No action will be executed without explicit approval.');
    }
    if (receipt.repairPlan?.fallbackOptions.length) {
      chunks.push('Fallbacks remain visible for user choice.');
    }

    const text = chunks.filter(Boolean).join(' ');
    if (surface === 'telegram' || surface === 'mobile') {
      return this.truncate(text, 420);
    }
    if (surface === 'chat') {
      return this.truncate(text, 700);
    }
    return text;
  }

  private buildTimelineSummary(
    receipt: CapabilityReceipt,
    surface: CapabilityAutopilotSurface,
  ): string[] {
    const entries = COMPACT_SURFACES.has(surface)
      ? receipt.timeline.slice(-3)
      : receipt.timeline;
    return entries.map((entry) => `${entry.stage}:${entry.status}:${entry.summary}`);
  }

  private buildActions(
    receipt: CapabilityReceipt,
    surface: CapabilityAutopilotSurface,
  ): CapabilitySurfaceUxAction[] {
    const actions: CapabilitySurfaceUxAction[] = [];
    const routeBase = this.routeBase(surface, receipt);
    const commandBase = `npm run capability-autopilot -- --capability=${receipt.capabilityId}`;

    actions.push(this.action({
      id: 'view-details',
      kind: 'view_details',
      label: surface === 'api' ? 'view_details' : 'Ver detalhes',
      description: 'Open readiness, diagnostics, plan, and timeline.',
      command: surface === 'cli' ? commandBase : null,
      route: routeBase,
      callbackData: this.callback(surface, receipt, 'details'),
    }));

    if (receipt.stage === 'permission' && receipt.repairPlan?.permissionRequirements.length) {
      actions.push(this.action({
        id: 'approve-permission',
        kind: 'approve_permission',
        label: surface === 'api' ? 'approve_permission' : 'Approve',
        description: 'Approve only the scopes listed in the repair plan.',
        command: surface === 'cli' ? `npm run capability-autopilot:runner -- --capability=${receipt.capabilityId}` : null,
        route: this.appendRoute(routeBase, 'approve'),
        callbackData: this.callback(surface, receipt, 'approve'),
      }));
      actions.push(this.action({
        id: 'reject-permission',
        kind: 'reject_permission',
        label: surface === 'api' ? 'reject_permission' : 'Rejeitar',
        description: 'Reject repair and keep the capability blocked.',
        command: null,
        route: this.appendRoute(routeBase, 'reject'),
        callbackData: this.callback(surface, receipt, 'reject'),
      }));
    }

    if (receipt.stage === 'repair' || receipt.stage === 'failed' || receipt.stage === 'permission') {
      actions.push(this.action({
        id: 'run-validation',
        kind: 'run_validation',
        label: surface === 'api' ? 'run_validation' : 'validate',
        description: 'Recalcular readiness before resume o request original.',
        command: surface === 'cli' ? `npm run capability-autopilot:resume -- --capability=${receipt.capabilityId}` : null,
        route: this.appendRoute(routeBase, 'validate'),
        callbackData: this.callback(surface, receipt, 'validate'),
      }));
    }

    for (const fallback of receipt.repairPlan?.fallbackOptions || []) {
      actions.push(this.action({
        id: `fallback-${fallback.id}`,
        kind: 'choose_fallback',
        label: surface === 'api' ? `fallback:${fallback.id}` : fallback.label,
        description: fallback.reason,
        route: this.appendRoute(routeBase, `fallback/${fallback.id}`),
        callbackData: this.callback(surface, receipt, `fallback:${fallback.id}`),
        enabled: fallback.policyAllowed !== false,
        metadata: {
          fallbackId: fallback.id,
          requiresPermission: fallback.requiresPermission,
          policyAllowed: fallback.policyAllowed,
        },
      }));
    }

    if (receipt.stage === 'resume') {
      actions.push(this.action({
        id: 'resume-intent',
        kind: 'resume_intent',
        label: surface === 'api' ? 'resume_intent' : 'Resume request',
        description: 'resumes the original request preserved in the receipt.',
        command: surface === 'cli' ? `npm run capability-autopilot:resume -- --capability=${receipt.capabilityId}` : null,
        route: this.appendRoute(routeBase, 'resume'),
        callbackData: this.callback(surface, receipt, 'resume'),
      }));
    }

    return actions;
  }

  private action(input: {
    id: string;
    kind: CapabilitySurfaceUxAction['kind'];
    label: string;
    description: string;
    command?: string | null;
    route?: string | null;
    callbackData?: string | null;
    enabled?: boolean;
    metadata?: Record<string, unknown>;
  }): CapabilitySurfaceUxAction {
    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      description: input.description,
      requiresExplicitUserAction: true,
      enabled: input.enabled !== false,
      command: input.command || null,
      route: input.route || null,
      callbackData: input.callbackData || null,
      metadata: input.metadata || {},
    };
  }

  private routeBase(surface: CapabilityAutopilotSurface, receipt: CapabilityReceipt): string | null {
    if (surface === 'api') {
      return `/api/capabilities/${receipt.capabilityId}/autopilot`;
    }
    if (surface === 'web' || surface === 'mobile') {
      return `/capabilities/${receipt.capabilityId}/autopilot`;
    }
    return null;
  }

  private appendRoute(routeBase: string | null, suffix: string): string | null {
    if (!routeBase) {
      return null;
    }
    return `${routeBase}/${suffix}`;
  }

  private callback(
    surface: CapabilityAutopilotSurface,
    receipt: CapabilityReceipt,
    action: string,
  ): string | null {
    if (surface !== 'telegram' && surface !== 'chat') {
      return null;
    }
    return `capability_autopilot:${receipt.capabilityId}:${receipt.receiptId}:${action}`;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }
}
