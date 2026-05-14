import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillImportService } from '../../src/skills/SkillImportService.js';
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

describe('SkillImportService', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-import-'));
    fs.mkdirSync(path.join(workspaceRoot, 'config'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('imports only allowlisted skills and preserves reviewed source provenance', () => {
    writeSkill(
      path.join(workspaceRoot, 'vendors', 'review-skills', 'security-threat-model'),
      'security-threat-model',
      'Threat modeling for secure reviews.',
    );
    fs.mkdirSync(
      path.join(workspaceRoot, 'vendors', 'review-skills', 'security-threat-model', 'references'),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        workspaceRoot,
        'vendors',
        'review-skills',
        'security-threat-model',
        'references',
        'threat-checklist.md',
      ),
      '# threat checklist',
      'utf8',
    );
    writeSkill(
      path.join(workspaceRoot, 'vendors', 'review-skills', 'chrome-devtools'),
      'chrome-devtools',
      'Browser tooling and devtools automation.',
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
            ownership: 'curated-import',
            registrySource: 'zavorth:curated-import',
          },
          {
            id: 'external-review-source',
            label: 'External review source',
            kind: 'repository',
            trust: 'review',
            enabled: true,
            ingestionMode: 'allowlist-import',
            path: 'vendors/review-skills',
            ownership: 'curated-import',
            registrySource: 'zavorth:test-review-source',
            upstream: null,
            pinnedRevision: 'test-fixture-20260407',
            license: 'mixed',
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
          {
            sourceId: 'external-review-source',
            mode: 'explicit',
            skillNames: ['security-threat-model'],
          },
        ],
      }, null, 2),
      'utf8',
    );

    const sourceRegistry = new SkillSourceRegistryService({
      projectRoot: workspaceRoot,
      configFile: path.join(workspaceRoot, 'config', 'skill-sources.json'),
    });
    const trustPolicy = new SkillTrustPolicyService({
      projectRoot: workspaceRoot,
      policyFile: path.join(workspaceRoot, 'config', 'skill-allowlist.json'),
    });
    const service = new SkillImportService({
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      projectRoot: workspaceRoot,
      sourceRegistryService: sourceRegistry,
      skillTrustPolicyService: trustPolicy,
    });

    const preview = service.previewImport({ sourceId: 'external-review-source' });
    expect(preview.allowedCount).toBe(1);
    expect(preview.blockedCount).toBe(1);

    const result = service.importAllowedSkills({ sourceId: 'external-review-source' });
    expect(result.importedCount).toBe(1);
    expect(result.importedSkillNames).toEqual(['security-threat-model']);
    expect(result.previewAudit?.lastEventId).toContain('preview-');
    expect(result.importAudit?.lastEventId).toContain('import-');
    expect(
      fs.existsSync(path.join(workspaceRoot, 'skill-library', 'imported', 'security-threat-model', 'SKILL.md')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(workspaceRoot, 'skill-library', 'imported', 'chrome-devtools', 'SKILL.md')),
    ).toBe(false);

    const origin = JSON.parse(
      fs.readFileSync(
        path.join(workspaceRoot, 'skill-library', 'imported', 'security-threat-model', 'ORIGIN.json'),
        'utf8',
      ),
    ) as {
      source: { id: string };
      originalRelativePath: string;
      governance: {
        risk: { level: string };
        licensePolicy: { label: string };
        audit: { lastEventId: string };
      };
    };
    expect(origin.source.id).toBe('external-review-source');
    expect(origin.originalRelativePath).toBe('review-skills/security-threat-model');
    expect(origin.governance.risk.level).toBe('medium');
    expect(origin.governance.licensePolicy.label).toBe('review');
    expect(origin.governance.audit.lastEventId).toContain('import-');

    const loader = new SkillLoader({
      sourceRegistryService: sourceRegistry,
      skillTrustPolicyService: trustPolicy,
    });
    const importedSkill = loader.loadAll({ quiet: true }).find((entry) => entry.name === 'security-threat-model');
    expect(importedSkill).toEqual(
      expect.objectContaining({
        sourceId: 'workspace-imported-library',
        license: 'mixed',
        bundleTags: expect.arrayContaining(['imported', 'security']),
        risk: expect.objectContaining({
          level: 'medium',
        }),
        licensePolicy: expect.objectContaining({
          label: 'review',
        }),
      }),
    );
    expect(importedSkill?.provenance).toEqual(
      expect.objectContaining({
        imported: true,
        upstreamSourceId: 'external-review-source',
        upstreamRepository: null,
        audit: expect.objectContaining({
          lastEventId: expect.stringContaining('import-'),
        }),
      }),
    );
    expect(
      fs.existsSync(path.join(workspaceRoot, 'skill-library', 'imported', 'security-threat-model', 'references', 'threat-checklist.md')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(workspaceRoot, 'skill-library', 'imported', '.zavorth-import-audit.json')),
    ).toBe(true);
  });
});
