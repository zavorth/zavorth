import { Context } from 'grammy';
import {PermissionRequest} from '@zavorth/contracts/PermissionRequest.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';
import { TelegramPermissionDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionLookupService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionLookupService.js';
import { TelegramPermissionMutationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionMutationService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationService.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';
import { logger } from '../../../../logger.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export type TelegramPermissionCommandServiceDeps = {
  permissionService: PermissionService;
  permissionPolicy: TelegramPermissionPolicyService;
  permissionPresentation: TelegramPermissionPresentationService;
  permissionDecision: TelegramPermissionDecisionService;
  assertHostWritable: () => void;
};

export class TelegramPermissionCommandService {
  private readonly permissionLookup: TelegramPermissionLookupService;
  private readonly permissionMutations: TelegramPermissionMutationService;

  constructor(private readonly deps: TelegramPermissionCommandServiceDeps) {
    this.permissionLookup = new TelegramPermissionLookupService({
      permissionService: this.deps.permissionService,
    });
    this.permissionMutations = new TelegramPermissionMutationService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.deps.permissionPolicy,
      permissionPresentation: this.deps.permissionPresentation,
      permissionDecision: this.deps.permissionDecision,
      resolvePermissionReference: (ref) => this.resolvePermissionReference(ref),
      assertHostWritable: this.deps.assertHostWritable,
    });
  }

  public async handlePermissionAllowCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionMutations.handlePermissionAllowCommand(ctx, args);
  }

  public async handlePermissionRevokeCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionMutations.handlePermissionRevokeCommand(ctx, args);
  }

  public async handlePermissionCommand(ctx: Context, args: string): Promise<void> {
    const trimmedArgs = String(args || '').trim();
    const [subcommandRaw, ...restParts] = trimmedArgs.split(/\s+/).filter(Boolean);
    const subcommand = (subcommandRaw || 'list').toLowerCase();
    const userId = ctx.from?.id.toString() || '';

    try {
      switch (subcommand) {
        case 'list': {
          const statusToken = (restParts[0] || 'pending').toLowerCase();
          const status = this.deps.permissionPolicy.normalizePermissionStatus(statusToken);
          const limit = safeParseInt(restParts[1], 10);
          const permissions = await this.deps.permissionService.listRequests(status, limit);
          await replyWithTelegramSurfaceResponse(
            ctx,
            this.deps.permissionPresentation.buildPermissionListSurfaceResponse(permissions, status),
          );
          return;
        }
        case 'show': {
          const permission = await this.resolvePermissionReference(restParts[0] || '');
          await replyWithTelegramSurfaceResponse(
            ctx,
            this.deps.permissionPresentation.buildPermissionDetailsSurfaceResponse(permission),
          );
          return;
        }
        case 'edit': {
          await this.permissionMutations.handleEditCommand(
            ctx,
            restParts[0] || '',
            restParts.slice(1).join(' '),
          );
          return;
        }
        case 'approve': {
          await this.permissionMutations.handleApproveCommand(
            ctx,
            restParts[0] || '',
            restParts.slice(1).join(' '),
            userId,
          );
          return;
        }
        case 'reject': {
          await this.permissionMutations.handleRejectCommand(
            ctx,
            restParts[0] || '',
            restParts.slice(1).join(' '),
            userId,
          );
          return;
        }
        default:
          await ctx.reply('Unknown subcommand. Use: /perm [list|show|approve|reject|edit]');
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const msg = error instanceof Error ? err.message : String(error);
      logger.error(`[TelegramPermission] Permission operation failed (${subcommand}): ${msg}`, error);
      await ctx.reply(`Permission operation failed: ${msg}`);
    }
  }

  public async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    return this.permissionLookup.resolvePermissionReference(ref);
  }
}
