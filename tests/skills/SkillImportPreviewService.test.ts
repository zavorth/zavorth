import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillImportPreviewService } from '../../src/skills/SkillImportPreviewService.js';
import type { SkillSourceRegistryEntry } from '../../src/services/SkillSourceRegistryService.js';

function writeSkill(skillDir: string, name: string, description: string): void {
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    'utf8',
  );
}

describe('SkillImportPreviewService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-preview-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('combines policy, license and scanner signals into the curated preview', () => {
    const sourceSkillDir = path.join(root, 'skills_omni', 'security-threat-model');
    writeSkill(sourceSkillDir, 'security-threat-model', 'Threat modeling workflow.');
    fs.mkdirSync(path.join(sourceSkillDir, 'references'), { recursive: true });
    fs.mkdirSync(path.join(sourceSkillDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(sourceSkillDir, 'references', 'prompt-template.md'), '# prompt', 'utf8');
    fs.writeFileSync(path.join(sourceSkillDir, 'LICENSE.txt'), 'Apache License\nVersion 2.0\n', 'utf8');
    fs.writeFileSync(path.join(sourceSkillDir, 'scripts', 'helper.py'), 'print("hello")', 'utf8');

    const source: SkillSourceRegistryEntry = {
      id: 'external-review-source',
      label: 'External review source',
      kind: 'repository',
      trust: 'review',
      enabled: true,
      ingestionMode: 'allowlist-import',
      path: 'skill-library/vendor/review-skills',
      absolutePath: path.join(root, 'skills_omni'),
      createIfMissing: false,
      ownership: 'curated-import',
      registrySource: 'zavorth:test-review-source',
      upstream: null,
      pinnedRevision: 'test-fixture-20260407',
      license: 'mixed',
      notes: [],
      allowedExternalSupportPaths: [],
      absoluteAllowedExternalSupportPaths: [],
    };
    const target: SkillSourceRegistryEntry = {
      ...source,
      id: 'workspace-imported-library',
      label: 'Workspace imported skill library',
      kind: 'workspace',
      trust: 'review',
      enabled: true,
      ingestionMode: 'local-scan',
      absolutePath: path.join(root, 'imported'),
      path: 'skill-library/imported',
      registrySource: 'zavorth:curated-import',
      upstream: null,
    };

    const service = new SkillImportPreviewService({
      skillTrustPolicyService: {
        evaluateSource: () => ({
          allowed: true,
          sourceId: source.id,
          skillName: null,
          mode: 'explicit',
          reason: 'source allowed',
        }),
        evaluateSkill: (_sourceId, skillName) => ({
          allowed: skillName === 'security-threat-model',
          sourceId: source.id,
          skillName,
          mode: 'explicit',
          reason: skillName === 'security-threat-model' ? 'allowed' : 'blocked',
        }),
      },
    });

    const preview = service.buildPreview({
      source,
      targetSource: target,
      sourceSkillDirPaths: [sourceSkillDir],
    });

    expect(preview.allowedCount).toBe(1);
    expect(preview.entries[0]).toEqual(
      expect.objectContaining({
        skillName: 'security-threat-model',
        allowed: true,
        license: 'Apache-2.0',
        licensePolicy: expect.objectContaining({
          label: 'permissive',
        }),
        risk: expect.objectContaining({
          level: 'medium',
        }),
      }),
    );
    expect(preview.entries[0].importableFiles).toEqual(
      expect.arrayContaining(['SKILL.md', 'references/prompt-template.md', 'LICENSE.txt']),
    );
    expect(preview.entries[0].skippedFiles).toEqual(expect.arrayContaining(['scripts/helper.py']));
  });

  it('blocks a skill when the detected license is restricted', () => {
    const sourceSkillDir = path.join(root, 'skills_omni', 'closed-playbook');
    fs.mkdirSync(sourceSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(sourceSkillDir, 'SKILL.md'),
      [
        '---',
        'name: closed-playbook',
        'description: Closed-source skill.',
        'license: proprietary',
        '---',
        '',
        '# closed-playbook',
      ].join('\n'),
      'utf8',
    );

    const source: SkillSourceRegistryEntry = {
      id: 'external-review-source',
      label: 'External review source',
      kind: 'repository',
      trust: 'review',
      enabled: true,
      ingestionMode: 'allowlist-import',
      path: 'skill-library/vendor/review-skills',
      absolutePath: path.join(root, 'skills_omni'),
      createIfMissing: false,
      ownership: 'curated-import',
      registrySource: 'zavorth:test-review-source',
      upstream: null,
      pinnedRevision: 'test-fixture-20260407',
      license: 'mixed',
      notes: [],
      allowedExternalSupportPaths: [],
      absoluteAllowedExternalSupportPaths: [],
    };
    const target: SkillSourceRegistryEntry = {
      ...source,
      id: 'workspace-imported-library',
      label: 'Workspace imported skill library',
      kind: 'workspace',
      trust: 'review',
      enabled: true,
      ingestionMode: 'local-scan',
      absolutePath: path.join(root, 'imported'),
      path: 'skill-library/imported',
      registrySource: 'zavorth:curated-import',
      upstream: null,
    };

    const service = new SkillImportPreviewService({
      skillTrustPolicyService: {
        evaluateSource: () => ({
          allowed: true,
          sourceId: source.id,
          skillName: null,
          mode: 'explicit',
          reason: 'source allowed',
        }),
        evaluateSkill: (_sourceId, skillName) => ({
          allowed: skillName === 'closed-playbook',
          sourceId: source.id,
          skillName,
          mode: 'explicit',
          reason: 'allowed',
        }),
      },
    });

    const preview = service.buildPreview({
      source,
      targetSource: target,
      sourceSkillDirPaths: [sourceSkillDir],
    });

    expect(preview.allowedCount).toBe(0);
    expect(preview.entries[0]).toEqual(
      expect.objectContaining({
        allowed: false,
        licensePolicy: expect.objectContaining({
          label: 'restricted',
          allowImport: false,
        }),
        risk: expect.objectContaining({
          level: 'blocked',
        }),
      }),
    );
  });

  it('refuses disabled external sources before scanning content', () => {
    const sourceSkillDir = path.join(root, 'skills_omni', 'safe-skill');
    writeSkill(sourceSkillDir, 'safe-skill', 'Safe source fixture.');

    const source: SkillSourceRegistryEntry = {
      id: 'disabled-review-source',
      label: 'Disabled review source',
      kind: 'repository',
      trust: 'review',
      enabled: false,
      ingestionMode: 'allowlist-import',
      path: 'skill-library/vendor/review-skills',
      absolutePath: path.join(root, 'skills_omni'),
      createIfMissing: false,
      ownership: 'curated-import',
      registrySource: 'zavorth:test-review-source',
      upstream: null,
      pinnedRevision: 'test-fixture-20260407',
      license: 'mixed',
      notes: [],
      allowedExternalSupportPaths: [],
      absoluteAllowedExternalSupportPaths: [],
    };

    const service = new SkillImportPreviewService({
      skillTrustPolicyService: {
        evaluateSource: () => ({
          allowed: true,
          sourceId: source.id,
          skillName: null,
          mode: 'explicit',
          reason: 'source allowed',
        }),
        evaluateSkill: (_sourceId, skillName) => ({
          allowed: true,
          sourceId: source.id,
          skillName,
          mode: 'explicit',
          reason: 'allowed',
        }),
      },
    });

    expect(() => service.buildPreview({
      source,
      targetSource: {
        ...source,
        id: 'workspace-imported-library',
        kind: 'workspace',
        enabled: true,
        ingestionMode: 'local-scan',
        absolutePath: path.join(root, 'imported'),
        upstream: null,
        pinnedRevision: null,
      },
      sourceSkillDirPaths: [sourceSkillDir],
    })).toThrow('esta desabilitada');
  });
});
