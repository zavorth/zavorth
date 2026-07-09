import { TelegramHubKeyboardService } from '../../../src/telegram/controllers/TelegramHubKeyboardService';
import type { HubSection } from '../../../src/telegram/controllers/TelegramHubTypes';

function callbacksFor(section: HubSection): string[] {
  const keyboard = new TelegramHubKeyboardService().buildHubKeyboard(section);
  return keyboard.inline_keyboard
    .flat()
    .map((button: any) => button.callback_data)
    .filter(Boolean);
}

describe('TelegramHubKeyboardService', () => {
  it('keeps the main hub keyboard constrained to support-only buttons', () => {
    const callbacks = callbacksFor('overview');

    expect(callbacks).toEqual(expect.arrayContaining([
      'hub:page:overview',
      'hub:page:permissions',
      'hub:page:security',
      'hub:page:settings',
      'hub:page:actions',
    ]));
    expect(callbacks).not.toEqual(expect.arrayContaining([
      'hub:page:quickstart',
      'hub:page:recipes',
      'hub:page:integrations',
      'hub:page:skills',
      'hub:page:onboarding1',
    ]));
  });

  it('keeps operator diagnostics and approval actions available inline', () => {
    expect(callbacksFor('actions')).toEqual(expect.arrayContaining([
      'hub:action:status',
      'hub:action:models',
      'hub:page:overview',
      'hub:action:permissions',
      'hub:action:mode',
      'hub:action:wsl',
      'hub:action:audit',
    ]));
    expect(callbacksFor('permissions')).toEqual(expect.arrayContaining([
      'hub:action:permissions',
      'hub:action:audit',
    ]));
  });

  it('does not expose recipe or skill launchers as inline hub buttons', () => {
    const callbacks = [
      ...callbacksFor('recipes'),
      ...callbacksFor('skills'),
    ];

    expect(callbacks).not.toEqual(expect.arrayContaining([
      'hub:action:recipe_codex',
      'hub:action:recipe_external_executor',
      'hub:action:recipe_zavorthBridge',
      'hub:action:skills_library',
      'hub:action:skills_plan',
      'hub:action:skills_mcp',
    ]));
  });
});
