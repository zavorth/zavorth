import { VendorReleaseReportService } from '../../src/services/VendorReleaseReportService.js';

describe('VendorReleaseReportService', () => {
  it('builds a release report around the vendor index snapshot', () => {
    const service = new VendorReleaseReportService({
      now: () => new Date('2026-04-08T18:00:00.000Z'),
      vendorReleaseIndexService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T17:59:00.000Z',
          summary: {
            total: 2,
            updateAvailable: 1,
            live: 1,
            ready: 1,
            reviewRequired: 1,
            blockedForCoreCopy: 1,
          },
          entries: [
            {
              vendorId: 'AIGateway',
              displayName: 'AIGateway',
              license: 'MIT',
              integrationMode: 'openai-compatible-sidecar',
              upstream: 'https://example.com/zavorth-ai-gateway-mirror.git',
              resolvedSourceType: 'local',
              resolvedSource: 'C:/mirror/AIGateway',
              mirrorDir: 'C:/mirror/zavorth-ai-gateway-mirror.git',
              worktreeDir: 'C:/worktree/AIGateway',
              lockedCommit: 'aaaa',
              sourceHead: 'bbbb',
              mirrorHead: 'bbbb',
              worktreeCommit: 'aaaa',
              status: 'update_available',
              updateAvailable: true,
              live: true,
              ready: true,
              baseUrl: 'http://127.0.0.1:20128/v1',
              port: 20128,
              lastAction: {
                type: 'update',
                createdAt: '2026-04-08T17:00:00.000Z',
                trimmed: '256 MB',
              },
              diff: {
                vendorId: 'AIGateway',
                displayName: 'AIGateway',
                status: 'update_available',
                changed: true,
                lockedCommit: 'aaaa',
                worktreeCommit: 'aaaa',
                sourceHead: 'bbbb',
                currentCommit: 'aaaa',
                targetCommit: 'bbbb',
                currentShort: 'aaaa',
                targetShort: 'bbbb',
                lastActionType: 'update',
                lastActionAt: '2026-04-08T17:00:00.000Z',
                trimmed: '256 MB',
                summary: 'AIGateway update pending.',
              },
              licenseDecision: {
                vendorId: 'AIGateway',
                displayName: 'AIGateway',
                license: 'MIT',
                releaseIsolation: 'core-safe',
                coreCopyPolicy: 'allow-with-attribution',
                reviewRequired: false,
                allowVendorSync: true,
                allowCoreCopy: true,
                rationale: 'Permissive.',
                recommendedAction: 'Sync ok.',
                summary: 'ok',
              },
            },
            {
              vendorId: 'omni-zavorth-bridge-remote-chat',
              displayName: 'Zavorth Remote Terminal Sidecar',
              license: 'GPL-3.0-only',
              integrationMode: 'remote-ui-sidecar',
              upstream: 'https://example.com/ag.git',
              resolvedSourceType: 'local',
              resolvedSource: 'C:/mirror/ag',
              mirrorDir: 'C:/mirror/ag.git',
              worktreeDir: 'C:/worktree/ag',
              lockedCommit: 'cccc',
              sourceHead: 'cccc',
              mirrorHead: 'cccc',
              worktreeCommit: 'cccc',
              status: 'aligned',
              updateAvailable: false,
              live: false,
              ready: false,
              baseUrl: 'http://127.0.0.1:4747',
              port: 4747,
              lastAction: {
                type: null,
                createdAt: null,
                trimmed: null,
              },
              diff: {
                vendorId: 'omni-zavorth-bridge-remote-chat',
                displayName: 'Zavorth Remote Terminal Sidecar',
                status: 'aligned',
                changed: false,
                lockedCommit: 'cccc',
                worktreeCommit: 'cccc',
                sourceHead: 'cccc',
                currentCommit: 'cccc',
                targetCommit: 'cccc',
                currentShort: 'cccc',
                targetShort: 'cccc',
                lastActionType: null,
                lastActionAt: null,
                trimmed: null,
                summary: 'Aligned.',
              },
              licenseDecision: {
                vendorId: 'omni-zavorth-bridge-remote-chat',
                displayName: 'Zavorth Remote Terminal Sidecar',
                license: 'GPL-3.0-only',
                releaseIsolation: 'vendor-isolated',
                coreCopyPolicy: 'isolated-vendor-only',
                reviewRequired: true,
                allowVendorSync: true,
                allowCoreCopy: false,
                rationale: 'Copyleft.',
                recommendedAction: 'Keep isolated.',
                summary: 'isolated',
              },
            },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();
    const markdown = service.renderMarkdown();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 2,
        updateAvailable: 1,
        isolatedVendors: 1,
      }),
    );
    expect(markdown).toContain('# Zavorth Vendor Release Report');
    expect(markdown).toContain('AIGateway');
    expect(markdown).toContain('Zavorth Remote Terminal Sidecar');
  });
});
