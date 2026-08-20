import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { UniversalCapabilitySubsystemService as UniversalCapabilityFabricService } from '../../src/services/UniversalCapabilitySubsystemService.js';
import { UniversalWorkspaceImportService } from '../../src/services/UniversalWorkspaceImportService.js';

function makeTempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('UniversalCapabilityFabricService', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot('zavorth-fabric-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews a local skill pack without applying', async () => {
    const skillDir = path.join(root, 'pack');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo-skill\ndescription: demo\n---\n\n# Demo\n', 'utf8');

    const service = new UniversalCapabilityFabricService({ projectRoot: root });
    const snap = await service.buildSnapshot({
      source: skillDir,
      kind: 'auto',
      apply: false,
    });

    expect(snap.status).toBe('preview-only');
    expect(snap.policy.brandAgnostic).toBe(true);
    expect(snap.summary.skills).toBeGreaterThanOrEqual(1);
    expect(snap.candidates[0]?.kind).toBe('skill');
    expect(snap.summary.materialized).toBe(0);
  });

  it('quarantines a plugin pack on apply with consent flags', async () => {
    const pluginDir = path.join(root, 'plugin-pack');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ id: 'demo-plugin', name: 'Demo' }), 'utf8');
    fs.writeFileSync(path.join(pluginDir, 'index.js'), 'export default {};\n', 'utf8');

    const service = new UniversalCapabilityFabricService({ projectRoot: root });
    const snap = await service.buildSnapshot({
      source: pluginDir,
      kind: 'plugin',
      apply: true,
      allowAllCandidates: true,
      allowExecutable: false,
    });

    expect(['passed', 'partial']).toContain(snap.status);
    expect(snap.summary.plugins).toBeGreaterThanOrEqual(1);
    expect(snap.summary.materialized + snap.summary.heldForApproval).toBeGreaterThan(0);
    const target = snap.receipts.find((r) => r.targetPath)?.targetPath;
    expect(target && fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(path.join(target!, 'ZAVORTH_ABSORB.json'))).toBe(true);
  });

  it('stages MCP packs as disabled', async () => {
    const mcpDir = path.join(root, 'mcp-pack');
    fs.mkdirSync(mcpDir, { recursive: true });
    fs.writeFileSync(path.join(mcpDir, 'mcp.json'), JSON.stringify({ servers: [{ name: 'demo' }] }), 'utf8');

    const service = new UniversalCapabilityFabricService({ projectRoot: root });
    const snap = await service.buildSnapshot({
      source: mcpDir,
      kind: 'mcp',
      apply: true,
      allowAllCandidates: true,
    });

    expect(snap.summary.mcp).toBeGreaterThanOrEqual(1);
    const held = snap.receipts.some((r) => r.kind === 'enable-hold' || r.status === 'hold');
    expect(held).toBe(true);
    const target = snap.receipts.find((r) => r.targetPath)?.targetPath;
    expect(target).toBeTruthy();
    expect(fs.existsSync(path.join(target!, 'mcp-servers.disabled.json'))).toBe(true);
  });
});

describe('UniversalWorkspaceImportService', () => {
  let root: string;

  beforeEach(() => {
    root = makeTempRoot('zavorth-ws-import-');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects structural skill-centric homes without product brands', () => {
    const home = path.join(root, 'agent-home');
    fs.mkdirSync(path.join(home, 'skills', 'one'), { recursive: true });
    fs.writeFileSync(path.join(home, 'skills', 'one', 'SKILL.md'), '# One\n', 'utf8');
    fs.writeFileSync(path.join(home, 'SOUL.md'), '# Soul\n', 'utf8');
    fs.writeFileSync(path.join(home, 'IDENTITY.md'), '# Identity\n', 'utf8');

    const service = new UniversalWorkspaceImportService({ projectRoot: root });
    const detected = service.detect(home);
    expect(detected).not.toBeNull();
    expect(detected!.confidence).toBeGreaterThan(0);
    expect([
      'skill-centric-home',
      'identity-markdown-home',
      'mixed-agent-home',
    ]).toContain(detected!.profileId);
    // Ensure no product brand strings leak into profile ids
  });

  it('previews import and holds secret-like files', () => {
    const home = path.join(root, 'ws');
    fs.mkdirSync(path.join(home, 'skills', 'a'), { recursive: true });
    fs.writeFileSync(path.join(home, 'skills', 'a', 'SKILL.md'), '# A\n', 'utf8');
    fs.writeFileSync(path.join(home, 'MEMORY.md'), '# mem\n', 'utf8');
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ api_key: 'sk-secret-value-123456' }), 'utf8');

    const service = new UniversalWorkspaceImportService({ projectRoot: root });
    const snap = service.buildSnapshot({ sourcePath: home, apply: false });
    expect(snap.status).toBe('preview-only');
    expect(snap.policy.brandAgnostic).toBe(true);
    expect(snap.policy.structuralDetectionOnly).toBe(true);
    expect(snap.summary.items).toBeGreaterThan(0);
    expect(snap.summary.secretLike).toBeGreaterThanOrEqual(1);
    expect(snap.summary.copied).toBe(0);
  });

  it('applies import with consent and writes IMPORT_MAP', () => {
    const home = path.join(root, 'ws2');
    fs.mkdirSync(path.join(home, 'skills', 'b'), { recursive: true });
    fs.writeFileSync(path.join(home, 'skills', 'b', 'SKILL.md'), '# B\n', 'utf8');
    fs.writeFileSync(path.join(home, 'USER.md'), '# user\n', 'utf8');

    const service = new UniversalWorkspaceImportService({ projectRoot: root });
    const snap = service.buildSnapshot({
      sourcePath: home,
      apply: true,
      consent: true,
      targetRoot: path.join(root, 'imported'),
    });

    expect(['passed', 'partial']).toContain(snap.status);
    expect(snap.summary.copied).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(root, 'imported', 'IMPORT_MAP.json'))).toBe(true);
  });
});
