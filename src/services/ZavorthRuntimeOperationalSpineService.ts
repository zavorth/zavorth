import path from 'node:path';
import type { McpToolPolicyDocument } from '../mcp/McpToolPolicy.js';
import type { TrustedWorkspacePolicy } from '../contracts/ExecutionEngineContract.js';
import type { ZavorthRuntimeStateBusActionInput } from '../contracts/ZavorthRuntimeStateBusContract.js';
import { ZavorthRuntimeStateBusService } from './ZavorthRuntimeStateBusService.js';
import { ZavorthProviderModelCatalogService } from './ZavorthProviderModelCatalogService.js';
import { ZavorthScheduledTaskSurfaceService } from './ZavorthScheduledTaskSurfaceService.js';
import { McpToolPolicyFileService } from './McpToolPolicyFileService.js';
import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService.js';
import { ZavorthMemoryLearningLoopService } from './ZavorthMemoryLearningLoopService.js';
import { ZavorthSessionPlaneService } from './ZavorthSessionPlaneService.js';

type ProviderCatalogLike = Pick<ZavorthProviderModelCatalogService, 'buildSnapshot'>;
type SchedulerSurfaceLike = Pick<ZavorthScheduledTaskSurfaceService, 'list'>;
type McpPolicyLike = Pick<McpToolPolicyFileService, 'readPolicy'>;
type WorkspacePolicyLike = Pick<TrustedWorkspacePolicyService, 'list'>;
type MemoryLearningLike = Pick<ZavorthMemoryLearningLoopService, 'remember'>;
type SessionPlaneLike = Pick<ZavorthSessionPlaneService, 'buildStatusSummary'>;

type ProviderCatalogProvider = {
  id?: string;
  label?: string;
  status?: string;
  defaultRouteAllowed?: boolean;
  liveReady?: boolean;
  catalogReady?: boolean;
  model?: string | null;
  modelSample?: string[];
  defaultBlockReason?: string | null;
  issue?: string | null;
  userAction?: string | null;
  testCommand?: string | null;
};

type SchedulerTaskCard = {
  id?: string;
  status?: string;
  governed?: boolean;
};

type RuntimeActionRecord = {
  previewId: string;
  approvalId: string;
  input: ZavorthRuntimeStateBusActionInput;
  status: 'pending-approval' | 'approved' | 'rejected' | 'executed';
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
};

export type ZavorthRuntimeOperationalSpineSyncInput = {
  userId?: string | null;
  sessionId?: string | null;
  workspacePath?: string | null;
};

export type ZavorthRuntimeOperationalSpineSyncResult = {
  ok: boolean;
  generatedAt: string;
  summary: {
    providerConnections: number;
    connectedModels: number;
    trustedWorkspaces: number;
    recoverableJobs: number;
    mcpServers: number;
    sessionResumable: boolean;
  };
};

export type ZavorthRuntimeOperationalSpinePreview = {
  previewId: string;
  approvalId: string;
  status: 'pending-approval' | 'preview';
  applied: false;
  receiptId: string;
};

export type ZavorthRuntimeOperationalSpineApproval = {
  previewId: string;
  approvalId: string;
  status: 'approved' | 'rejected';
};

export type ZavorthRuntimeOperationalSpineExecution = {
  previewId: string;
  approvalId: string;
  status: 'executed' | 'blocked';
  receiptId: string | null;
  learningReceiptId: string | null;
};

type Runtime = {
  now?: () => Date;
  runtimeStateBus?: Pick<ZavorthRuntimeStateBusService, 'dispatch' | 'buildSnapshot'>;
  providerCatalog?: ProviderCatalogLike | null;
  schedulerSurface?: SchedulerSurfaceLike | null;
  mcpPolicy?: McpPolicyLike | null;
  workspacePolicy?: WorkspacePolicyLike | null;
  memoryLearning?: MemoryLearningLike | null;
  sessionPlane?: SessionPlaneLike | null;
};

