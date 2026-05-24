import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ZavorthOperationalParityService } from '../../src/services/ZavorthOperationalParityService';

describe('ZavorthOperationalParityService', () => {
  it('certifies the native control-plane domains without secrets or network calls', () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const snapshot = new ZavorthOperationalParityService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    }).buildSnapshot(projectRoot);

    expect(snapshot.contractVersion).toBe('zavorth-operational-parity/1');
    expect(snapshot.status).toBe('pass');
    expect(snapshot.score).toBe(100);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noSecretsRead: true,
      noNetworkCalls: true,
      noExternalAgentCode: true,
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
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-parity-partial-'));
    const snapshot = new ZavorthOperationalParityService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    }).buildSnapshot(root);

    expect(snapshot.status).toBe('attention');
    expect(snapshot.score).toBeLessThan(100);
  });
});
