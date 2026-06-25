import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';
import { ZavorthSkillCuratorLiveLoopService } from '@zavorth/skills/ZavorthSkillCuratorLiveLoopService.js';

describe('ZavorthSkillCuratorLiveLoopService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-curator-'));
    writeSkill('skill-library/native/repo-map', '# Repo Map\nMap repositories, files, modules and ownership.\n\nUse for codebase inventory and architecture maps.', true);
    writeSkill('skill-library/native/repo-inventory', '# Repo Inventory\nMap repositories, files, modules and ownership quickly.\n\nUse for codebase inventory and architecture maps.', true);
    writeSkill('skill-library/imported/pdf-reader', '# PDF Reader\nRead documents and summarize PDFs for the operator.\n\nUse for document analysis.', false);
    writeUsageSignal('data/runtime/receipts/2026-05-18-repo-map.jsonl', '{"skill":"repo-map","receipt":true,"approval":"appr-1","status":"passed","success":true}');
    writeUsageSignal('data/runtime/secret-token-log.json', '{"skill":"repo-map","receipt":true,"status":"passed","secret":"must-not-be-counted"}');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('scans local skill sources and proposes governed curation without mutating skills', () => {
    const service = new ZavorthSkillCuratorLiveLoopService({
      now: () => new Date('2026-05-18T10:00:00.000Z'),
      projectRoot: root,
      stateDir: path.join(root, 'data', 'skill-curator'),
      sourceRegistry: sourceRegistry(root),
    });

    const snapshot = service.buildSnapshot();
    const text = service.renderText(snapshot);

    expect(snapshot.contractVersion).toBe('zavorth-skill-curator-live-loop/1');
    expect(snapshot.mode).toBe('preview');
    expect(snapshot.summary.skills).toBe(3);
    expect(snapshot.summary.averageQualityScore).toBeGreaterThan(0);
    expect(snapshot.proposals.some((proposal) => proposal.kind === 'merge-candidates')).toBe(true);
    expect(snapshot.proposals.some((proposal) => proposal.kind === 'metadata-repair')).toBe(true);
    expect(snapshot.proposals.every((proposal) => proposal.patchPreview.rollback.length > 0)).toBe(true);
    expect(snapshot.evolution).toEqual(expect.objectContaining({
      enabled: true,
      usageSignalsRead: true,
      patchPreviewGenerated: true,
      rollbackPlanned: true,
      liveMutationPerformed: false,
      receiptBacked: false,
    }));
    const repoMap = snapshot.skills.find((skill) => skill.name === 'repo-map');
    expect(repoMap?.usage.mentions).toBe(1);
    expect(repoMap?.usage.receipts).toBeGreaterThan(0);
    expect(repoMap?.quality.score).toBeGreaterThan(0);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noSilentDelete: true,
      noSilentMerge: true,
      noExternalNetworkProbe: true,
      noSkillExecution: true,
      applyRequiresApprovalId: true,
      applyWritesCuratorStateOnly: true,
      generatedPatchRequiresSeparateApproval: true,
      rollbackPlanRequired: true,
    }));
    expect(text).toContain('Zavorth Skill Curator Live Loop');
    expect(text).toContain('Apply governado');
    expect(fs.existsSync(path.join(root, 'data', 'skill-curator', 'skill-curator-state.json'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'skill-library/native/repo-map/SKILL.md'))).toBe(true);
  });

  it('honors explicit proposal selection and refuses unknown proposal ids', () => {
    const service = new ZavorthSkillCuratorLiveLoopService({
      projectRoot: root,
      stateDir: path.join(root, 'data', 'skill-curator'),
      sourceRegistry: sourceRegistry(root),
    });

    const selected = service.buildSnapshot({ proposalIds: ['metadata:skill-library/imported/pdf-reader'] });
    const invalid = service.buildSnapshot({
      apply: true,
      approvalId: 'appr-skill-curator-2',
      proposalIds: ['missing:proposal'],
    });

    expect(selected.proposals).toHaveLength(1);
    expect(selected.proposals[0]?.id).toBe('metadata:skill-library/imported/pdf-reader');
    expect(invalid.apply.applied).toBe(false);
    expect(invalid.status).toBe('blocked');
    expect(invalid.apply.approvalSatisfied).toBe(true);
    expect(invalid.apply.proposalSelectionSatisfied).toBe(false);
    expect(invalid.apply.missingProposalIds).toEqual(['missing:proposal']);
    expect(fs.existsSync(path.join(root, 'data', 'skill-curator', 'skill-curator-state.json'))).toBe(false);
  });

  it('requires approval id before writing curator state', () => {
    const service = new ZavorthSkillCuratorLiveLoopService({
      projectRoot: root,
      stateDir: path.join(root, 'data', 'skill-curator'),
      sourceRegistry: sourceRegistry(root),
    });

    const blocked = service.buildSnapshot({ apply: true });
    const applied = service.buildSnapshot({ apply: true, approvalId: 'appr-skill-curator-1' });

    expect(blocked.apply.applied).toBe(false);
    expect(blocked.apply.approvalSatisfied).toBe(false);
    expect(applied.apply.applied).toBe(true);
    expect(applied.apply.approvalSatisfied).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'skill-curator', 'skill-curator-state.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'skill-curator', 'skill-curator-receipt.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'data', 'skill-curator', 'skill-curator-patch-preview.json'))).toBe(true);
    const patchPreview = JSON.parse(fs.readFileSync(path.join(root, 'data', 'skill-curator', 'skill-curator-patch-preview.json'), 'utf8'));
    expect(patchPreview.requiresSeparatePatchApproval).toBe(true);
    expect(patchPreview.patches.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(root, 'skill-library/native/repo-map/SKILL.md'))).toBe(true);
  });

  it('can use a scoped persistent approval policy for non-destructive proposals', () => {
    const service = new ZavorthSkillCuratorLiveLoopService({
      projectRoot: root,
      stateDir: path.join(root, 'data', 'skill-curator'),
      sourceRegistry: sourceRegistry(root),
      persistentApprovals: {
        resolve: jest.fn().mockReturnValue({
          allowed: true,
          policy: { id: 'pap-skill-curator-live-loop-metadata' },
          reason: 'matched',
          receiptId: 'pap-skill-curator-live-loop-metadata.receipt',
        }),
      },
    });

    const applied = service.buildSnapshot({
      apply: true,
      usePersistentApproval: true,
      proposalIds: ['metadata:skill-library/imported/pdf-reader'],
    });

    expect(applied.apply.applied).toBe(true);
    expect(applied.apply.approvalMode).toBe('persistent-policy');
    expect(applied.apply.persistentPolicyId).toBe('pap-skill-curator-live-loop-metadata');
    expect(fs.existsSync(path.join(root, 'skill-library/imported/pdf-reader/SKILL.md'))).toBe(true);
  });

  it('applies only safe native metadata when explicitly requested and approved', () => {
    fs.rmSync(path.join(root, 'skill-library/native/repo-map/ZAVORTH_NATIVE_SKILL.json'), { force: true });
    fs.rmSync(path.join(root, 'skill-library/native/repo-inventory/ZAVORTH_NATIVE_SKILL.json'), { force: true });
    const service = new ZavorthSkillCuratorLiveLoopService({
      now: () => new Date('2026-05-18T10:00:00.000Z'),
      projectRoot: root,
      stateDir: path.join(root, 'data', 'skill-curator'),
      sourceRegistry: sourceRegistry(root),
    });

    const applied = service.buildSnapshot({
      apply: true,
      applySafeMetadata: true,
      approvalId: 'appr-native-metadata',
      proposalIds: [
        'metadata:skill-library/native/repo-map',
        'metadata:skill-library/native/repo-inventory',
      ],
    });

    expect(applied.apply.applied).toBe(true);
    expect(applied.apply.safeMetadataApplyRequested).toBe(true);
    expect(applied.apply.safeMetadataApplyEligible).toBe(true);
    expect(applied.apply.safeMetadataApplied).toBe(true);
    expect(applied.apply.safeMetadataFiles).toEqual(expect.arrayContaining([
      'skill-library/native/repo-map/ZAVORTH_NATIVE_SKILL.json',
      'skill-library/native/repo-inventory/ZAVORTH_NATIVE_SKILL.json',
    ]));
    expect(applied.evolution.liveMutationPerformed).toBe(true);
    expect(applied.safety.applyWritesCuratorStateOnly).toBe(false);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'skill-library/native/repo-map/ZAVORTH_NATIVE_SKILL.json'), 'utf8'));
    expect(manifest.safeMetadataApply).toBe(true);
    expect(manifest.contractVersion).toBe('zavorth-skill-curator-live-loop/1');
    expect(fs.existsSync(path.join(root, 'skill-library/native/repo-map/SKILL.md'))).toBe(true);
  });

  function writeSkill(relativeDir: string, content: string, nativeManifest: boolean): void {
    const dir = path.join(root, relativeDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content, 'utf8');
    if (nativeManifest) {
      fs.writeFileSync(path.join(dir, 'ZAVORTH_NATIVE_SKILL.json'), JSON.stringify({ id: path.basename(dir) }), 'utf8');
    }
  }

  function writeUsageSignal(relativePath: string, content: string): void {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

function sourceRegistry(root: string) {
  return {
    listSearchSources: () => [
      source('zavorth-native', path.join(root, 'skill-library/native'), 'skill-library/native', 'trusted'),
      source('workspace-imported-library', path.join(root, 'skill-library/imported'), 'skill-library/imported', 'review'),
    ],
  };
}

function source(id: string, absolutePath: string, relativePath: string, trust: 'trusted' | 'review') {
  return {
    id,
    label: id,
    kind: 'workspace',
    trust,
    enabled: true,
    ingestionMode: 'local-scan',
    path: relativePath,
    absolutePath,
    createIfMissing: true,
    ownership: 'test',
    registrySource: 'test',
    upstream: null,
    pinnedRevision: null,
    license: null,
    notes: [],
    allowedExternalSupportPaths: [],
    absoluteAllowedExternalSupportPaths: [],
  } as any;
}
