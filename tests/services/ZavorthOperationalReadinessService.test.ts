import * as fs from 'fs';
import { resolve } from 'node:path';
import * as os from 'os';
import * as path from 'path';
import { ZavorthOperationalReadinessService } from '../../src/services/ZavorthOperationalReadinessService';


describe('ZavorthOperationalReadinessService', () => {
  it('certifies the native control-plane domains without secrets or network calls', () => {
    const projectRoot = resolve(__dirname, '..', '..');
    const snapshot = new ZavorthOperationalReadinessService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    }).buildSnapshot(projectRoot);

    expect(snapshot.contractVersion).toBe('zavorth-operational-consistency/1');
    expect(snapshot.status).toBe('pass');
    expect(snapshot.score).toBe(100);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noSecretsRead: true,
      noNetworkCalls: true,
      noRuntimeAdapterCode: true,
      liveUseStillRequiresCredentialsAndReceipts: true,
    }));
    expect(snapshot.domains.map((domain) => domain.id)).toEqual([
      'channels',
      'gateway',
      'plugins',
      'liveQa',
      'onboarding',
    ]);
  });

  it('surfaces attention when the project is only partially present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-consistency-partial-'));
    const snapshot = new ZavorthOperationalReadinessService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    }).buildSnapshot(root);

    expect(snapshot.status).toBe('attention');
    expect(snapshot.score).toBeLessThan(100);
  });
});
