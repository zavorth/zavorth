import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  SkillRemoteCatalogService,
  assertSafeRemoteCatalogUrl,
  normalizeSkillCatalogEntry,
} from '../../src/services/SkillRemoteCatalogService.js';

describe('SkillRemoteCatalogService', () => {
  const tempRoots: string[] = [];
  const prevUrl = process.env.ZAVORTH_SKILL_CATALOG_URL;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.ZAVORTH_SKILL_CATALOG_URL;
    else process.env.ZAVORTH_SKILL_CATALOG_URL = prevUrl;
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists empty-remote safely (local/example only)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-cat-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'skill-catalog.example.json'),
      JSON.stringify({
        schemaVersion: 'zavorth.skill-catalog.v1',
        entries: [
          {
            id: 'fixture-skill',
            name: 'Fixture',
            source: path.join(root, 'skills', 'fixture'),
            version: '1.0.0',
          },
        ],
      }),
      'utf8',
    );

    const svc = new SkillRemoteCatalogService({
      projectRoot: root,
      remoteUrl: null,
    });
    const listed = svc.list({ includeExample: true });
    expect(listed.ok).toBe(true);
    expect(listed.entries.some((e) => e.id === 'fixture-skill')).toBe(true);
    expect(listed.findings.join(' ')).toMatch(/no remote|example/i);
  });

  it('refreshes mock HTTPS catalog into cache and lists it', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-cat-r-'));
    tempRoots.push(root);

    const fetchImpl = async () =>
      ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            schemaVersion: 'zavorth.skill-catalog.v1',
            entries: [
              {
                id: 'remote-demo',
                name: 'Remote Demo',
                summary: 'from remote',
                source: 'https://github.com/example/skill-pack',
                version: '2.0.0',
                tags: ['remote'],
              },
            ],
          }),
      }) as any;

    const svc = new SkillRemoteCatalogService({
      projectRoot: root,
      remoteUrl: 'https://example.com/skills/catalog.json',
      fetchImpl,
    });

    const refreshed = await svc.refreshRemote({ root });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.entries.some((e) => e.id === 'remote-demo')).toBe(true);
    expect(refreshed.cachePath).toMatch(/skill-catalog-remote/);

    const listed = svc.list({ root, includeRemote: true });
    expect(listed.entries.some((e) => e.id === 'remote-demo')).toBe(true);
    expect(listed.sources.some((s) => s.kind === 'cache')).toBe(true);

    const shown = svc.show('remote-demo', { root });
    expect(shown.ok).toBe(true);
    expect(shown.entry?.source).toContain('github.com');
  });

  it('rejects non-https and private hosts for remote refresh', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-cat-ssrf-'));
    tempRoots.push(root);
    const svc = new SkillRemoteCatalogService({
      projectRoot: root,
      remoteUrl: 'http://127.0.0.1/evil.json',
      fetchImpl: async () => {
        throw new Error('fetch should not be called');
      },
    });
    const result = await svc.refreshRemote({ root });
    expect(result.ok).toBe(false);
    expect(result.findings.join(' ')).toMatch(/https|localhost|private|public/i);
  });

  it('installById requires consent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-cat-inst-'));
    tempRoots.push(root);
    const skillDir = path.join(root, 'skills', 'pack-a');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: pack-a\ndescription: demo\ntools:\n  - name: read_file\n---\n# Pack A\n',
      'utf8',
    );
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'skill-catalog.json'),
      JSON.stringify({
        schemaVersion: 'zavorth.skill-catalog.v1',
        entries: [
          {
            id: 'pack-a',
            name: 'Pack A',
            source: skillDir,
            version: '1.0.0',
          },
        ],
      }),
      'utf8',
    );

    const svc = new SkillRemoteCatalogService({
      projectRoot: root,
      remoteUrl: null,
    });

    const denied = await svc.installById('pack-a', { consent: false });
    expect(denied.ok).toBe(false);
    expect(denied.findings).toContain('consent_required');
    expect(denied.message).toMatch(/consent/i);
  });

  it('assertSafeRemoteCatalogUrl and normalize entry helpers', () => {
    expect(assertSafeRemoteCatalogUrl('https://cdn.example.com/c.json').ok).toBe(true);
    expect(assertSafeRemoteCatalogUrl('http://example.com/c.json').ok).toBe(false);
    expect(assertSafeRemoteCatalogUrl('https://127.0.0.1/c.json').ok).toBe(false);
    expect(normalizeSkillCatalogEntry({ id: 'x' })).toBeNull();
    expect(normalizeSkillCatalogEntry({ id: 'x', source: '/tmp/s' })?.name).toBe('x');
  });
});
