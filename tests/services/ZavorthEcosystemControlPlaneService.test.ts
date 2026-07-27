import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthEcosystemControlPlaneService } from '../../src/services/ZavorthEcosystemControlPlaneService.js';

describe('ZavorthEcosystemControlPlaneService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function writeFile(root: string, relativePath: string, content: string) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  function createWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ecosystem-'));
    tempDirs.push(root);
    return root;
  }

  it('builds a healthy Ecosystem snapshot when SDKs, guides, examples and publish are ready', () => {
    const root = createWorkspace();
    const requiredFiles = [
      'sdk/typescript/src/index.ts',
      'sdk/typescript/src/ZavorthClient.ts',
      'sdk/typescript/src/types.ts',
      'sdk/typescript/tsconfig.json',
      'sdk/python/zavorth/__init__.py',
      'sdk/python/zavorth/client.py',
      'sdk/python/README.md',
      'sdk/python/pyproject.toml',
      'docs/platform/integrar-client.md',
      'docs/platform/registrar-node.md',
      'docs/platform/publish-plugin.md',
      'docs/platform/usar-recipe.md',
      'examples/clients/simple-bot.ts',
      'examples/nodes/headless-node.ts',
      'examples/extensions/hello-ecosystem/plugin.json',
      'examples/extensions/hello-ecosystem/index.js',
    ];
    requiredFiles.forEach((file) => writeFile(root, file, '// ready\n'));
    writeFile(
      root,
      'data/runtime/platform-publish/openrouter/release.json',
      JSON.stringify({
        packageId: 'plugin:openrouter',
        releaseId: 'release-1',
        version: '1.0.0',
        preparedAt: '2026-04-12T18:05:00.000Z',
        uploadStatus: 'published',
        fileCount: 4,
        signature: 'sig-1',
        validation: {
          warnings: [],
        },
      }),
    );

    const service = new ZavorthEcosystemControlPlaneService({
      now: () => new Date('2026-04-12T18:10:00.000Z'),
      workspaceRoot: root,
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T18:00:00.000Z',
          catalogSync: {
            status: 'ready',
            summary: 'Catalogo sincronizado.',
          },
          summary: {
            total: 2,
            collections: 1,
            recipes: 1,
            reviewPending: 0,
            ready: 2,
          },
          recipes: [
            {
              id: 'recipe:openrouter',
              missingCount: 0,
            },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'openrouter' });

    expect(snapshot.generatedAt).toBe('2026-04-12T18:10:00.000Z');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.sdkTypescriptReady).toBe(true);
    expect(snapshot.summary.sdkPythonReady).toBe(true);
    expect(snapshot.summary.guidesReady).toBe(4);
    expect(snapshot.summary.publishArtifacts).toBe(1);
    expect(snapshot.cards.find((entry) => entry.id === 'sdk')?.posture).toBe('healthy');
    expect(snapshot.cards.find((entry) => entry.id === 'registry')?.posture).toBe('healthy');
    expect(service.renderReport({ selectedId: 'openrouter' })).toContain(
      'Ecosystem: Ecossistema, SDKs e third-party platform',
    );
  });

  it('promotes attention when sync is stale, guides are missing and SDK files are incomplete', () => {
    const root = createWorkspace();
    writeFile(root, 'sdk/typescript/src/index.ts', '// partial\n');
    writeFile(root, 'sdk/python/zavorth/client.py', '# partial\n');
    writeFile(root, 'docs/platform/integrar-client.md', '# client\n');

    const service = new ZavorthEcosystemControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      workspaceRoot: root,
      platformRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T18:55:00.000Z',
          catalogSync: {
            status: 'stale',
            summary: 'Catalogo remoto ficou stale.',
          },
          summary: {
            total: 1,
            collections: 0,
            recipes: 1,
            reviewPending: 1,
            ready: 0,
          },
          recipes: [
            {
              id: 'recipe:missing',
              missingCount: 2,
            },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'sdk-check' }),
        expect.objectContaining({ id: 'guides-missing' }),
        expect.objectContaining({ id: 'platform-sync' }),
        expect.objectContaining({ id: 'recipe-coverage' }),
      ]),
    );
    expect(snapshot.cards.find((entry) => entry.id === 'guides')?.posture).toBe('attention');
    expect(snapshot.cards.find((entry) => entry.id === 'registry')?.posture).toBe('attention');
  });
});
