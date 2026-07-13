import { InlineKeyboard } from 'grammy';
import { PermissionRequest } from '@zavorth/contracts/PermissionRequest.js';

export type TelegramPermissionKeyboardServiceDeps = {
  shortPermissionId: (permission: PermissionRequest) => string;
};

export class TelegramPermissionKeyboardService {
  constructor(private readonly deps: TelegramPermissionKeyboardServiceDeps) {}

  public buildPermissionKeyboard(permission: PermissionRequest): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    const shortId = this.deps.shortPermissionId(permission);

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      keyboard
        .text('Usar neste projeto', `perm:approve:${shortId}:workspace`)
        .text('Salvar para futuros pedidos', `perm:approve:${shortId}:persistent`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      keyboard
        .text('Allow read-only for this task only', `perm:approve:${shortId}:once`)
        .text('Allow read-only for this project', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Reject', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      keyboard
        .text('Allow read-only for this task only', `perm:approve:${shortId}:once`)
        .text('Allow read-only for this project', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Reject', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      keyboard
        .text('Approve conversation', `perm:approve:${shortId}:session`)
        .text('Approve once', `perm:approve:${shortId}:once`)
        .row()
        .text('Reject', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      keyboard
        .text('Allow for this task only', `perm:approve:${shortId}:once`)
        .text('Allow for this project', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Reject', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      keyboard
        .text('Allow for this task only', `perm:approve:${shortId}:once`)
        .text('Allow for this project', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Reject', `perm:reject:${shortId}`);
      return keyboard;
    }

    // Standard agent permission choices (Hermes/MiMo style) on every permission type.
    keyboard
      .text('Run once', `perm:approve:${shortId}:once`)
      .text('Session', `perm:approve:${shortId}:session`)
      .row()
      .text('Always', `perm:approve:${shortId}:persistent`)
      .text('Deny', `perm:reject:${shortId}`);
    return keyboard;
  }
}
