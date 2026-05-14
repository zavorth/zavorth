import fs from 'fs';
import os from 'os';
import path from 'path';
import { VendorReleaseIndexService } from '../../src/services/VendorReleaseIndexService.js';

describe('VendorReleaseIndexService', () => {
  it('builds a vendor snapshot with diff, runtime and license metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-vendor-index-'));
    try {
      const localAIGateway = path.join(root, 'AIGateway');
      const localZavorthBridge = path.join(root, 'Zavorth Remote Terminal Sidecar');
      const worktreeAIGateway = path.join(root, 'data', 'vendor-worktrees', 'AIGateway');
      const worktreeZavorthBridge = path.join(root, 'data', 'vendor-worktrees', 'omni-zavorth-bridge-remote-chat');
      const mirrorAIGateway = path.join(root, 'data', 'vendor-mirrors', 'zavorth-ai-gateway-mirror.git');
      const mirrorZavorthBridge = path.join(root, 'data', 'vendor-mirrors', 'omni-zavorth-bridge-remote-chat.git');

      for (const repoPath of [localAIGateway, localZavorthBridge, worktreeAIGateway, worktreeZavorthBridge]) {
        fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });
      }
      for (const repoPath of [mirrorAIGateway, mirrorZavorthBridge]) {
        fs.mkdirSync(repoPath, { recursive: true });
      }

      fs.mkdirSync(path.join(root, 'config'), { recursive: true });
      fs.mkdirSync(path.join(root, 'data', 'vendor-history'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'config', 'third-party-sources.json'),
        JSON.stringify({
          sources: [
            {
              id: 'AIGateway',
              displayName: 'AIGateway',
              license: 'MIT',
              upstream: 'https://example.com/zavorth-ai-gateway-mirror.git',
              localSource: 'AIGateway',
              worktreeDir: 'data/vendor-worktrees/AIGateway',
              mirrorDir: 'data/vendor-mirrors/zavorth-ai-gateway-mirror.git',
              integrationMode: 'openai-compatible-sidecar',
              defaultBaseUrl: 'http://127.0.0.1:20128/v1',
            },
            {
              id: 'omni-zavorth-bridge-remote-chat',
              displayName: 'Zavorth Remote Terminal Sidecar',
              license: 'GPL-3.0-only',
              upstream: 'https://example.com/agremote.git',
              localSource: 'Zavorth Remote Terminal Sidecar',
              worktreeDir: 'data/vendor-worktrees/omni-zavorth-bridge-remote-chat',
              mirrorDir: 'data/vendor-mirrors/omni-zavorth-bridge-remote-chat.git',
              integrationMode: 'remote-ui-sidecar',
              defaultBaseUrl: 'http://127.0.0.1:4747',
            },
          ],
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(root, 'data', 'vendor-lock.json'),
        JSON.stringify({
          sources: [
            {
              id: 'AIGateway',
              lockedCommit: 'aaaaaaaa11111111',
            },
            {
              id: 'omni-zavorth-bridge-remote-chat',
              lockedCommit: 'cccccccc33333333',
            },
          ],
        }),
        'utf8',
      );
      fs.writeFileSync(
        path.join(root, 'data', 'vendor-history', 'history.json'),
        JSON.stringify({
          entries: [
            {
              type: 'update',
              createdAt: '2026-04-07T18:00:00.000Z',
              report: [
                {
                  id: 'AIGateway',
                  trimmed: '256 MB',
                },
              ],
            },
          ],
        }),
        'utf8',
      );

      const runGit = jest.fn((args: string[], cwd: string) => {
        expect(args[0]).toBe('rev-parse');
        if (cwd.includes(`${path.sep}AIGateway`) && !cwd.includes(`${path.sep}vendor-`)) {
          return 'bbbbbbbb22222222';
        }
        if (cwd.includes(`${path.sep}vendor-worktrees${path.sep}AIGateway`)) {
          return 'aaaaaaaa11111111';
        }
        if (cwd.includes(`${path.sep}vendor-mirrors${path.sep}zavorth-ai-gateway-mirror.git`)) {
          return 'bbbbbbbb22222222';
        }
        if (
          cwd.includes('Zavorth Remote Terminal Sidecar')
          || cwd.includes(`${path.sep}vendor-worktrees${path.sep}omni-zavorth-bridge-remote-chat`)
          || cwd.includes(`${path.sep}vendor-mirrors${path.sep}omni-zavorth-bridge-remote-chat.git`)
        ) {
          return 'cccccccc33333333';
        }
        throw new Error('missing');
      });

      const service = new VendorReleaseIndexService({
        projectRoot: root,
        sidecarStatusService: {
          readSummary: () => ({
            AIGateway: {
              id: 'AIGateway',
              name: 'AIGateway',
              enabled: true,
              running: true,
              ready: true,
              spawnedByZavorth: true,
              pid: 4242,
              baseUrl: 'http://127.0.0.1:20128/v1',
              localUrl: null,
              sourceDir: worktreeAIGateway,
              checkedAt: '2026-04-07T18:00:00.000Z',
              message: 'ok',
            },
            ZavorthTerminal: {
              id: 'omni-zavorth-bridge-remote',
              name: 'ZavorthBridge Remote',
              enabled: true,
              running: false,
              ready: false,
              spawnedByZavorth: false,
              pid: null,
              baseUrl: 'http://127.0.0.1:4747',
              localUrl: null,
              sourceDir: worktreeZavorthBridge,
              checkedAt: '2026-04-07T18:00:00.000Z',
              message: 'offline',
            },
          }),
        } as any,
        licenseGuardService: {
          getDecision: jest.fn((vendorId: string) => {
            if (String(vendorId).toLowerCase() === 'aigateway') {
              return {
                vendorId: 'aigateway',
                displayName: 'AIGateway',
                license: 'MIT',
                releaseIsolation: 'sidecar',
                coreCopyPolicy: 'allow-with-attribution',
                reviewRequired: false,
                allowVendorSync: true,
                allowCoreCopy: true,
                rationale: 'Fixture libera AIGateway para core copy com atribuicao.',
                recommendedAction: null,
                summary: 'AIGateway pode ser sincronizado como vendor.',
              };
            }
            return {
              vendorId: 'omni-zavorth-bridge-remote-chat',
              displayName: 'Zavorth Remote Terminal Sidecar',
              license: 'GPL-3.0-only',
              releaseIsolation: 'isolated-vendor',
              coreCopyPolicy: 'deny-core-copy',
              reviewRequired: true,
              allowVendorSync: true,
              allowCoreCopy: false,
              rationale: 'Fixture bloqueia GPL no core.',
              recommendedAction: 'Manter isolado.',
              summary: 'Zavorth Remote Terminal Sidecar deve permanecer isolado.',
            };
          }),
        } as any,
        runGit: runGit as any,
      });

      const snapshot = service.buildSnapshot();
      const AIGateway = service.getEntry('AIGateway');
      const zavorthBridge = service.getEntry('omni-zavorth-bridge-remote-chat');

      expect(snapshot.summary).toEqual(
        expect.objectContaining({
          total: 2,
          updateAvailable: 1,
          live: 1,
          reviewRequired: 1,
          blockedForCoreCopy: 1,
        }),
      );
      expect(AIGateway).toEqual(
        expect.objectContaining({
          updateAvailable: true,
          live: true,
          ready: true,
          diff: expect.objectContaining({
            status: 'update_available',
          }),
          licenseDecision: expect.objectContaining({
            allowCoreCopy: true,
          }),
        }),
      );
      expect(zavorthBridge).toEqual(
        expect.objectContaining({
          updateAvailable: false,
          live: false,
          ready: false,
          licenseDecision: expect.objectContaining({
            allowCoreCopy: false,
            reviewRequired: true,
          }),
        }),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
