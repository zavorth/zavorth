import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, jest } from '@jest/globals';
import { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';
import { FirstRunPersonalizationService } from '../../src/services/FirstRunPersonalizationService.js';
import { ZavorthConversationalSetupService } from '../../src/services/ZavorthConversationalSetupService.js';

function makeService(projectRoot?: string): ZavorthConversationalSetupService {
  return new ZavorthConversationalSetupService({
    personalization: projectRoot
      ? new FirstRunPersonalizationService({ projectRoot })
      : undefined,
  });
}

describe('ZavorthConversationalSetupService', () => {
  it('builds an English-first business setup preview without mutating files', () => {
    const service = makeService();
    const snapshot = service.buildSnapshot({
      agentName: 'Zavorth',
      userName: 'Grey',
      preferredAddress: 'Grey',
      primaryUse: 'quero modo empresa com auditoria',
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
      primaryUse: 'token=super-secret-token-value',
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
        content: 'Qual é o seu nome?',
        toolCalls: [],
        finishReason: 'stop',
      });

      const result = await service.runFirstMessageIntake('test-session', [
        { role: 'user', content: 'Olá' }
      ]);

      expect(result.finished).toBe(false);
      expect(result.reply).toBe('Qual é o seu nome?');
      
      llmSpy.mockRestore();
    });

    it('finishes onboarding and applies config when all questions are answered', async () => {
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
      
      // Second mock call (for greeting completion summary)
      llmSpy.mockResolvedValueOnce({
        content: 'Setup completed successfully!',
        toolCalls: [],
        finishReason: 'stop',
      });

      const result = await service.runFirstMessageIntake('test-session', [
        { role: 'user', content: 'Use gpt-4o' }
      ], {
        type: 'nodejs',
        suggestedMission: 'review code'
      });

      expect(result.finished).toBe(true);
      expect(result.reply).toBe('Setup completed successfully!');
      
      expect(fs.existsSync(path.join(projectRoot, 'IDENTITY.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'USER.md'))).toBe(true);
      
      llmSpy.mockRestore();
    });
  });
});
