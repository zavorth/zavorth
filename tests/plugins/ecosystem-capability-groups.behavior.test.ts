import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


const ROOT = path.resolve(__dirname, '../..');

describe('Capability group ecosystem surpass', () => {
  it('ships marketplace config and signed pack docs', () => {
    expect(fs.existsSync(path.join(ROOT, 'config/plugin-os-marketplace.json'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'config/plugin-marketplace-remote.example.json'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'docs/plugin-os-signed-pack.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'config/plugin-os-capability-packs.json'))).toBe(true);
  });

  it('generate-plugin-atlas produces atlas artifacts', () => {
    const script = path.join(ROOT, 'scripts/generate-plugin-atlas.mjs');
    expect(fs.existsSync(script)).toBe(true);
    const result = spawnSync(process.execPath, [script], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(result.status).toBe(0);
    const atlasJson = path.join(ROOT, 'docs/generated/plugin-atlas.json');
    const atlasMd = path.join(ROOT, 'docs/generated/plugin-atlas.md');
    expect(fs.existsSync(atlasJson)).toBe(true);
    expect(fs.existsSync(atlasMd)).toBe(true);
    const atlas = JSON.parse(fs.readFileSync(atlasJson, 'utf8'));
    expect(atlas.schemaVersion).toBe('zavorth.plugin-atlas.v1');
    expect(Number(atlas.firstPartyCount || atlas.plugins?.length || 0)).toBeGreaterThan(40);
  });

  it('create-zavorth-plugin dry-run scaffolds a tool package', () => {
    const cli = path.join(ROOT, 'bin/create-zavorth-plugin.js');
    expect(fs.existsSync(cli)).toBe(true);
    const result = spawnSync(
      process.execPath,
      [cli, 'w8-demo-tool', '--kind', 'tool', '--dry-run'],
      { cwd: ROOT, encoding: 'utf8', timeout: 20000 },
    );
    expect(result.status).toBe(0);
    const out = `${result.stdout || ''}${result.stderr || ''}`;
    expect(out.toLowerCase()).toMatch(/manifest|dry|w8-demo-tool/);
  });

  it('create-zavorth-plugin writes files to temp dir', () => {
    const cli = path.join(ROOT, 'bin/create-zavorth-plugin.js');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-create-plugin-'));
    try {
      const target = path.join(tmp, 'acme-search');
      const result = spawnSync(
        process.execPath,
        [cli, 'acme-search', '--kind', 'search', '--dir', target, '--yes'],
        { cwd: ROOT, encoding: 'utf8', timeout: 20000 },
      );
      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(target, 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(target, 'index.js'))).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
      expect(manifest.schemaVersion).toBe('zavorth.plugin-os.v1');
      expect(manifest.moduleKind).toBe('search');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('capability packs config lists daily-ops and ecosystem packs', () => {
    const packs = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'config/plugin-os-capability-packs.json'), 'utf8'),
    );
    const ids = (packs.packs || []).map((p: { id: string }) => p.id);
    expect(ids).toContain('daily-ops');
    expect(ids).toContain('ecosystem');
    expect(ids).toContain('providers');
  });

  it('plugin-sdk package is at least 0.3.0', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'packages/plugin-sdk/package.json'), 'utf8'),
    );
    expect(pkg.version).toMatch(/^0\.3\./);
    expect(pkg.scripts['publish:check']).toBeTruthy();
  });

  it('onboarding includes daily-ops profile', () => {
    const onboarding = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'config/plugin-os-onboarding.json'), 'utf8'),
    );
    expect(onboarding.profiles['daily-ops']).toBeTruthy();
    expect(onboarding.profiles.providers).toBeTruthy();
    expect(onboarding.profiles.platforms).toBeTruthy();
    expect(onboarding.profiles.media).toBeTruthy();
    expect(onboarding.profiles.full).toBeTruthy();
  });
});
