import { Context, InlineKeyboard } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { TelegramPermissionCallbackService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionCallbackService.js';
import { TelegramPermissionDecisionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionKeyboardService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionKeyboardService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';

export type TelegramPermissionInteractionServiceDeps = {
  permissionDecision: TelegramPermissionDecisionService;
  permissionPolicy: TelegramPermissionPolicyService;
  resolvePermissionReference: (ref: string) => Promise<PermissionRequest>;
  shortPermissionId: (permission: PermissionRequest) => string;
  assertHostWritable: () => void;
};

export class TelegramPermissionInteractionService {
  private readonly callbackService: TelegramPermissionCallbackService;
  private readonly keyboardService: TelegramPermissionKeyboardService;

  constructor(private readonly deps: TelegramPermissionInteractionServiceDeps) {
    this.callbackService = new TelegramPermissionCallbackService({
      permissionDecision: this.deps.permissionDecision,
      permissionPolicy: this.deps.permissionPolicy,
      resolvePermissionReference: this.deps.resolvePermissionReference,
      assertHostWritable: this.deps.assertHostWritable,
    });
    this.keyboardService = new TelegramPermissionKeyboardService({
      shortPermissionId: this.deps.shortPermissionId,
    });
  }

  public async handlePermissionCallback(ctx: Context, data: string): Promise<void> {
    await this.callbackService.handlePermissionCallback(ctx, data);
  }

  public buildPermissionKeyboard(permission: PermissionRequest): InlineKeyboard {
    return this.keyboardService.buildPermissionKeyboard(permission);
  }
}
