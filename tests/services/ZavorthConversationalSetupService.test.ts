import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, jest } from '@jest/globals';
import { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';
import { FirstRunPersonalizationService } from '../../src/services/FirstRunPersonalizationService.js';
import { ZavorthConversationalSetupService } from '../../src/services/ZavorthConversationalSetupService.js';
import { ConversationalSetupStateStore } from '../../src/services/onboarding/ConversationalSetupStateStore.js';

function makeService(projectRoot-: string): ZavorthConversationalSetupService {
  return new ZavorthConversationalSetupService({
    personalization: projectRoot ? new FirstRunPersonalizationService({ projectRoot }) : undefined,
    stateStore: new ConversationalSetupStateStore({
      projectRoot: projectRoot || fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-state-')),
    }),
  });
}

describe('ZavorthConversationalSetupService', () => {
  it('builds an English-first business setup preview without mutating files', () => {
    const service = makeService();
    const snapshot = service.buildSnapshot({
      agentName: 'Zavorth',
      userName: 'Grey',
      preferredAddress: 'Grey',
      uiLocale: 'en-US',
      primaryUse: 'quero modo empresa com audit',
      approvalChannel: 'dashboard',
      firstSafeMission: 'safe audit',
    });

    expect(snapshot.surface).toBe('conversational-setup');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.uiLanguage).toBe('en-US');
    expect(snapshot.answers.preferredLanguage).toBe('English');
    expect(snapshot.answers.experienceProfileId).toBe('business');
    expect(snapshot.writePlan.previewOnly).toBe(true);
    expect(snapshot.applyResult).toBeNull();
  });

  it('blocks and redacts raw secret-like setup answers', () => {
    const service = makeService();
    const snapshot = service.buildSnapshot({
      agentName: 'Zavorth',
      userName: 'Grey',
      primaryUse: 'token=[redacted-secret]',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.safety.rawSecretDetected).toBe(true);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(serialized).not.toContain('super-secret-token-value');
    expect(serialized).toContain('[REDACTED_SECRET]');
  });

  it('refuses apply unless local profile confirmation is explicit', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-no-confirm-'));
    const service = makeService(projectRoot);

    const snapshot = service.buildSnapshot({
      agentName: 'Vritra',
      userName: 'Grey',
      preferredAddress: 'Grey',
      language: 'en-US',
      experienceProfile: 'developer',
      apply: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.applyResult).toBeNull();
    expect(fs.existsSync(path.join(projectRoot, 'IDENTITY.md'))).toBe(false);
  });

  it('applies local identity and user calibration after confirmation', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-apply-'));
    const service = makeService(projectRoot);

    const snapshot = service.buildSnapshot({
      agentName: 'Vritra',
      userName: 'Grey Vritra',
      preferredAddress: 'Grey',
      language: 'en-US',
      experienceProfile: 'developer',
      detailLevel: 'advanced',
      apply: true,
      confirmLocalProfile: true,
    });

    expect(snapshot.status).toBe('applied');
    expect(snapshot.writePlan.previewOnly).toBe(false);
    expect(snapshot.applyResult?.writtenFiles.length).toBe(8);
    expect(fs.readFileSync(path.join(projectRoot, 'IDENTITY.md'), 'utf8')).toContain('Vritra');
    expect(fs.readFileSync(path.join(projectRoot, 'USER.md'), 'utf8')).toContain('Grey Vritra');
    expect(fs.readFileSync(path.join(projectRoot, 'SOUL.md'), 'utf8')).toContain('User Calibration');

    const rendered = service.renderText(snapshot);
    expect(rendered).toContain('[complete]');
    // i18n may resolve en-US or pt-BR from host locale; learning tip must always mention promote path.
    expect(rendered).toMatch(/Setup Complete|Configuration Complete/);
    expect(rendered).toMatch(/\/learn|zavorth learn/i);
    expect(rendered).toMatch(/skill drafts|rascunhos de skill/i);
  });

  describe('runFirstMessageIntake', () => {
    it('asks the next pending question when onboarding is incomplete', async () => {
      const service = makeService();
      const llmSpy = jest.spyOn(LlmRuntimeService.prototype, 'chat');

      // First mock call (for JSON extraction)
      llmSpy.mockResolvedValueOnce({
        content: JSON.stringify({
          agentName: null,
          userName: null,
          language: null,
          experienceProfile: null,
          detailLevel: null,
          primaryUse: null,
        }),
        toolCalls: [],
        finishReason: 'stop',
      });

      // Second mock call (for generating the question)
      llmSpy.mockResolvedValueOnce({
        content: 'What is your name-',
        toolCalls: [],
        finishReason: 'stop',
      });

      const result = await service.runFirstMessageIntake('test-session', [{ role: 'user', content: 'Hello' }]);

      expect(result.finished).toBe(false);
      expect(result.status).toBe('collecting');
      expect(result.reply).toBe('What is your name-');

      llmSpy.mockRestore();
    });

    it('falls back to the contract question when no LLM provider is configured', async () => {
      const service = makeService();
      const llmSpy = jest
        .spyOn(LlmRuntimeService.prototype, 'chat')
        .mockRejectedValue(new Error('No provider selected.'));

      const result = await service.runFirstMessageIntake('offline-session', [{ role: 'user', content: 'Hello' }]);

      expect(result).toEqual({
        finished: false,
        reply: expect.stringContaining('agent'),
        status: 'collecting',
      });
      expect(llmSpy).toHaveBeenCalledTimes(2);

      llmSpy.mockRestore();
    });

    it('persists a preview and applies only after explicit token confirmation', async () => {
      const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-intake-apply-'));
      const service = makeService(projectRoot);
      const llmSpy = jest.spyOn(LlmRuntimeService.prototype, 'chat');

      // First mock call (for JSON extraction)
      llmSpy.mockResolvedValueOnce({
        content: JSON.stringify({
          agentName: 'Zavorth',
          userName: 'Grey',
          language: 'English',
          experienceProfile: 'developer',
          detailLevel: 'advanced',
          primaryUse: 'development',
        }),
        toolCalls: [],
        finishReason: 'stop',
      });

      const preview = await service.runFirstMessageIntake(
        'test-session',
        [{ role: 'user', content: 'Use gpt-4o' }],
        {
          type: 'nodejs',
          suggestedMission: 'review code',
        },
        { locale: 'en-US' },
      );

      expect(preview.finished).toBe(false);
      expect(preview.status).toBe('awaiting_confirmation');
      expect(preview.confirmationToken).toEqual(expect.any(String));
      expect(fs.existsSync(path.join(projectRoot, 'IDENTITY.md'))).toBe(false);

      const applied = await service.runFirstMessageIntake('test-session', [], undefined, {
        confirmPreviewToken: preview.confirmationToken,
      });
      expect(applied.finished).toBe(true);
      expect(applied.status).toBe('applied');
      expect(applied.reply).toMatch(/\/learn/);
      expect(fs.existsSync(path.join(projectRoot, 'IDENTITY.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'USER.md'))).toBe(true);

      const replay = await service.runFirstMessageIntake('test-session', [], undefined, {
        confirmPreviewToken: preview.confirmationToken,
      });
      expect(replay.status).toBe('confirmation_invalid');

      llmSpy.mockRestore();
    });

    it('uses the requested device locale for deterministic prompts', async () => {
      const service = makeService();
      const llmSpy = jest.spyOn(LlmRuntimeService.prototype, 'chat').mockRejectedValue(new Error('offline'));

      const result = await service.runFirstMessageIntake('pt-session', [], undefined, { locale: 'pt-BR' });

      expect(result.reply).toContain('agente');
      expect(result.status).toBe('collecting');
      llmSpy.mockRestore();
    });
  });
});
