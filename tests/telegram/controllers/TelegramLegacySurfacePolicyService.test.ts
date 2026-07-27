import {
  telegramLegacySurfacePolicyService,
} from '../../../src/telegram/controllers/TelegramLegacySurfacePolicyService';

describe('TelegramLegacySurfacePolicyService', () => {
  it('preserves the operator slash boundary without treating product commands as critical', () => {
    expect(telegramLegacySurfacePolicyService.isCriticalOperatorSlashCommand('/approve task-1', '/approve')).toBe(true);
    expect(telegramLegacySurfacePolicyService.isCriticalOperatorSlashCommand('/doctor desktop', '/doctor')).toBe(true);
    expect(telegramLegacySurfacePolicyService.isCriticalOperatorSlashCommand('/task revise o repo', '/task')).toBe(false);
    expect(telegramLegacySurfacePolicyService.isCriticalOperatorSlashCommand('revise o repo', '/task')).toBe(false);
  });

  it('points compatibility task commands back to natural language and the canonical loop', () => {
    const taskPrompt = telegramLegacySurfacePolicyService.buildCompatibilityTaskPrompt('/task');
    const autoPrompt = telegramLegacySurfacePolicyService.buildCompatibilityTaskPrompt('/auto');

    expect(taskPrompt).toMatch(/compatibilidade|compatibility/i);
    expect(taskPrompt).toContain('natural language');
    expect(taskPrompt).toContain('canonical agent loop');
    expect(autoPrompt).toMatch(/compatibilidade|compatibility/i);
    expect(autoPrompt).toContain('natural language');
    expect(autoPrompt).toContain('canonical agent loop');
  });

  it('does not advertise legacy executor shortcuts in the generic task fallback', () => {
    const message = telegramLegacySurfacePolicyService.buildTaskDispatchFallbackMessage('task-abcdef123');

    expect(message).toContain('Short reference: task-abc');
    expect(message).toMatch(/adapter fino|thin adapter/i);
    expect(message).toMatch(/canonical runtime|canonical|compatibility|natural language/i);
    expect(message).not.toContain('/codex');
    expect(message).not.toContain('/external');
    expect(message).not.toContain('/stitch');
    expect(message).not.toContain('/run');
    expect(message).not.toContain('/plan');
  });

  it('exposes thin-adapter metadata for natural message receipts', () => {
    expect(telegramLegacySurfacePolicyService.buildThinAdapterMetadata()).toEqual(
      expect.objectContaining({
        contract: 'telegram-thin-adapter',
        surface: 'telegram',
        telegramRole: 'thin-adapter',
        canonicalEntrypoint: 'ZavorthAgentGateway.handle',
        preservedBoundaries: expect.arrayContaining(['operator-commands', 'callbacks', 'approval', 'diagnostics', 'emergency']),
        retiredProductPaths: expect.arrayContaining(['menus', 'hubs', 'chat-cleanup']),
      }),
    );
  });
});
