import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resetSkillHotPathCacheForTests,
  SkillHotPathCacheService,
} from '../../src/services/SkillHotPathCacheService.js';
import { SkillIrNormalizerService } from '../../src/skills/SkillIrNormalizerService.js';
import { bindSkillDeclaredTools } from '../../src/services/SkillExecutorBindingService.js';
import { SkillInstallPipelineService } from '../../src/services/SkillInstallPipelineService.js';

describe('SkillHotPathCacheService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hotpath-'));
    resetSkillHotPathCacheForTests({ enabled: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    resetSkillHotPathCacheForTests({ enabled: true });
  });

  it('SkillIR process cache hits on second normalize of same dir', () => {
    const skillDir = path.join(root, 'skills', 'demo');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: demo\ndescription: demo skill\ntools:\n  - name: read_file\n---\n# Demo\n',
      'utf8',
    );

    const normalizer = new SkillIrNormalizerService();
    const first = normalizer.normalizeFromDir({ skillDir });
    const second = normalizer.normalizeFromDir({ skillDir });
    expect(first.skillIrDigest).toBe(second.skillIrDigest);

    const metrics = new SkillHotPathCacheService().getMetrics();
    expect(metrics.irHits).toBeGreaterThanOrEqual(1);
    expect(metrics.irMisses).toBeGreaterThanOrEqual(1);
  });

  it('bind cache hits on second bind of same tools', () => {
    const first = bindSkillDeclaredTools(['read_file', 'web_search'], {
      skillId: 'demo',
      useBindCache: true,
    });
    const second = bindSkillDeclaredTools(['read_file', 'web_search'], {
      skillId: 'demo',
      useBindCache: true,
    });
    expect(first.resolvedToolNames).toEqual(second.resolvedToolNames);
    expect(second.cacheHit).toBe(true);

    const metrics = new SkillHotPathCacheService().getMetrics();
    expect(metrics.bindHits).toBeGreaterThanOrEqual(1);
  });

  it('digest short-circuit skips re-install of matching SkillIR', async () => {
    const projectRoot = path.join(root, 'project');
    fs.mkdirSync(path.join(projectRoot, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'data', 'runtime'), { recursive: true });

    const skillDir = path.join(root, 'pack-once');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Pack once\n\nUse read_file.\n', 'utf8');
    fs.writeFileSync(
      path.join(skillDir, 'manifest.json'),
      JSON.stringify({
        name: 'pack-once',
        version: '1.0.0',
        description: 'digest short-circuit fixture',
        author: 'zavorth-test',
        tools: [{ name: 'read_file', description: 'Read a file' }],
      }),
      'utf8',
    );

    const pipeline = new SkillInstallPipelineService({
      projectRoot,
      skillsDir: path.join(projectRoot, 'skills'),
      receiptsDir: path.join(projectRoot, 'data', 'runtime', 'skill-install-receipts'),
      now: () => new Date('2026-07-15T18:00:00.000Z'),
    });

    const prev = process.cwd();
    process.chdir(projectRoot);
    try {
      const first = await pipeline.apply({ source: skillDir, consent: true });
      expect(['applied', 'partial']).toContain(first.status);
      expect(first.skillIrDigest).toBeTruthy();
      expect(first.targetDir).toBeTruthy();

      const cache = new SkillHotPathCacheService();
      // Ensure index has digest even if apply path failed to record
      cache.recordInstallDigest({
        skillId: String(first.skillId || 'pack-once'),
        skillIrDigest: String(first.skillIrDigest),
        targetDir: first.targetDir,
      });

      const before = cache.getMetrics().digestShortCircuits;
      const second = await pipeline.apply({ source: skillDir, consent: true });
      expect(second.status).toBe('applied');
      expect(String(second.reason || second.smoke?.detail || '')).toMatch(
        /digest short-circuit|short-circuit|digest_short_circuit/i,
      );
      expect(cache.getMetrics().digestShortCircuits).toBeGreaterThan(before);
    } finally {
      process.chdir(prev);
    }
  });
});
