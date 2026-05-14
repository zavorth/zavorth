import fs from 'fs';
import path from 'path';
import { SalesPackBusinessModeService } from '../../../src/services/SalesPackBusinessModeService.js';

function tempStateFile(name: string): string {
  return path.resolve(process.cwd(), 'tmp', `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

describe('SalesPackBusinessModeService', () => {
  it('defaults Business Mode off without creating secrets or guessing profile state', () => {
    const stateFilePath = tempStateFile('sales-pack-business-mode-default');
    const service = new SalesPackBusinessModeService({
      stateFilePath,
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const snapshot = service.readSnapshot({ userId: 'maria', profileId: 'home' });

    expect(snapshot).toMatchObject({
      userId: 'maria',
      profileId: 'home',
      profileKey: 'maria::home',
      enabled: false,
      updatedBy: 'default',
      source: 'backend',
    });
    expect(snapshot.receipts).toContain('business-mode-does-not-store-secrets');
    expect(fs.existsSync(stateFilePath)).toBe(false);
  });

  it('persists Business Mode per user/profile for later devices', () => {
    const stateFilePath = tempStateFile('sales-pack-business-mode-persisted');
    const first = new SalesPackBusinessModeService({
      stateFilePath,
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const enabled = first.setEnabled({
      userId: 'maria',
      profileId: 'home',
      enabled: true,
      updatedBy: 'command-center',
    });
    expect(enabled.enabled).toBe(true);

    const second = new SalesPackBusinessModeService({
      stateFilePath,
      now: () => new Date('2026-05-08T12:05:00.000Z'),
    });
    const restored = second.readSnapshot({ userId: 'maria', profileId: 'home' });

    expect(restored).toMatchObject({
      profileKey: 'maria::home',
      enabled: true,
      updatedAt: '2026-05-08T12:00:00.000Z',
      updatedBy: 'command-center',
    });
  });

  it('isolates Business Mode between users and profiles', () => {
    const stateFilePath = tempStateFile('sales-pack-business-mode-isolated');
    const service = new SalesPackBusinessModeService({
      stateFilePath,
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    service.setEnabled({
      userId: 'maria',
      profileId: 'business',
      enabled: true,
      updatedBy: 'test',
    });

    expect(service.readSnapshot({ userId: 'maria', profileId: 'business' }).enabled).toBe(true);
    expect(service.readSnapshot({ userId: 'maria', profileId: 'home' }).enabled).toBe(false);
    expect(service.readSnapshot({ userId: 'joao', profileId: 'business' }).enabled).toBe(false);
  });
});
