import fs from 'fs';
import path from 'path';
import { ZavorthLocalProfilePreferenceService } from '../../src/services/ZavorthLocalProfilePreferenceService.js';

function tempStateFile(name: string): string {
  return path.resolve(process.cwd(), 'tmp', `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe('ZavorthLocalProfilePreferenceService', () => {
  it('defaults preferences without creating local state', () => {
    const stateFilePath = tempStateFile('local-profile-preferences-default');
    const service = new ZavorthLocalProfilePreferenceService({
      stateFilePath,
      now: () => new Date('2026-05-09T10:00:00.000Z'),
    });

    const result = service.readBoolean({
      userId: 'local-owner',
      profileId: 'default',
      namespace: 'command-center',
      key: 'business-mode.enabled',
      defaultValue: false,
    });

    expect(result).toMatchObject({
      profileKey: 'local-owner::default',
      value: false,
      exists: false,
      updatedBy: 'default',
      source: 'backend-preferences',
    });
    expect(result.receipts).toContain('local-profile-preferences-do-not-store-secrets');
    expect(fs.existsSync(stateFilePath)).toBe(false);
  });

  it('persists preferences per local profile scope', () => {
    const stateFilePath = tempStateFile('local-profile-preferences-persisted');
    const first = new ZavorthLocalProfilePreferenceService({
      stateFilePath,
      now: () => new Date('2026-05-09T10:00:00.000Z'),
    });

    first.setBoolean({
      userId: 'local-owner',
      profileId: 'studio',
      namespace: 'sales-pack',
      key: 'business-mode.enabled',
      value: true,
      updatedBy: 'command-center',
    });

    const second = new ZavorthLocalProfilePreferenceService({
      stateFilePath,
      now: () => new Date('2026-05-09T10:05:00.000Z'),
    });

    expect(second.readBoolean({
      userId: 'local-owner',
      profileId: 'studio',
      namespace: 'sales-pack',
      key: 'business-mode.enabled',
    })).toMatchObject({
      profileKey: 'local-owner::studio',
      value: true,
      exists: true,
      updatedAt: '2026-05-09T10:00:00.000Z',
      updatedBy: 'command-center',
    });
    expect(second.readBoolean({
      userId: 'local-owner',
      profileId: 'home',
      namespace: 'sales-pack',
      key: 'business-mode.enabled',
    }).value).toBe(false);
  });

  it('rejects secret-looking preference values', () => {
    const service = new ZavorthLocalProfilePreferenceService({
      stateFilePath: tempStateFile('local-profile-preferences-secret'),
    });

    expect(() => service.setPreference({
      userId: 'local-owner',
      profileId: 'default',
      namespace: 'test',
      key: 'bad',
      value: 'sk-verysecretvalue123456',
      updatedBy: 'test',
    })).toThrow('cannot store secret-looking values');
  });
});
