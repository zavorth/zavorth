import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { MessageChannel, TaskSource } from '../contracts/PlatformContract.js';
import type { WebComposerMention } from '../contracts/WebComposer.js';
import type { MessageTransportKind } from '../contracts/IMessageBroker.js';
import type { TenantContext } from '../contracts/TenantContext.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { EchoOutputStageService } from './EchoOutputStageService.js';
export type PermissionServiceLike = {
  listRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
    limit?: number,
  ): Promise<PermissionRequest[]>;
};

export type TaskManagerLike = {
  getRecentTasks?(limit?: number, userId?: string): any[];
  getRecentTasksByChat(chatId: string, limit?: number): any[];
  getTask(taskId: string): any;
};

export type ParserLike = {
  parse(rawMessage: string): any;
};

export type TaskOrchestrationControllerLike = {
  handleTaskMessage(ctx: any, input: any): Promise<any>;
};

export type PermissionControllerLike = {
  resolvePermissionReference(ref: string): Promise<PermissionRequest>;
  shortPermissionId(permission: PermissionRequest): string;
  handlePermissionCallback(ctx: any, data: string): Promise<void>;
  handleApproval(ctx: any, args: string): Promise<void>;
  handleRejection(ctx: any, taskId: string): Promise<void>;
  formatPermissionCreatedMessage(permission: PermissionRequest): string;
};

export type WorkflowControllerLike = {
  handleWorkflow(ctx: any, args: string): Promise<void>;
};

export type HostIdentityServiceLike = {
  getStatus(): {
    authorized: boolean;
    firstRun: boolean;
    currentFingerprint: string;
    storedFingerprint: string | null;
  };
  authorizeCurrentHost(): {
    fingerprint: string;
    hostname: string;
    authorizedAt: string;
  };
};

export type SurfaceTaskDispatchInput = {
  ctx: any;
  platform: MessageChannel;
  chatId: string;
  text: string;
  sourceUserId: string;
  fallbackRuntimeUserId?: string | null;
  source?: TaskSource;
  sessionId?: string | null;
  threadId?: string | null;
  chatHint?: string | null;
  mentions?: WebComposerMention[];
  composerPayload?: Record<string, any> | null;
  identity?: {
    linkedBy?: string | null;
    verificationMethod?: string | null;
  } | null;
  tenant?: TenantContext | null;
  surfacePolicy?: {
    publicServerMode?: boolean | null;
    forceApprovalForExecution?: boolean | null;
    transport?: MessageTransportKind | null;
  } | null;
  inlineData?: Array<{ mimeType: string; data: string }>;
};

export type SurfaceTaskDispatchResult = {
  task: any;
  parsed: any;
  runtimeUserId: string;
  sourceUserId: string;
  tenantId: string | null;
  tenantContext: TenantContext | null;
};

export type SurfaceTaskDispatcherLike = {
  dispatchTaskMessage(input: SurfaceTaskDispatchInput): Promise<SurfaceTaskDispatchResult>;
};

export type SharedSurfaceRuntime = {
  permissionService: PermissionServiceLike;
  taskManager: TaskManagerLike;
  workflowRunService?: any;
  parser: ParserLike;
  taskOrchestrationController: TaskOrchestrationControllerLike;
  permissionController: PermissionControllerLike;
  workflowController?: WorkflowControllerLike;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  echoOutputStage?: Pick<EchoOutputStageService, 'deliver'> | null;
  hostIdentityService?: HostIdentityServiceLike | null;
  webUserId: string;
};
