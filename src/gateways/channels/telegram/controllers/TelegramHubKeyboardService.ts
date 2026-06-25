import { InlineKeyboard } from 'grammy';
import { HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export class TelegramHubKeyboardService {
  public buildHubKeyboard(section: HubSection): InlineKeyboard {
    if (section === 'onboarding1') {
      return new InlineKeyboard()
        .text('Sair do tour', 'hub:page:overview')
        .text('Proximo', 'hub:page:onboarding2');
    }

    if (section === 'onboarding2') {
      return new InlineKeyboard()
        .text('Voltar', 'hub:page:onboarding1')
        .text('Proximo', 'hub:page:onboarding3');
    }

    if (section === 'onboarding3') {
      return new InlineKeyboard()
        .text('Voltar', 'hub:page:onboarding2')
        .text('Finalizar tour', 'hub:page:overview');
    }

    const keyboard = new InlineKeyboard()
      .text(this.hubTabLabel('overview', section, 'Inicio'), 'hub:page:overview')
      .text(this.hubTabLabel('permissions', section, 'Permissoes'), 'hub:page:permissions')
      .row()
      .text(this.hubTabLabel('security', section, 'Seguranca'), 'hub:page:security')
      .text(this.hubTabLabel('settings', section, 'Ajustes'), 'hub:page:settings')
      .row()
      .text(this.hubTabLabel('actions', section, 'Diagnostico'), 'hub:page:actions');

    if (section === 'actions') {
      keyboard
        .row()
        .text('Status', 'hub:action:status')
        .text('Modelos', 'hub:action:models')
        .row()
        .text('Dashboard', 'hub:action:dashboard')
        .text('Pendencias', 'hub:action:permissions')
        .row()
        .text('Modo', 'hub:action:mode')
        .text('WSL', 'hub:action:wsl')
        .row()
        .text('Auditoria', 'hub:action:audit')
        .text('Ajuda', 'hub:action:help');
    } else if (section === 'settings') {
      keyboard
        .row()
        .text('Ver status', 'hub:action:status')
        .text('Ver modelos', 'hub:action:models')
        .row()
        .text('Alterar modo', 'hub:action:mode')
        .text('Abrir dashboard', 'hub:action:dashboard');
    } else if (section === 'permissions') {
      keyboard
        .row()
        .text('Ver pendencias', 'hub:action:permissions')
        .row()
        .text('Abrir auditoria', 'hub:action:audit');
    }

    return keyboard;
  }

  private hubTabLabel(tab: HubSection, current: HubSection, label: string): string {
    return tab === current ? `OK ${label}` : label;
  }
}
