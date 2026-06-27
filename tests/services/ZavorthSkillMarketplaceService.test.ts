import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSkillMarketplaceService } from '../../src/services/ZavorthSkillMarketplaceService.js';

function createNativeSkill(
  nativeDir: string,
  id: string,
  overrides: Partial<{
    title: string;
    description: string;
    category: string;
    tags: string[];
    curatedBy: string;
  }> = {},
): void {
  const skillDir = path.join(nativeDir, id);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${overrides.title || id}\ndescription: ${overrides.description || `Skill ${id}`}\n---\n\n# ${id}\n`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(skillDir, 'ZAVORTH_NATIVE_SKILL.json'),
    JSON.stringify({
      id,
      title: overrides.title || id,
      name: overrides.title || id,
      description: overrides.description || `Skill ${id}`,
      source: 'workspace-library',
      trust: 'trusted',
      tags: overrides.tags || ['test'],
      curatedBy: overrides.curatedBy || 'zavorth-skill-curator',
      contractVersion: '1.0.0',
      updatedAt: '2026-06-22T00:00:00.000Z',
      native: true,
      category: overrides.category || 'development',
      permissionProfileId: 'workspace-read',
      riskLevel: 'low',
      safeMetadataApply: true,
      noExecutionByDefault: true,
      requiresPolicyBroker: true,
      receiptsRequired: true,
    }),
    'utf8',
  );
}

function createMarketplaceIndex(projectRoot: string, categories: Array<{ id: string; label: string; description: string; skillCount: number }>): void {
  fs.writeFileSync(
    path.join(projectRoot, 'config', 'marketplace-index.json'),
    JSON.stringify({ schemaVersion: 'zavorth.marketplace-index/v1', categories, remoteRegistry: null }),
    'utf8',
  );
}

describe('ZavorthSkillMarketplaceService', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-marketplace-'));
    fs.mkdirSync(path.join(projectRoot, 'skill-library', 'native'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'config'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('lists categories from marketplace index', () => {
    createMarketplaceIndex(projectRoot, [
      { id: 'development', label: 'Development', description: 'Code tools', skillCount: 0 },
      { id: 'security', label: 'Security', description: 'Security tools', skillCount: 0 },
    ]);

    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const categories = service.listCategories();

    expect(categories).toHaveLength(2);
    expect(categories[0]).toEqual(expect.objectContaining({ id: 'development', label: 'Development' }));
    expect(categories[1]).toEqual(expect.objectContaining({ id: 'security', label: 'Security' }));
  });

  it('searches native skills by name', () => {
    createMarketplaceIndex(projectRoot, [
      { id: 'development', label: 'Development', description: '', skillCount: 0 },
    ]);
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-code-review', {
      title: 'Zavorth Code Review',
      description: 'Reviews code for quality',
      category: 'development',
      tags: ['code', 'review'],
    });
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-security-audit', {
      title: 'Zavorth Security Audit',
      description: 'Audits security vulnerabilities',
      category: 'security',
      tags: ['security', 'audit'],
    });

    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const result = service.search({ query: 'code review' });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('zavorth-code-review');
  });

  it('searches by category', () => {
    createMarketplaceIndex(projectRoot, [
      { id: 'development', label: 'Development', description: '', skillCount: 0 },
      { id: 'security', label: 'Security', description: '', skillCount: 0 },
    ]);
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-code-review', {
      title: 'Code Review',
      category: 'development',
    });
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-security-audit', {
      title: 'Security Audit',
      category: 'security',
    });

    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const result = service.search({ category: 'security' });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('zavorth-security-audit');
  });

  it('aggregates curated category aliases for marketplace counts and category search', () => {
    createMarketplaceIndex(projectRoot, [
      { id: 'devops', label: 'DevOps', description: '', skillCount: 0 },
      { id: 'communication', label: 'Communication', description: '', skillCount: 0 },
    ]);
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-docker', {
      title: 'Docker Ops',
      category: 'devops',
    });
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-incident', {
      title: 'Incident Ops',
      category: 'operations',
    });
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-slack', {
      title: 'Slack Workflow',
      category: 'channels',
    });

    const service = new ZavorthSkillMarketplaceService({ projectRoot });

    expect(service.listCategories()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'devops', skillCount: 2 }),
        expect.objectContaining({ id: 'communication', skillCount: 1 }),
      ]),
    );
    expect(service.search({ category: 'devops' }).entries.map((entry) => entry.id).sort()).toEqual([
      'zavorth-docker',
      'zavorth-incident',
    ]);
    expect(service.search({ category: 'communication' }).entries.map((entry) => entry.id)).toEqual([
      'zavorth-slack',
    ]);
  });

  it('gets skill details by id', () => {
    createMarketplaceIndex(projectRoot, []);
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-data-analysis', {
      title: 'Zavorth Data Analysis',
      description: 'Analyzes data sets',
      category: 'research',
      tags: ['data', 'analysis'],
      curatedBy: 'zavorth-skill-curator',
    });

    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const skill = service.getSkill('zavorth-data-analysis');

    expect(skill).not.toBeNull();
    expect(skill!.id).toBe('zavorth-data-analysis');
    expect(skill!.name).toBe('Zavorth Data Analysis');
    expect(skill!.description).toBe('Analyzes data sets');
    expect(skill!.category).toBe('research');
    expect(skill!.tags).toEqual(['data', 'analysis']);
    expect(skill!.author).toBe('zavorth-skill-curator');
  });

  it('returns null for unknown skill id', () => {
    createMarketplaceIndex(projectRoot, []);
    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const skill = service.getSkill('nonexistent-skill');

    expect(skill).toBeNull();
  });

  it('returns marketplace stats', () => {
    createMarketplaceIndex(projectRoot, [
      { id: 'development', label: 'Development', description: '', skillCount: 0 },
      { id: 'security', label: 'Security', description: '', skillCount: 0 },
    ]);
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-code-review', {
      title: 'Code Review',
      category: 'development',
    });
    createNativeSkill(path.join(projectRoot, 'skill-library', 'native'), 'zavorth-security-audit', {
      title: 'Security Audit',
      category: 'security',
    });

    const service = new ZavorthSkillMarketplaceService({ projectRoot });
    const stats = service.getStats();

    expect(stats.totalSkills).toBe(2);
    expect(stats.totalCategories).toBe(2);
    expect(stats.totalDownloads).toBe(0);
    expect(stats.averageRating).toBe(0);
  });
});
