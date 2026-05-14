import { Context } from 'grammy';
import { PermissionRequest, PermissionStatus } from '../../contracts/PermissionRequest.js';
import { PermissionService } from '../../services/PermissionService.js';
import { TelegramPermissionDecisionService } from './TelegramPermissionDecisionService.js';
import { TelegramPermissionLookupService } from './TelegramPermissionLookupService.js';
import { TelegramPermissionMutationService } from './TelegramPermissionMutationService.js';
import { TelegramPermissionPolicyService } from './TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from './TelegramPermissionPresentationService.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';

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
          const limit = Number.parseInt(restParts[1] || '10', 10);
          const permissions = await this.permissionLookup.listPermissions(
            status,
            Number.isFinite(limit) ? limit : 10,
          );
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
          await ctx.reply('Subcomando desconhecido. Use: /perm [list|show|approve|reject|edit]');
      }
    } catch (error: any) {
      await ctx.reply(`Falha na operacao de permissao: ${error.message}`);
    }
  }

  public async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    return this.permissionLookup.resolvePermissionReference(ref);
  }
}
