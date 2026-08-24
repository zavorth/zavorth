import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  capabilityTierFromExposureMode,
  capabilityTierFromLane,
  capabilityTierFromRisk,
  capabilityTierLabel,
} from '../../../src/contracts/runtime/CapabilityTierPresentation.js';
import { NaturalFirstRunClassifier } from '../../../src/runtime/agent/NaturalFirstRunClassifier.js';
import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';
import { TrustedOperatorModeService } from '../../../src/services/power/TrustedOperatorModeService.js';

describe('Capability tier presentation alignment', () => {
  it('maps every internal risk dialect onto one vocabulary', () => {
    expect(capabilityTierFromRisk('safe')).toBe('safe-read');
    expect(capabilityTierFromRisk('attention')).toBe('confirm');
    expect(capabilityTierFromRisk('unknown')).toBe('confirm');
    expect(capabilityTierFromRisk('danger')).toBe('restricted');

    expect(capabilityTierFromLane('green')).toBe('safe-read');
    expect(capabilityTierFromLane('yellow')).toBe('confirm');
    expect(capabilityTierFromLane('red')).toBe('restricted');

    expect(capabilityTierFromExposureMode('safe')).toBe('safe-read');
    expect(capabilityTierFromExposureMode('confirm')).toBe('confirm');
    expect(capabilityTierFromExposureMode('unknown')).toBe('confirm');
    expect(capabilityTierFromExposureMode('restricted')).toBe('restricted');
  });

  it('never relaxes unknown or missing values beyond confirm', () => {
    expect(capabilityTierFromRisk('unknown' as 'safe')).toBe('confirm');
    expect(capabilityTierFromExposureMode('unknown')).not.toBe('safe-read');
  });

  it('labels tiers in operator-facing English', () => {
    expect(capabilityTierLabel('safe-read')).toMatch(/Safe read/);
    expect(capabilityTierLabel('confirm')).toMatch(/approval/i);
    expect(capabilityTierLabel('restricted')).toMatch(/approval phrase/);
  });

  it('exposes the aligned tier on tool exposure profiles', () => {
    const policy = new ToolExposurePolicy();
    const safeProfile = policy.buildProfile({ requestedTools: ['read_file', 'list_directory'] });
    expect(safeProfile.mode).toBe('safe');
    expect(safeProfile.tier).toBe('safe-read');

    const dangerProfile = policy.buildProfile({ requestedTools: ['shell.exec'] });
    expect(dangerProfile.mode).toBe('restricted');
    expect(dangerProfile.tier).toBe('restricted');
  });

  it('exposes the aligned tier on trusted operator decisions', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'zavorth-tier-'));
    try {
      const operator = new TrustedOperatorModeService({
        stateFile: path.join(tmp, 'trusted-operator-mode.json'),
      });
      const green = operator.decide({ risk: 'low', mutation: false });
      expect(green.lane).toBe('green');
      expect(green.tier).toBe('safe-read');

      const red = operator.decide({ risk: 'high', mutation: true });
      expect(red.lane).toBe('red');
      expect(red.tier).toBe('restricted');

      operator.enable('test');
      const yellow = operator.decide({ risk: 'medium', mutation: false });
      expect(yellow.lane).toBe('yellow');
      expect(yellow.tier).toBe('confirm');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('exposes the aligned tier on natural-first classification risk', () => {
    const classifier = new NaturalFirstRunClassifier();
    const safe = classifier.classify({ text: 'hello there', channel: 'cli' });
    expect(safe.risk.level).toBe('safe');
    expect(safe.risk.tier).toBe('safe-read');

    const sensitive = classifier.classify({
      text: 'run npm test',
      channel: 'telegram',
      requestedTools: ['shell.exec'],
    });
    expect(sensitive.risk.level).toBe('danger');
    expect(sensitive.risk.tier).toBe('restricted');
  });
});
