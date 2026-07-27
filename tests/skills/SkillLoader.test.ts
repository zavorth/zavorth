import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillLoader } from '../../src/skills/SkillLoader.js';
import { SkillSourceRegistryService } from '../../src/services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../../src/services/SkillTrustPolicyService.js';

function writeSkill(skillDir: string, name: string, description: string): void {
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    'utf8',
  );
}

describe('SkillLoader', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-loader-'));
    fs.mkdirSync(path.join(workspaceRoot, 'config'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('rejects disallowed sources before loading skills and enforces explicit skill allowlists', () => {
    writeSkill(
      path.join(workspaceRoot, '.agents', 'skills', 'local-core'),
      'local-core',
      'Skill local trusted.',
    );
    writeSkill(
      path.join(workspaceRoot, 'vendors', 'blocked-source', 'blocked-vendor'),
      'blocked-vendor',
      'Skill de source not allowed.',
    );
    writeSkill(
      path.join(workspaceRoot, 'vendors', 'curated-source', 'security-threat-model'),
      'security-threat-model',
      'Skill explicitamente allowed.',
    );
    writeSkill(
      path.join(workspaceRoot, 'vendors', 'curated-source', 'chrome-devtools'),
      'chrome-devtools',
      'Skill fora da allowlist explicita.',
    );

    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-sources.json'),
      JSON.stringify({
        version: 1,
        sources: [
          {
            id: 'workspace-agents',
            label: 'Workspace .agents skills',
            kind: 'workspace',
            trust: 'trusted',
            enabled: true,
            ingestionMode: 'local-scan',
            path: '.agents/skills',
            createIfMissing: true,
          },
          {
            id: 'workspace-imported-library',
            label: 'Workspace imported skill library',
            kind: 'workspace',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'skill-library/imported',
            createIfMissing: true,
          },
          {
            id: 'blocked-source',
            label: 'Blocked source',
            kind: 'repository',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'vendors/blocked-source',
          },
          {
            id: 'external-review-source',
            label: 'Curated source',
            kind: 'repository',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'vendors/curated-source',
          },
        ],
      }, null, 2),
      'utf8',
    );

    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      JSON.stringify({
        version: 1,
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-agents', 'workspace-imported-library'],
        rules: [
          {
            sourceId: 'workspace-agents',
            mode: 'all',
          },
          {
            sourceId: 'workspace-imported-library',
            mode: 'all',
          },
          {
            sourceId: 'external-review-source',
            mode: 'explicit',
            skillNames: ['security-threat-model'],
          },
        ],
      }, null, 2),
      'utf8',
    );

    const loader = new SkillLoader({
      sourceRegistryService: new SkillSourceRegistryService({
        projectRoot: workspaceRoot,
        configFile: path.join(workspaceRoot, 'config', 'skill-sources.json'),
      }),
      skillTrustPolicyService: new SkillTrustPolicyService({
        projectRoot: workspaceRoot,
        policyFile: path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      }),
    });

    const skills = loader.loadAll({ quiet: true });

    expect(skills.map((entry) => entry.name).sort()).toEqual(['local-core', 'security-threat-model']);
    expect(skills.find((entry) => entry.name === 'local-core')).toEqual(
      expect.objectContaining({
        sourceId: 'workspace-agents',
        sourceTrust: 'trusted',
        bundleTags: expect.arrayContaining(['local', 'skill']),
      }),
    );
    expect(skills.find((entry) => entry.name === 'blocked-vendor')).toBeUndefined();
    expect(skills.find((entry) => entry.name === 'chrome-devtools')).toBeUndefined();
  });

  it('loads imported skill provenance, license and structured support files', () => {
    const importedSkillDir = path.join(workspaceRoot, 'skill-library', 'imported', 'security-threat-model');
    writeSkill(importedSkillDir, 'security-threat-model', 'Threat model imported from curated upstream.');
    fs.mkdirSync(path.join(importedSkillDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(importedSkillDir, 'references', 'checklist.md'), '# checklist', 'utf8');
    fs.writeFileSync(
      path.join(importedSkillDir, 'ORIGIN.json'),
      JSON.stringify({
        version: 1,
        importedAt: '2026-04-07T00:00:00.000Z',
        importMode: 'allowlist-import',
        skillName: 'security-threat-model',
        source: {
          id: 'external-review-source',
          label: 'External review source',
          kind: 'repository',
          trust: 'review',
          registrySource: 'zavorth:test-review-source',
          upstream: null,
          pinnedRevision: 'test-fixture-20260407',
          license: 'mixed',
          ownership: 'curated-import',
        },
        originalSkillPath: 'C:/mirror/awesome/security-threat-model',
        originalRelativePath: 'skills/security-threat-model',
        copiedFiles: ['SKILL.md', 'references/checklist.md'],
      }, null, 2),
      'utf8',
    );
    fs.writeFileSync(path.join(importedSkillDir, 'ATTRIBUTION.md'), '# Attribution', 'utf8');

    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-sources.json'),
      JSON.stringify({
        version: 1,
        sources: [
          {
            id: 'workspace-imported-library',
            label: 'Workspace imported skill library',
            kind: 'workspace',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'skill-library/imported',
            createIfMissing: true,
            ownership: 'curated-import',
            registrySource: 'zavorth:curated-import',
          },
        ],
      }, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      JSON.stringify({
        version: 1,
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-imported-library'],
        rules: [
          {
            sourceId: 'workspace-imported-library',
            mode: 'all',
          },
        ],
      }, null, 2),
      'utf8',
    );

    const loader = new SkillLoader({
      sourceRegistryService: new SkillSourceRegistryService({
        projectRoot: workspaceRoot,
        configFile: path.join(workspaceRoot, 'config', 'skill-sources.json'),
      }),
      skillTrustPolicyService: new SkillTrustPolicyService({
        projectRoot: workspaceRoot,
        policyFile: path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      }),
    });

    const skill = loader.loadAll({ quiet: true })[0];

    expect(skill).toEqual(
      expect.objectContaining({
        name: 'security-threat-model',
        sourceId: 'workspace-imported-library',
        sourceTrust: 'review',
        license: 'mixed',
        bundleTags: expect.arrayContaining(['skill', 'imported', 'security', 'with-support-files']),
      }),
    );
    expect(skill.supportFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reference',
          relativePath: 'references/checklist.md',
        }),
      ]),
    );
    expect(skill.provenance).toEqual(
      expect.objectContaining({
        imported: true,
        upstreamSourceId: 'external-review-source',
        upstreamRepository: null,
        upstreamRelativePath: 'skills/security-threat-model',
      }),
    );
  });

  it('supports progressive disclosure by listing metadata before opening full skill prompts', () => {
    const skillDir = path.join(workspaceRoot, '.agents', 'skills', 'progressive-skill');
    writeSkill(skillDir, 'progressive-skill', 'Progressive disclosure fixture.');
    fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'references', 'deep-context.md'), '# Deep context', 'utf8');

    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-sources.json'),
      JSON.stringify({
        version: 1,
        sources: [
          {
            id: 'workspace-agents',
            label: 'Workspace .agents skills',
            kind: 'workspace',
            trust: 'trusted',
            enabled: true,
            ingestionMode: 'local-scan',
            path: '.agents/skills',
            createIfMissing: true,
          },
        ],
      }, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      JSON.stringify({
        version: 1,
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-agents'],
        rules: [{ sourceId: 'workspace-agents', mode: 'all' }],
      }, null, 2),
      'utf8',
    );

    const loader = new SkillLoader({
      sourceRegistryService: new SkillSourceRegistryService({
        projectRoot: workspaceRoot,
        configFile: path.join(workspaceRoot, 'config', 'skill-sources.json'),
      }),
      skillTrustPolicyService: new SkillTrustPolicyService({
        projectRoot: workspaceRoot,
        policyFile: path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      }),
    });

    const index = loader.listDisclosureIndex({ quiet: true });
    expect(index).toEqual([
      expect.objectContaining({
        name: 'progressive-skill',
        description: 'Progressive disclosure fixture.',
      }),
    ]);

    const metadataOnlyView = loader.viewSkill('progressive-skill', { quiet: true });
    expect(metadataOnlyView?.prompt).toContain('# progressive-skill');
    expect(metadataOnlyView?.prompt).not.toContain('Deep context');

    const fullView = loader.viewSkill('progressive-skill', { quiet: true, includeSupportFiles: true });
    expect(fullView?.prompt).toContain('Deep context');
    expect(fullView?.supportFilesIncluded).toBe(true);
  });

  it('discovers nested generated expansion skills under imported libraries', () => {
    writeSkill(
      path.join(workspaceRoot, 'skill-library', 'imported', 'zavorth-expansion-pack', 'research', 'research-pack'),
      'research-pack',
      'Generated Zavorth-native research route.',
    );
    writeSkill(
      path.join(workspaceRoot, 'skill-library', 'imported', 'zavorth-expansion-pack', 'finance', 'trading-desk'),
      'trading-desk',
      'Generated Zavorth-native trading route.',
    );

    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-sources.json'),
      JSON.stringify({
        version: 1,
        sources: [
          {
            id: 'workspace-imported-library',
            label: 'Workspace imported skill library',
            kind: 'workspace',
            trust: 'review',
            enabled: true,
            ingestionMode: 'local-scan',
            path: 'skill-library/imported',
            createIfMissing: true,
          },
        ],
      }, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      JSON.stringify({
        version: 1,
        defaultPolicy: 'deny',
        allowedSourceIds: ['workspace-imported-library'],
        rules: [{ sourceId: 'workspace-imported-library', mode: 'all' }],
      }, null, 2),
      'utf8',
    );

    const loader = new SkillLoader({
      sourceRegistryService: new SkillSourceRegistryService({
        projectRoot: workspaceRoot,
        configFile: path.join(workspaceRoot, 'config', 'skill-sources.json'),
      }),
      skillTrustPolicyService: new SkillTrustPolicyService({
        projectRoot: workspaceRoot,
        policyFile: path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
      }),
    });

    expect(loader.loadAll({ quiet: true }).map((entry) => entry.name).sort()).toEqual([
      'research-pack',
      'trading-desk',
    ]);
  });
});