export class ZavorthRuntimeOperationalSpineService {
  private readonly now: () => Date;
  private readonly runtimeStateBus: Pick<ZavorthRuntimeStateBusService, 'dispatch' | 'buildSnapshot'>;
  private readonly providerCatalog: ProviderCatalogLike | null;
  private readonly schedulerSurface: SchedulerSurfaceLike | null;
  private readonly mcpPolicy: McpPolicyLike | null;
  private readonly workspacePolicy: WorkspacePolicyLike | null;
  private readonly memoryLearning: MemoryLearningLike | null;
  private readonly sessionPlane: SessionPlaneLike | null;
  private readonly pendingActions = new Map<string, RuntimeActionRecord>();
  private sequence = 0;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.runtimeStateBus = runtime.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
    this.providerCatalog = runtime.providerCatalog === null
      ? null
      : runtime.providerCatalog || new ZavorthProviderModelCatalogService({ now: this.now });
    this.schedulerSurface = runtime.schedulerSurface === null
      ? null
      : runtime.schedulerSurface || new ZavorthScheduledTaskSurfaceService({ now: this.now });
    this.mcpPolicy = runtime.mcpPolicy === null
      ? null
      : runtime.mcpPolicy || new McpToolPolicyFileService({ now: this.now });
    this.workspacePolicy = runtime.workspacePolicy === null
      ? null
      : runtime.workspacePolicy || new TrustedWorkspacePolicyService();
    this.memoryLearning = runtime.memoryLearning === null
      ? null
      : runtime.memoryLearning || new ZavorthMemoryLearningLoopService({ now: this.now });
    this.sessionPlane = runtime.sessionPlane === null
      ? null
      : runtime.sessionPlane || new ZavorthSessionPlaneService({ now: this.now });
  }

  public async syncOperationalState(
    input: ZavorthRuntimeOperationalSpineSyncInput = {},
  ): Promise<ZavorthRuntimeOperationalSpineSyncResult> {
    const generatedAt = this.now().toISOString();
    const providerSummary = await this.publishProviders();
    const workspaceSummary = this.publishWorkspaceKnowledge(input.workspacePath || null);
    const mcpSummary = this.publishMcpTrust();
    const schedulerSummary = this.publishSchedulerRecovery();
    const sessionSummary = await this.publishSessionState(input);

    return {
      ok: true,
      generatedAt,
      summary: {
        providerConnections: providerSummary.providerConnections,
        connectedModels: providerSummary.connectedModels,
        trustedWorkspaces: workspaceSummary.trustedWorkspaces,
        recoverableJobs: schedulerSummary.recoverableJobs,
        mcpServers: mcpSummary.mcpServers,
        sessionResumable: sessionSummary.sessionResumable,
      },
    };
  }

  public previewRuntimeAction(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeOperationalSpinePreview {
    const previewId = this.nextId('runtime-preview');
    const approvalId = this.nextId('runtime-approval');
    const result = this.runtimeStateBus.dispatch({
      ...input,
      approved: false,
      previewOnly: true,
      payload: {
        ...(input.payload || {}),
        metadata: {
          ...asRecord(input.payload?.metadata),
          previewId,
          approvalId,
          operationalSpine: true,
        },
      },
    });
    this.pendingActions.set(previewId, {
      previewId,
      approvalId,
      input,
      status: 'pending-approval',
      createdAt: this.now().toISOString(),
      decidedAt: null,
      executedAt: null,
    });
    return {
      previewId,
      approvalId,
      status: 'pending-approval',
      applied: false,
      receiptId: result.receipt.id,
    };
  }

  public async approveRuntimeAction(
    previewId: string,
    decision: 'approve' | 'reject',
  ): Promise<ZavorthRuntimeOperationalSpineApproval> {
    const record = this.pendingActions.get(previewId);
    if (!record) {
      return {
        previewId,
        approvalId: '',
        status: 'rejected',
      };
    }
    record.status = decision === 'approve' ? 'approved' : 'rejected';
    record.decidedAt = this.now().toISOString();
    return {
      previewId,
      approvalId: record.approvalId,
      status: record.status,
    };
  }

  public async executeRuntimeAction(
    approvalId: string,
  ): Promise<ZavorthRuntimeOperationalSpineExecution> {
    const record = Array.from(this.pendingActions.values()).find((entry) => entry.approvalId === approvalId) || null;
    if (!record || record.status !== 'approved') {
      return {
        previewId: record?.previewId || '',
        approvalId,
        status: 'blocked',
        receiptId: null,
        learningReceiptId: null,
      };
    }
    const result = this.runtimeStateBus.dispatch({
      ...record.input,
      approved: true,
      previewOnly: false,
      payload: {
        ...(record.input.payload || {}),
        metadata: {
          ...asRecord(record.input.payload?.metadata),
          previewId: record.previewId,
          approvalId: record.approvalId,
          executionId: this.nextId('runtime-execution'),
          operationalSpine: true,
        },
      },
    });
    record.status = 'executed';
    record.executedAt = this.now().toISOString();
    const learningReceiptId = await this.recordRuntimeReceipt({
      receiptId: result.receipt.id,
      summary: result.receipt.summary,
      status: result.receipt.status,
      domain: result.receipt.domain,
      action: result.receipt.action,
    });
    this.runtimeStateBus.dispatch({
      type: 'surface-event',
      approved: true,
      source: 'runtime-operational-spine',
      payload: {
        domain: {
          domain: result.receipt.domain,
          status: domainStatus(result.snapshot.state[result.receipt.domain]),
          summary: `${result.receipt.summary}${learningReceiptId ? ` Learning receipt: ${learningReceiptId}.` : ''}`,
          actionIds: [result.receipt.id, learningReceiptId].filter(Boolean),
        },
        metadata: {
          previewId: record.previewId,
          approvalId: record.approvalId,
          receiptId: result.receipt.id,
          learningReceiptId,
        },
      },
    });
    return {
      previewId: record.previewId,
      approvalId: record.approvalId,
      status: result.ok ? 'executed' : 'blocked',
      receiptId: result.receipt.id,
      learningReceiptId,
    };
  }

  public async recordRuntimeReceipt(input: {
    receiptId: string;
    summary: string;
    status: string;
    domain: string;
    action: string;
  }): Promise<string | null> {
    if (!this.memoryLearning || input.status !== 'applied') {
      return null;
    }
    const receipt = await this.memoryLearning.remember({
      layer: 'session',
      key: `runtime-receipt:${input.receiptId}`,
      content: `${input.domain}.${input.action}: ${input.summary}`,
      source: 'runtime-operational-spine',
      confidence: 0.8,
      risk: 'low',
      metadata: {
        receiptId: input.receiptId,
        runtimeDomain: input.domain,
        runtimeAction: input.action,
      },
    } as never);
    return extractReceiptId(receipt);
  }

  private async publishProviders(): Promise<{ providerConnections: number; connectedModels: number }> {
    if (!this.providerCatalog) {
      return { providerConnections: 0, connectedModels: 0 };
    }
    const snapshot = await this.providerCatalog.buildSnapshot({});
    const providers = Array.isArray((snapshot as { providers?: ProviderCatalogProvider[] }).providers)
      ? (snapshot as { providers: ProviderCatalogProvider[] }).providers
      : [];
    const connectedModelIds = new Set<string>();
    for (const provider of providers) {
      const providerId = clean(provider.id) || clean(provider.label);
      if (!providerId) continue;
      for (const model of providerModelIds(provider)) {
        connectedModelIds.add(model);
      }
      this.runtimeStateBus.dispatch({
        type: 'set-provider-connection',
        approved: true,
        source: 'runtime-operational-spine',
        payload: {
          providerConnection: {
            providerId,
            label: clean(provider.label) || providerId,
            status: provider.defaultRouteAllowed || provider.liveReady || provider.status === 'ready'
              ? 'configured'
              : 'needs-setup',
            modelIds: providerModelIds(provider),
            readiness: provider.status,
            reason: provider.issue || provider.defaultBlockReason || provider.userAction || null,
            liveReady: provider.liveReady === true,
            catalogReady: provider.catalogReady !== false,
          },
        },
      });
    }
    if (connectedModelIds.size > 0) {
      const preferred = Array.from(connectedModelIds)[0];
      this.runtimeStateBus.dispatch({
        type: 'route-model',
        approved: true,
        source: 'runtime-operational-spine',
        connectedModelIds: Array.from(connectedModelIds),
        payload: {
          dynamicRouting: {
            modelId: preferred,
            providerId: providerFromModelId(preferred),
            specId: this.runtimeStateBus.buildSnapshot().state.modelSpec.selectedSpecId,
            intent: 'provider-sync',
            reason: 'Provider catalog published connected model routes.',
            fallbackModelIds: Array.from(connectedModelIds).slice(1, 5),
            risk: 'low',
          },
        },
      });
    }
    return {
      providerConnections: providers.length,
      connectedModels: connectedModelIds.size,
    };
  }

  private publishWorkspaceKnowledge(workspacePath: string | null): { trustedWorkspaces: number } {
    const policies = this.workspacePolicy?.list() || [];
    const trusted = policies.filter((policy) => policy.state === 'trusted');
    this.runtimeStateBus.dispatch({
      type: 'set-workspace-knowledge',
      approved: true,
      source: 'runtime-operational-spine',
      payload: {
        workspaceKnowledge: {
          workspaceId: workspacePath ? `folder:${path.resolve(workspacePath)}` : 'chat',
          isolation: workspacePath ? 'workspace-boundary' : 'chat-only',
          ragSources: [],
          trustedWorkspaceIds: trusted.map((policy) => policy.id),
          allowedPaths: trusted.map((policy) => policy.path),
          contextUntrusted: true,
          untrustedContextWrapping: true,
        },
      },
    });
    return { trustedWorkspaces: trusted.length };
  }

  private publishMcpTrust(): { mcpServers: number } {
    const policy = this.mcpPolicy?.readPolicy() || null;
    if (!policy) {
      return { mcpServers: 0 };
    }
    this.runtimeStateBus.dispatch({
      type: 'set-mcp-trust',
      approved: policy.profile === 'trusted' || policy.profile === 'dangerous',
      source: 'runtime-operational-spine',
      payload: {
        mcpTrust: mcpServerFromPolicy(policy),
      },
    });
    return { mcpServers: 1 };
  }

  private publishSchedulerRecovery(): { recoverableJobs: number } {
    const result = this.schedulerSurface?.list();
    const tasks = Array.isArray((result as { tasks?: SchedulerTaskCard[] } | undefined)?.tasks)
      ? (result as { tasks: SchedulerTaskCard[] }).tasks
      : [];
    const orphaned = tasks.filter((task) => String(task.status || '').toLowerCase().includes('orphan')).length;
    const recoverable = tasks.filter((task) => task.governed && String(task.status || '').toLowerCase() !== 'completed').length;
    this.runtimeStateBus.dispatch({
      type: 'recover-scheduled-jobs',
      approved: true,
      source: 'runtime-operational-spine',
      payload: {
        scheduledJobs: {
          orphaned,
          recoverable,
          total: tasks.length,
        },
      },
    });
    return {
      recoverableJobs: orphaned || recoverable,
    };
  }

  private async publishSessionState(input: ZavorthRuntimeOperationalSpineSyncInput): Promise<{ sessionResumable: boolean }> {
    const summary = this.sessionPlane
      ? await this.sessionPlane.buildStatusSummary({
          userId: clean(input.userId) || 'desktop-user',
          sessionId: clean(input.sessionId) || 'desktop-main',
        })
      : null;
    const resumable = summary?.summary.sendReady === true || summary?.summary.spawnReady === true;
    this.runtimeStateBus.dispatch({
      type: 'resume-stream',
      approved: true,
      source: 'runtime-operational-spine',
      payload: {
        streamSession: {
          sessionId: clean(input.sessionId) || 'desktop-main',
          status: resumable ? 'resumable' : 'idle',
          resumeToken: resumable ? `session:${clean(input.sessionId) || 'desktop-main'}` : null,
          resumable,
          reason: summary?.narrative.operatorSummary || 'Session state published by operational spine.',
        },
      },
    });
    return { sessionResumable: resumable };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.now().getTime().toString(36)}-${this.sequence}`;
  }
}

function providerModelIds(provider: ProviderCatalogProvider): string[] {
  const providerId = clean(provider.id) || 'provider';
  return uniqueStrings([
    provider.model ? `${providerId}:${provider.model}` : '',
    ...(Array.isArray(provider.modelSample) ? provider.modelSample : []).map((model) => `${providerId}:${model}`),
  ]);
}

function mcpServerFromPolicy(policy: McpToolPolicyDocument) {
  const trustState = policy.profile === 'dangerous'
    ? 'blocked'
    : policy.profile === 'trusted'
      ? 'trusted'
      : 'review';
  return {
    id: `mcp:policy:${policy.profile}`,
    label: `MCP policy: ${policy.profile}`,
    origin: 'local-policy',
    trustState,
    toolNames: policy.allowlist,
    exposedToModel: trustState === 'trusted',
    risk: policy.profile === 'dangerous' ? 'high' : policy.profile === 'trusted' ? 'medium' : 'low',
    networkPolicy: 'private-network-blocked',
  };
}

function extractReceiptId(receipt: unknown): string | null {
  const record = asRecord(receipt);
  return clean(record.id) || clean(record.receiptId) || null;
}

function providerFromModelId(modelId: string): string {
  return modelId.split(':')[0] || 'zavorth';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter((value): value is string => Boolean(value))));
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function domainStatus(value: unknown): string {
  return clean(asRecord(value).status) || 'ready';
}
