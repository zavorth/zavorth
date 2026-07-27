import fs from 'fs';
import os from 'os';
import path from 'path';
import { ContextResolverService } from '../../src/services/ContextResolverService.js';

describe('ContextResolverService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('resolves canonical context layers in the expected precedence order', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-context-resolver-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, 'ZAVORTH.md'), '# Demo\n\nUse o gateway.\n', 'utf8');
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Compat\n\nLegacy agent hints.\n', 'utf8');
    fs.mkdirSync(path.join(root, '.agents', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(root, '.agents', 'skills', 'notes.md'), 'skill note', 'utf8');

    const service = new ContextResolverService();
    const snapshot = await service.resolve({
      workspace: root,
      capabilityIds: ['watch-mode', 'remote'],
      toolContracts: ['shell', 'swarm'],
      sessionOverrides: ['workspaceHint=repo'],
      userRequest: 'corrija o gateway',
    });

    expect(snapshot.workspaceName).toBe(path.basename(root));
    expect(snapshot.instructionSources.some((entry) => entry.endsWith('ZAVORTH.md'))).toBe(true);
    expect(snapshot.skillDirectories.some((entry) => entry.includes('.agents/skills'))).toBe(true);
    expect(snapshot.layers.map((layer) => layer.id)).toEqual([
      'global-policy',
      'workspace-manual',
      'agents-compat',
      'workspace-skills',
      'capabilities',
      'tool-contracts',
      'session-overrides',
      'user-request',
    ]);
  });

  it('does not add Mnemos context when connected tools are absent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-context-mnemos-absent-'));
    tempDirs.push(root);
    const service = new ContextResolverService({
      connectedToolNamesProvider: () => [],
    });

    const snapshot = await service.resolve({ workspace: root });

    expect(snapshot.layers.map((layer) => layer.id)).not.toContain('mnemos-cognitive-protocol');
  });

  it('does not add Mnemos context when only one required tool is connected', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-context-mnemos-partial-'));
    tempDirs.push(root);
    const service = new ContextResolverService({
      connectedToolNamesProvider: () => ['search_memory'],
    });

    const snapshot = await service.resolve({ workspace: root });

    expect(snapshot.layers.map((layer) => layer.id)).not.toContain('mnemos-cognitive-protocol');
  });

  it('adds Mnemos context when universal file understanding tools are connected dynamically', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-context-mnemos-complete-'));
    tempDirs.push(root);
    const service = new ContextResolverService({
      connectedToolNamesProvider: () => ['search_memory', 'scan_local_metadata', 'understand_file'],
    });

    const snapshot = await service.resolve({ workspace: root });
    const mnemosLayer = snapshot.layers.find((layer) => layer.id === 'mnemos-cognitive-protocol');

    expect(mnemosLayer?.summary).toContain('LOCAL MEMORY PROTOCOL');
  });
});
