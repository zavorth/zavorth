import { SurfaceIdentityService } from '../services/SurfaceIdentityService.js';
import { TenantContextService } from '../services/TenantContextService.js';
import { TenantRegistryService } from '../services/TenantRegistryService.js';
import type {
  SurfaceTaskDispatchInput,
  SurfaceTaskDispatchResult,
  ParserLike,
  TaskOrchestrationControllerLike,
} from './SurfaceRuntime.js';

type SurfaceTaskDispatchDeps = {
  parser: ParserLike;
  taskOrchestrationController: TaskOrchestrationControllerLike;
  surfaceIdentityService?: SurfaceIdentityService;
  tenantContextService?: TenantContextService;
  tenantRegistryService?: TenantRegistryService;
};

export class SurfaceTaskDispatchService {
  private readonly surfaceIdentity: SurfaceIdentityService;
  private readonly tenantContext: TenantContextService;
  private readonly tenantRegistry: TenantRegistryService;

  constructor(private readonly deps: SurfaceTaskDispatchDeps) {
    this.surfaceIdentity = deps.surfaceIdentityService || new SurfaceIdentityService();
    this.tenantContext = deps.tenantContextService || new TenantContextService();
    this.tenantRegistry = deps.tenantRegistryService || new TenantRegistryService();
  }

  public async dispatchTaskMessage(input: SurfaceTaskDispatchInput): Promise<SurfaceTaskDispatchResult> {
    const platform = input.platform;
    const chatId = String(input.chatId || '').trim();
    const text = String(input.text || '').trim();
    const sourceUserId = String(input.sourceUserId || '').trim();
    const fallbackRuntimeUserId = String(input.fallbackRuntimeUserId || '').trim();
    const runtimeUserId = this.surfaceIdentity.resolveRuntimeUserId({
      source: platform,
      sourceUserId,
      fallbackRuntimeUserId,
    });
    const tenantContext =
      input.tenant ||
      this.tenantContext.resolveFromDispatchInput({
        ...input,
        fallbackRuntimeUserId: runtimeUserId,
      });
    this.tenantRegistry.observe(tenantContext);

    this.surfaceIdentity.linkIdentity({
      source: platform,
      sourceUserId,
      runtimeUserId,
      chatId: input.chatHint || chatId,
      sessionId: input.sessionId || null,
      linkedBy: input.identity?.linkedBy || this.defaultLinkedBy(platform),
      verificationMethod: input.identity?.verificationMethod || this.defaultVerificationMethod(platform),
    });

    const parsed = this.deps.parser.parse(text);
    const task = await this.deps.taskOrchestrationController.handleTaskMessage(input.ctx, {
      chatId,
      userId: runtimeUserId,
      text,
      parsed,
      source: input.source || platform,
      mentions: input.mentions,
      composer_payload: input.composerPayload || null,
      inlineData: input.inlineData,
      surfaceMetadata: {
        platform,
        sourceUserId,
        runtimeUserId,
        chatId,
        sessionId: input.sessionId || null,
        threadId: input.threadId || null,
        publicServerMode: input.surfacePolicy?.publicServerMode === true,
        forceApprovalForExecution: input.surfacePolicy?.forceApprovalForExecution === true,
        transport: input.surfacePolicy?.transport || null,
        tenant: tenantContext,
      },
    });

    return {
      task,
      parsed,
      runtimeUserId,
      sourceUserId,
      tenantId: tenantContext?.tenantId || null,
      tenantContext: tenantContext || null,
    };
  }

  private defaultLinkedBy(platform: string): string {
    switch (String(platform || '').trim().toLowerCase()) {
      case 'telegram':
        return 'telegram-auth';
      case 'web':
        return 'web-session';
      case 'discord':
        return 'discord-bridge';
      case 'whatsapp':
        return 'whatsapp-gateway';
      default:
        return `${platform}-runtime`;
    }
  }

  private defaultVerificationMethod(platform: string): string {
    switch (String(platform || '').trim().toLowerCase()) {
      case 'telegram':
        return 'telegram-auth-guard';
      case 'web':
        return 'zavorthControl-auth';
      case 'discord':
        return 'discord-bridge-signature';
      case 'whatsapp':
        return 'whatsapp-session';
      default:
        return 'runtime-trust';
    }
  }
}
