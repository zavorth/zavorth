import type { ChannelMeshSnapshot } from '../contracts/ChannelMeshContract.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import {
  ZavorthMemoryPlaneService,
  type ZavorthMemoryPlaneSnapshot,
} from './ZavorthMemoryPlaneService.js';
import {
  ZavorthRuntimeModesService,
  type ZavorthRuntimeModesSnapshot,
} from './ZavorthRuntimeModesService.js';
import {
  ZavorthSecurityMeshService,
  type ZavorthSecurityMeshSnapshot,
} from './ZavorthSecurityMeshService.js';
import {
  ZavorthSessionPlaneService,
  type ZavorthSessionPlaneSnapshot,
} from './ZavorthSessionPlaneService.js';
import {
  ZavorthTeamCatalogService,
  type ZavorthTeamCatalogSnapshot,
} from './ZavorthTeamCatalogService.js';
import {
  ZavorthTenantGovernanceService,
  type ZavorthTenantGovernanceAction,
  type ZavorthTenantGovernanceSnapshot,
} from './ZavorthTenantGovernanceService.js';

type TenantGovernanceLike = Pick<ZavorthTenantGovernanceService, 'buildSnapshot'>;
type TeamCatalogLike = Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
type ChannelMeshLike = Pick<ZavorthChannelMeshService, 'buildSnapshot'>;
type MemoryPlaneLike = Pick<ZavorthMemoryPlaneService, 'buildSnapshot'>;
type RuntimeModesLike = Pick<ZavorthRuntimeModesService, 'buildSnapshot'>;
type SecurityMeshLike = Pick<ZavorthSecurityMeshService, 'buildSnapshot'>;
type SessionPlaneLike = Pick<ZavorthSessionPlaneService, 'buildSnapshot'>;
type WorkflowControllerLike = {
  handleWorkflow: (ctx: any, args: string) => Promise<void>;
};

export type ZavorthTenantGovernanceGuidedActionId =
  | 'inspect-tenant'
  | 'review-teams'
  | 'review-channels'
  | 'review-runtime'
  | 'review-memoryplane'
  | 'review-sessions'
  | 'start-onboarding-review'
  | 'start-tenant-audit';

export type ZavorthTenantGovernanceActionInput = {
  tenantId: string;
  actionId: ZavorthTenantGovernanceGuidedActionId;
  workspace?: string | null;
};

export type ZavorthTenantGovernanceActionResult = {
  status: 'completed' | 'started';
  actionId: ZavorthTenantGovernanceGuidedActionId;
  tenantId: string;
  label: string;
  command: string;
  note: string;
  targetPanel: 'inspector-panel' | 'workspace-panel';
  targetWorkspaceView: 'timeline' | 'history' | 'security' | 'config' | null;
  replies?: string[];
};

type ZavorthTenantGovernanceActionRuntime = {
  tenantGovernanceService?: TenantGovernanceLike;
  teamCatalogService?: TeamCatalogLike;
  channelMeshService?: ChannelMeshLike;
  memoryPlaneService?: MemoryPlaneLike;
  runtimeModesService?: RuntimeModesLike;
  securityMeshService?: SecurityMeshLike;
  sessionPlaneService?: SessionPlaneLike;
  workflowController?: WorkflowControllerLike | null;
  runtimeUserId?: string | null;
};

export class ZavorthTenantGovernanceActionService {
  private readonly tenantGovernance: TenantGovernanceLike;
  private readonly teamCatalog: TeamCatalogLike;
  private readonly channelMesh: ChannelMeshLike;
  private readonly memoryPlane: MemoryPlaneLike;
  private readonly runtimeModes: RuntimeModesLike;
  private readonly securityMesh: SecurityMeshLike;
  private readonly sessionPlane: SessionPlaneLike;
  private readonly workflowController: WorkflowControllerLike | null;
  private readonly runtimeUserId: string | null;

  constructor(runtime: ZavorthTenantGovernanceActionRuntime = {}) {
    this.tenantGovernance = runtime.tenantGovernanceService || new ZavorthTenantGovernanceService();
    this.teamCatalog = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.channelMesh = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.memoryPlane = runtime.memoryPlaneService || new ZavorthMemoryPlaneService();
    this.runtimeModes = runtime.runtimeModesService || new ZavorthRuntimeModesService();
    this.securityMesh = runtime.securityMeshService || new ZavorthSecurityMeshService({
      runtimeModesService: this.runtimeModes,
    });
    this.sessionPlane = runtime.sessionPlaneService || new ZavorthSessionPlaneService();
    this.workflowController = runtime.workflowController || null;
    this.runtimeUserId = String(runtime.runtimeUserId || '').trim() || null;
  }

