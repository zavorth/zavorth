import { InlineKeyboard } from 'grammy';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';

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
        .text('Liberar leitura so nesta tarefa', `perm:approve:${shortId}:once`)
        .text('Liberar leitura neste projeto', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      keyboard
        .text('Liberar leitura so nesta tarefa', `perm:approve:${shortId}:once`)
        .text('Liberar leitura neste projeto', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      keyboard
        .text('Aprovar conversa', `perm:approve:${shortId}:session`)
        .text('Aprovar uma vez', `perm:approve:${shortId}:once`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      keyboard
        .text('Liberar so esta tarefa', `perm:approve:${shortId}:once`)
        .text('Liberar neste projeto', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      keyboard
        .text('Permitir so esta tarefa', `perm:approve:${shortId}:once`)
        .text('Permitir neste projeto', `perm:approve:${shortId}:workspace`)
        .row()
        .text('Rejeitar', `perm:reject:${shortId}`);
      return keyboard;
    }

    keyboard
      .text('Aprovar', `perm:approve:${shortId}:once`)
      .text('Rejeitar', `perm:reject:${shortId}`);
    return keyboard;
  }
}
