import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { MessageChannel, TaskSource } from '../contracts/PlatformContract.js';
import type { WebComposerMention } from '../contracts/WebComposer.js';
import type { MessageTransportKind } from '../contracts/IMessageBroker.js';
import type { TenantContext } from '../contracts/TenantContext.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { EchoOutputStageService } from '../services/EchoOutputStageService.js';

// Task object returned by the task manager
export type SurfaceTask = {
  id: string;
  status: string;
  title?: string;
  chatId?: string;
  // Index signature required: actual runtime objects carry dynamic Task properties (workspace, executor_used, summary, etc.)
  [key: string]: unknown;
};

// Parsed message result from the parser
export type ParsedSurfaceMessage = {
  type: string;
  intent?: string;
  // Index signature required: parsers may attach dynamic properties (command_type, command_args, etc.)
  [key: string]: unknown;
};

// Context passed to surface controllers
export type SurfaceControllerContext = {
  userId?: string;
  chatId?: string;
  platform?: MessageChannel;
  tenant?: TenantContext | null;
  // Index signature required: arbitrary objects are cast to this type via `as unknown as SurfaceControllerContext`
  [key: string]: unknown;
};

// Workflow run service contract
export type WorkflowRunServiceLike = {
  startRun?(input: unknown): Promise<unknown>;
  getRun?(runId: string): Promise<unknown>;
  // Index signature required: duck-typed service implementations may expose additional methods
  [key: string]: unknown;
};

export type PermissionServiceLike = {
  listRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'all',
    limit?: number,
  ): Promise<PermissionRequest[]>;
};

export type TaskManagerLike = {
  getRecentTasks?(limit?: number, userId?: string): SurfaceTask[];
  getRecentTasksByChat(chatId: string, limit?: number): SurfaceTask[];
  getTask(taskId: string): SurfaceTask;
};

export type ParserLike = {
  parse(rawMessage: string): ParsedSurfaceMessage;
};

export type TaskOrchestrationControllerLike = {
  handleTaskMessage(ctx: SurfaceControllerContext, input: unknown): Promise<SurfaceTask>;
};

export type PermissionControllerLike = {
  resolvePermissionReference(ref: string): Promise<PermissionRequest>;
  shortPermissionId(permission: PermissionRequest): string;
  handlePermissionCallback(ctx: SurfaceControllerContext, data: string): Promise<void>;
  handleApproval(ctx: SurfaceControllerContext, args: string): Promise<void>;
  handleRejection(ctx: SurfaceControllerContext, taskId: string): Promise<void>;
  formatPermissionCreatedMessage(permission: PermissionRequest): string;
};

export type WorkflowControllerLike = {
  handleWorkflow(ctx: SurfaceControllerContext, args: string): Promise<void>;
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
  ctx: SurfaceControllerContext;
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
  composerPayload?: Record<string, unknown> | null;
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
  task: SurfaceTask;
  parsed: ParsedSurfaceMessage;
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
  workflowRunService?: WorkflowRunServiceLike;
  parser: ParserLike;
  taskOrchestrationController: TaskOrchestrationControllerLike;
  permissionController: PermissionControllerLike;
  workflowController?: WorkflowControllerLike;
  surfaceTaskDispatcher?: SurfaceTaskDispatcherLike;
  legacyUnifiedGateway?: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null;
  echoOutputStage?: Pick<EchoOutputStageService, 'deliver'> | null;
  hostIdentityService?: HostIdentityServiceLike | null;
  webUserId: string;
  projectRoot?: string;
};
