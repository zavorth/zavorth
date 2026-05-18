import fs from 'fs';
import os from 'os';
import path from 'path';
import { EngineeringContextService } from '../../src/services/EngineeringContextService.js';

describe('EngineeringContextService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds automatic repo context with package json, tsconfig and ZAVORTH instructions', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-context-'));
    tempDirs.push(root);
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'demo-app',
        scripts: { build: 'tsc -p tsconfig.json', test: 'jest' },
      }),
      'utf8',
    );
    fs.writeFileSync(path.join(root, 'package-lock.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2022"}}', 'utf8');
    fs.writeFileSync(path.join(root, 'ZAVORTH.md'), '# Demo\n\nUse patches pequenos.\n- priorize build\n', 'utf8');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

    const service = new EngineeringContextService({ defaultWorkspace: root });
    const context = await service.buildContext(root);

    expect(context.workspaceName).toBe(path.basename(root));
    expect(context.packageJsonExists).toBe(true);
    expect(context.packageManager).toBe('npm');
    expect(context.tsconfigExists).toBe(true);
    expect(context.scripts.build).toBe('tsc -p tsconfig.json');
    expect(context.instructionFile).toContain('ZAVORTH.md');
    expect(context.instructionSources.some((entry) => entry.endsWith('ZAVORTH.md'))).toBe(true);
    expect(Array.isArray(context.contextLayers)).toBe(true);
    expect(context.contextLayers[0]?.id).toBe('global-policy');
    expect(context.shallowTree).toEqual(expect.arrayContaining(['src', 'src/index.ts']));
  });

  it('injects Mnemos context from connected MCP runtime tools', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-engineering-context-mnemos-'));
    tempDirs.push(root);
    const service = new EngineeringContextService({
      defaultWorkspace: root,
      mcpRuntimeService: {
        readSnapshot: () => ({
          generatedAt: new Date(0).toISOString(),
          manifestPath: 'config/mcp-servers.json',
          summary: {
            total: 1,
            enabled: 1,
            connected: 1,
            failed: 0,
            disabled: 0,
            stopped: 0,
            toolCount: 3,
          },
          capabilities: ['memory'],
          entries: [{
            id: 'mnemos',
            capability: 'memory',
            enabled: true,
            status: 'connected',
            toolCount: 3,
            toolNames: ['search_memory', 'scan_local_metadata', 'understand_file'],
            command: 'node',
            args: [],
            lastAttemptedAt: null,
            lastConnectedAt: null,
            lastError: null,
          }],
        }),
      },
    });

    const context = await service.buildContext(root);

    expect(context.contextLayers.map((layer) => layer.id)).toContain('mnemos-cognitive-protocol');
  });
});
