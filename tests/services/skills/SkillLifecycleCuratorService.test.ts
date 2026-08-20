import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SkillLifecycleCuratorService } from '../../../src/services/skills/SkillLifecycleCuratorService.js';

describe('SkillLifecycleCuratorService', () => {
  let curator: SkillLifecycleCuratorService;
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-curator-test-'));
    curator = new SkillLifecycleCuratorService({ projectRoot: tempRoot });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Cleanup fail-safe
    }
  });

  it('synthesizes a draft skill with YAML frontmatter and instructions', () => {
    const result = curator.synthesizeDraftSkill({
      skillName: 'Deploy Canary Service',
      description: 'Automates blue-green canary deployment verifications.',
      promptInstructions: '1. Build production bundle.\n2. Run smoke tests.\n3. Verify health endpoint.',
      allowedTools: ['run_command', 'read_file'],
    });

    expect(result.success).toBe(true);
    expect(result.skillId).toBe('deploy-canary-service');
    expect(fs.existsSync(result.skillManifestPath)).toBe(true);

    const content = fs.readFileSync(result.skillManifestPath, 'utf8');
    expect(content).toContain('name: deploy-canary-service');
    expect(content).toContain('run_command');
    expect(content).toContain('## Instructions');
  });

  it('audits and tracks active vs stale skill lifecycles', () => {
    curator.recordUsage('skill-active');

    const report = curator.auditSkillLifecycles();
    expect(report.totalSkills).toBe(1);
    expect(report.activeCount).toBe(1);
    expect(report.staleCount).toBe(0);
  });
});
