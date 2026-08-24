import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-plugins-dev-'));
}

describe('ZavorthCliPluginsNamespace plugins dev', () => {
  // Scaffold/dev flows spawn node child processes; the budget covers
  // parallel-worker contention on the host.
  jest.setTimeout(60000);

  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('shows usage when path is missing', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const result = await runPlugins(root, ['dev']);
    const text = JSON.stringify(result);
    expect(text).toMatch(/Usage: zavorth plugins dev/i);
  });

  it('runs plugins dev on a scaffolded path', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    await runPlugins(root, [
      'scaffold',
      'cli-dev-demo',
      '--module-kind',
      'tool',
      '--yes',
    ]);

    const result = await runPlugins(root, [
      'dev',
      './plugins/cli-dev-demo',
      '--trust',
      'trusted',
      '--json',
    ]) as { exitCode?: number; output?: string };

    const payload = JSON.parse(String(result.output || '{}')) as {
      snapshot?: { pluginId?: string; steps?: Array<{ id: string; ok: boolean }> };
      ok?: boolean;
    };
    expect(payload.snapshot?.pluginId).toBe('cli-dev-demo');
    expect(payload.snapshot?.steps?.some((step) => step.id === 'bridge-install' && step.ok)).toBe(true);
    expect(fs.existsSync(path.join(root, 'plugins', 'cli-dev-demo', 'manifest.dev.inferred.json'))).toBe(true);
  });
});