  public async execute(input: ZavorthTenantGovernanceActionInput): Promise<{
    action: ZavorthTenantGovernanceActionResult;
    tenantGovernance: ZavorthTenantGovernanceSnapshot;
    teams: ZavorthTeamCatalogSnapshot | null;
    channels: ChannelMeshSnapshot | null;
    memoryPlane: ZavorthMemoryPlaneSnapshot | null;
    runtimeModes: ZavorthRuntimeModesSnapshot | null;
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    sessionPlane: ZavorthSessionPlaneSnapshot | null;
  }> {
    const tenantId = String(input.tenantId || '').trim();
    const actionId = String(input.actionId || '').trim().toLowerCase() as ZavorthTenantGovernanceGuidedActionId;
    if (!tenantId) {
      throw new Error('tenantId is required to execute the tenant action.');
    }

    const snapshot = this.tenantGovernance.buildSnapshot();
    const tenant = snapshot.tenants.find((entry) => String(entry.tenantId || '').trim() === tenantId) || null;
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} was not found in the governance plan.`);
    }

    const descriptor = tenant.actions.find((entry) => String(entry.id || '').trim().toLowerCase() === actionId) || null;
    if (!descriptor) {
      throw new Error(`Action ${actionId} does not exist for tenant ${tenantId}.`);
    }
    if (descriptor.actionKind !== 'guided') {
      throw new Error(`Action ${actionId} still depends on manual composition.`);
    }

    switch (actionId) {
      case 'inspect-tenant':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: `Tenant ${tenantId} loaded into governance.`,
        });
      case 'review-teams':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: 'Team catalog updated for this surface.',
          teams: this.teamCatalog.buildSnapshot({ workspace: input.workspace || null }),
        });
      case 'review-channels':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: 'Channel mesh updated for the selected tenant.',
          channels: this.channelMesh.buildSnapshot({
            selectedId: this.resolveChannelSelectionId(tenant.platform),
          }),
        });
      case 'review-runtime':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: 'Runtime modes e security mesh atualizados para revisao do tenant.',
          runtimeModes: this.runtimeModes.buildSnapshot(),
          securityMesh: this.securityMesh.buildSnapshot(),
        });
      case 'review-memoryplane':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: 'Memory plane atualizado para o tenant selecionado.',
          memoryPlane: await this.memoryPlane.buildSnapshot(
            this.buildTenantPlaneInput(tenant, input.workspace || null),
          ),
          targetPanel: 'workspace-panel',
          targetWorkspaceView: 'history',
        });
      case 'review-sessions':
        return this.buildResponse(snapshot, descriptor, tenantId, {
          note: 'Session plane atualizado para retomadas do tenant.',
          sessionPlane: await this.sessionPlane.buildSnapshot({
            ...this.buildTenantPlaneInput(tenant, input.workspace || null),
            userId: this.resolveTenantRuntimeUserId(tenant),
            limit: 8,
          }),
          targetPanel: 'workspace-panel',
          targetWorkspaceView: 'history',
        });
      case 'start-onboarding-review':
        return this.startWorkflowReview(snapshot, descriptor, tenantId, {
          objective: `Fechar onboarding do tenant ${tenantId}`,
          note: `Onboarding workflow started for tenant ${tenantId}.`,
          workspace: input.workspace || null,
        });
      case 'start-tenant-audit':
        return this.startWorkflowReview(snapshot, descriptor, tenantId, {
          objective: `Audit governance for tenant ${tenantId}`,
          note: `Audit workflow started for tenant ${tenantId}.`,
          workspace: input.workspace || null,
        });
      default:
        throw new Error(`Action ${actionId} is not supported by the guided control plane.`);
    }
  }

  private buildResponse(
    tenantGovernance: ZavorthTenantGovernanceSnapshot,
    descriptor: ZavorthTenantGovernanceAction,
    tenantId: string,
    extra: {
      status?: ZavorthTenantGovernanceActionResult['status'];
      note: string;
      replies?: string[];
      teams?: ZavorthTeamCatalogSnapshot | null;
      channels?: ChannelMeshSnapshot | null;
      memoryPlane?: ZavorthMemoryPlaneSnapshot | null;
      runtimeModes?: ZavorthRuntimeModesSnapshot | null;
      securityMesh?: ZavorthSecurityMeshSnapshot | null;
      sessionPlane?: ZavorthSessionPlaneSnapshot | null;
      targetPanel?: ZavorthTenantGovernanceActionResult['targetPanel'];
      targetWorkspaceView?: ZavorthTenantGovernanceActionResult['targetWorkspaceView'];
    },
  ): {
    action: ZavorthTenantGovernanceActionResult;
    tenantGovernance: ZavorthTenantGovernanceSnapshot;
    teams: ZavorthTeamCatalogSnapshot | null;
    channels: ChannelMeshSnapshot | null;
    memoryPlane: ZavorthMemoryPlaneSnapshot | null;
    runtimeModes: ZavorthRuntimeModesSnapshot | null;
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    sessionPlane: ZavorthSessionPlaneSnapshot | null;
  } {
    return {
      action: {
        status: extra.status || 'completed',
        actionId: String(descriptor.id || '').trim().toLowerCase() as ZavorthTenantGovernanceGuidedActionId,
        tenantId,
        label: descriptor.label,
        command: descriptor.command,
        note: extra.note,
        targetPanel: extra.targetPanel || 'inspector-panel',
        targetWorkspaceView: extra.targetWorkspaceView || null,
        replies: extra.replies || [],
      },
      tenantGovernance,
      teams: extra.teams || null,
      channels: extra.channels || null,
      memoryPlane: extra.memoryPlane || null,
      runtimeModes: extra.runtimeModes || null,
      securityMesh: extra.securityMesh || null,
      sessionPlane: extra.sessionPlane || null,
    };
  }

  private async startWorkflowReview(
    tenantGovernance: ZavorthTenantGovernanceSnapshot,
    descriptor: ZavorthTenantGovernanceAction,
    tenantId: string,
    input: {
      objective: string;
      note: string;
      workspace: string | null;
    },
  ): Promise<{
    action: ZavorthTenantGovernanceActionResult;
    tenantGovernance: ZavorthTenantGovernanceSnapshot;
    teams: ZavorthTeamCatalogSnapshot | null;
    channels: ChannelMeshSnapshot | null;
    memoryPlane: ZavorthMemoryPlaneSnapshot | null;
    runtimeModes: ZavorthRuntimeModesSnapshot | null;
    securityMesh: ZavorthSecurityMeshSnapshot | null;
    sessionPlane: ZavorthSessionPlaneSnapshot | null;
  }> {
    if (!this.workflowController) {
      throw new Error('Workflow controller is unavailable for guided tenant governance.');
    }

    const replies = await this.runWorkflowCommand(`review ${input.objective}`);
    return this.buildResponse(tenantGovernance, descriptor, tenantId, {
      status: 'started',
      note: input.note,
      replies,
      teams: this.teamCatalog.buildSnapshot({ workspace: input.workspace }),
    });
  }

  private async runWorkflowCommand(args: string): Promise<string[]> {
    const controller = this.workflowController;
    if (!controller) {
      throw new Error('Workflow controller is unavailable for guided tenant governance.');
    }

    const replies: string[] = [];
    const ctx = {
      from: { id: 0, username: 'web-tenant-governance' },
      chat: { id: 0, type: 'private' },
      reply: async (text: string) => {
        const normalized = String(text || '').trim();
        if (normalized) {
          replies.push(normalized);
        }
        return {};
      },
      api: {
        sendChatAction: async () => undefined,
      },
      zavorth: {
        runtimeUserId: this.runtimeUserId || 'web-user',
      },
    };

    await controller.handleWorkflow(ctx, args);
    return replies;
  }

  private buildTenantPlaneInput(
    tenant: ZavorthTenantGovernanceSnapshot['tenants'][number],
    workspace: string | null,
  ): {
    userId: string;
    platform: string | null;
    chatId: string | null;
    sessionId: string | null;
    sourceUserId: string | null;
    workspaceHint: string | null;
  } {
    return {
      userId: this.resolveTenantRuntimeUserId(tenant),
      platform: tenant.platform || null,
      chatId: tenant.channelId || tenant.scopeId || tenant.guildId || tenant.threadId || null,
      sessionId: tenant.sessionId || null,
      sourceUserId: tenant.sourceUserId || null,
      workspaceHint: workspace,
    };
  }

  private resolveTenantRuntimeUserId(
    tenant: ZavorthTenantGovernanceSnapshot['tenants'][number],
  ): string {
    return String(tenant.runtimeUserId || this.runtimeUserId || '1').trim() || '1';
  }

  private resolveChannelSelectionId(platform: string | null | undefined): string | null {
    const normalized = String(platform || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized === 'discord' || normalized === 'telegram' || normalized === 'web') {
      return normalized;
    }
    return null;
  }
}
