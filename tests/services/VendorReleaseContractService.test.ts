import { VendorReleaseContractService } from '../../src/services/VendorReleaseContractService.js';

describe('VendorReleaseContractService', () => {
  it('classifies permissive and copyleft vendors with different release isolation policies', () => {
    const service = new VendorReleaseContractService({
      projectRoot: 'C:/workspace/zavorth',
      manifestFile: 'C:/workspace/zavorth/config/third-party-sources.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() =>
        JSON.stringify({
          sources: [
            {
              id: 'AIGateway',
              displayName: 'AIGateway',
              license: 'MIT',
              upstream: 'https://example.invalid/zavorth-ai-gateway.git',
              localSource: '../../zavorth-ai-gateway',
              worktreeDir: 'data/vendor-worktrees/AIGateway',
              mirrorDir: 'data/vendor-mirrors/zavorth-ai-gateway-mirror.git',
              integrationMode: 'openai-compatible-sidecar',
            },
            {
              id: 'terminal-remote-sidecar',
              displayName: 'Zavorth Remote Terminal Sidecar',
              license: 'GPL-3.0-only',
              upstream: 'https://example.invalid/zavorth-remote-terminal-sidecar.git',
              localSource: '../../zavorth-remote-terminal-sidecar',
              worktreeDir: 'data/vendor-worktrees/terminal-remote-sidecar',
              mirrorDir: 'data/vendor-mirrors/terminal-remote-sidecar.git',
              integrationMode: 'remote-ui-sidecar',
            },
          ],
        }),
      ) as any,
      now: () => new Date('2026-04-07T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 2,
        coreSafe: 1,
        isolated: 1,
        reviewRequired: 1,
      }),
    );
    expect(service.getContract('AIGateway')).toEqual(
      expect.objectContaining({
        releaseIsolation: 'core-safe',
        coreCopyPolicy: 'allow-with-attribution',
      }),
    );
    expect(service.getContract('terminal-remote-sidecar')).toEqual(
      expect.objectContaining({
        releaseIsolation: 'vendor-isolated',
        coreCopyPolicy: 'isolated-vendor-only',
      }),
    );
  });
});
