import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from '@jest/globals';
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
    expect(snapshot.applyResult?.writtenFiles.length).toBe(3);
    expect(fs.readFileSync(path.join(projectRoot, 'IDENTITY.md'), 'utf8')).toContain('Vritra');
    expect(fs.readFileSync(path.join(projectRoot, 'USER.md'), 'utf8')).toContain('Grey Vritra');
    expect(fs.readFileSync(path.join(projectRoot, 'SOUL.md'), 'utf8')).toContain('User Calibration');
  });
});
