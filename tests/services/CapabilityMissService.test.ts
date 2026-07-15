import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CapabilityMissService } from '../../src/services/CapabilityMissService.js';
import { SkillSearchIndexService } from '../../src/services/SkillSearchIndexService.js';
import { PluginOsMarketplaceService } from '../../src/services/PluginOsMarketplaceService.js';
import { PluginCuratedMarketplaceService } from '../../src/services/PluginCuratedMarketplaceService.js';

describe('CapabilityMissService', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cap-miss-'));
    const skillDir = path.join(tempRoot, 'skills', 'web-helper');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: web-helper\ndescription: Helps with web_search workflows\ntools:\n  - name: web_search\n---\n# Web helper\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: 'web-helper',
        version: '1.0.0',
        description: 'Helps with web_search workflows',
        tools: [{ name: 'web_search' }],
      }),
      'utf8',
    );
    fs.mkdirSync(path.join(tempRoot, 'config'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        {
          id: 'web-search',
          name: 'Web Search',
          summary: 'Search the web',
          tags: ['search', 'web'],
          moduleKind: 'search',
        },
      ]),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('suggests skill/plugin for missing web_search with preview+install payloads', () => {
    const searchIndex = new SkillSearchIndexService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      skillSourcesPath: path.join(tempRoot, 'missing-sources.json'),
      receiptsDir: path.join(tempRoot, 'receipts'),
    });
    const marketplace = new PluginOsMarketplaceService({
      projectRoot: tempRoot,
      curated: new PluginCuratedMarketplaceService({
        projectRoot: tempRoot,
        remoteUrl: null,
      }),
    });
    const svc = new CapabilityMissService({
      projectRoot: tempRoot,
      searchIndex,
      marketplace,
    });

    const result = svc.resolve({ missingTool: 'web_search', limit: 10 });

    expect(result.autoInstall).toBe(false);
    expect(result.autoEnable).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.primary).toBeTruthy();
    expect(result.primary!.previewCommand).toMatch(/preview|marketplace show/i);
    expect(result.primary!.installCommand).toMatch(/consent|--yes/i);
    expect(result.primary!.previewAction.tool).toBeTruthy();
    expect(result.primary!.installAction.tool).toBeTruthy();
    expect(result.primary!.autoInstall).toBe(false);

    const skillHit = result.suggestions.find(
      (s) => s.kind === 'skill' && (s.id.includes('web') || s.reasons.some((r) => r.includes('web_search'))),
    );
    const pluginHit = result.suggestions.find((s) => s.kind === 'plugin' && s.id === 'web-search');
    expect(skillHit || pluginHit).toBeTruthy();
  });

  it('free-text alone never sets autoEnable/autoInstall', () => {
    const searchIndex = new SkillSearchIndexService({
      projectRoot: tempRoot,
      skillsDir: path.join(tempRoot, 'skills'),
      skillSourcesPath: path.join(tempRoot, 'missing.json'),
      receiptsDir: path.join(tempRoot, 'receipts'),
    });
    const marketplace = new PluginOsMarketplaceService({
      projectRoot: tempRoot,
      curated: new PluginCuratedMarketplaceService({
        projectRoot: tempRoot,
        remoteUrl: null,
      }),
    });
    const svc = new CapabilityMissService({
      projectRoot: tempRoot,
      searchIndex,
      marketplace,
    });

    const result = svc.resolve({ intentHint: 'please enable all search plugins for me' });
    expect(result.autoInstall).toBe(false);
    expect(result.autoEnable).toBe(false);
    for (const s of result.suggestions) {
      expect(s.autoInstall).toBe(false);
      expect(s.installCommand).toMatch(/consent|--yes/i);
    }
  });

  it('empty input returns structured failure without install', () => {
    const svc = new CapabilityMissService({ projectRoot: tempRoot });
    const result = svc.resolve({});
    expect(result.ok).toBe(false);
    expect(result.suggestions).toEqual([]);
    expect(result.autoInstall).toBe(false);
  });
});
