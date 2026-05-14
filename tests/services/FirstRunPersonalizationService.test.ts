import fs from 'fs';
import os from 'os';
import path from 'path';
import { FirstRunPersonalizationService } from '../../src/services/FirstRunPersonalizationService';

describe('FirstRunPersonalizationService', () => {
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-personalization-'));
    fs.writeFileSync(path.join(tempDir, 'IDENTITY.md'), [
      '# IDENTITY.md - Canonical Identity',
      '',
      '- **Primary name:** Zavorth',
      '- **Short name:** Zavorth',
      '- **How you introduce yourself:** Zavorth',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'USER.md'), [
      '# USER.md - Human Profile',
      '',
      '## Identity',
      '',
      '- **Name:**',
      '- **What to call them:**',
      '- **Primary language:**',
      '',
      '## Communication defaults',
      '',
      '- **Preferred tone from the agent:**',
      '- **Default response density:**',
      '',
      '## Collaboration style',
      '',
      '- **Initiative level:**',
      '- **Candor level:**',
      '- **How much challenge they want:**',
      '- **External action posture:**',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'SOUL.md'), [
      '# SOUL.md - Zavorth Personality',
      '',
      '## Baseline character',
      '',
      'You are calm.',
      '',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'BOOTSTRAP.md'), 'pending\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects pending first-run personalization from bootstrap and blank user fields', () => {
    const service = new FirstRunPersonalizationService({ projectRoot: tempDir });

    const status = service.getStatus();

    expect(status.pending).toBe(true);
    expect(status.bootstrapExists).toBe(true);
    expect(status.missingUserFields).toEqual(expect.arrayContaining([
      'Name',
      'What to call them',
      'Preferred tone from the agent',
    ]));
  });

  it('writes identity, user and soul calibration without removing bootstrap unless approved', () => {
    const service = new FirstRunPersonalizationService({ projectRoot: tempDir });

    const result = service.applyAnswers({
      agentName: 'Zavorth',
      userName: 'Ermeson',
      preferredAddress: 'Ermeson',
      primaryLanguage: 'en-US',
      preferredTone: 'calm, technical, lightly playful',
      responseDensity: 'balanced',
      initiativeLevel: 'proactive internally; ask before risky action',
      candorLevel: 'honest and respectful',
      challengePreference: 'call out weak ideas early',
      externalActionPosture: 'ask before public or irreversible action',
    });

    expect(result.removedBootstrap).toBe(false);
    expect(fs.existsSync(path.join(tempDir, 'BOOTSTRAP.md'))).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, 'USER.md'), 'utf8')).toContain('- **What to call them:** Ermeson');
    expect(fs.readFileSync(path.join(tempDir, 'SOUL.md'), 'utf8')).toContain('## User Calibration');
    expect(fs.readFileSync(path.join(tempDir, 'SOUL.md'), 'utf8')).toContain('calm, technical, lightly playful');
  });

  it('marks personalization complete when bootstrap removal is explicitly approved', () => {
    const service = new FirstRunPersonalizationService({ projectRoot: tempDir });

    const result = service.applyAnswers({
      preferredAddress: 'Ermeson',
      preferredTone: 'sober, warm, direct',
      responseDensity: 'balanced',
      initiativeLevel: 'proactive internally; ask before risky action',
      candorLevel: 'honest and respectful',
      externalActionPosture: 'ask before public or irreversible action',
    }, { completeBootstrap: true });

    expect(result.removedBootstrap).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'BOOTSTRAP.md'))).toBe(false);
    expect(result.status.pending).toBe(false);
  });
});
