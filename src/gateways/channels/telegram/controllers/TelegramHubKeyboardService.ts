import { InlineKeyboard } from 'grammy';
import { HubSection } from '../../../../gateways/channels/telegram/controllers/TelegramHubTypes.js';

export class TelegramHubKeyboardService {
  public buildHubKeyboard(section: HubSection): InlineKeyboard {
    if (section === 'onboarding1') {
      return new InlineKeyboard()
        .text('Exit tour', 'hub:page:overview')
        .text('Next', 'hub:page:onboarding2');
    }

    if (section === 'onboarding2') {
      return new InlineKeyboard()
        .text('Back', 'hub:page:onboarding1')
        .text('Next', 'hub:page:onboarding3');
    }

    if (section === 'onboarding3') {
      return new InlineKeyboard()
        .text('Back', 'hub:page:onboarding2')
        .text('Finish tour', 'hub:page:overview');
    }

    const keyboard = new InlineKeyboard()
      .text(this.hubTabLabel('overview', section, 'Home'), 'hub:page:overview')
      .text(this.hubTabLabel('permissions', section, 'Permissions'), 'hub:page:permissions')
      .row()
      .text(this.hubTabLabel('security', section, 'Security'), 'hub:page:security')
      .text(this.hubTabLabel('settings', section, 'Settings'), 'hub:page:settings')
      .row()
      .text(this.hubTabLabel('actions', section, 'Diagnostics'), 'hub:page:actions');

    if (section === 'actions') {
      keyboard
        .row()
        .text('Status', 'hub:action:status')
        .text('Models', 'hub:action:models')
        .row()
        .text('ZavorthControl', 'hub:action:zavorthControl')
        .text('Pending', 'hub:action:permissions')
        .row()
        .text('Mode', 'hub:action:mode')
        .text('WSL', 'hub:action:wsl')
        .row()
        .text('Audit', 'hub:action:audit')
        .text('Help', 'hub:action:help');
    } else if (section === 'settings') {
      keyboard
        .row()
        .text('View status', 'hub:action:status')
        .text('View models', 'hub:action:models')
        .row()
        .text('Change mode', 'hub:action:mode')
        .text('Open zavorthControl', 'hub:action:zavorthControl');
    } else if (section === 'permissions') {
      keyboard
        .row()
        .text('View pending items', 'hub:action:permissions')
        .row()
        .text('Open audit', 'hub:action:audit');
    }

    return keyboard;
  }

  private hubTabLabel(tab: HubSection, current: HubSection, label: string): string {
    return tab === current ? `OK ${label}` : label;
  }
}
