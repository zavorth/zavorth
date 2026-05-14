import fs from 'fs';
import os from 'os';
import path from 'path';
import { ImportAuditTrailService } from '../../src/skills/ImportAuditTrailService.js';
import type { SkillImportDetailedPreview } from '../../src/skills/SkillImportPreviewService.js';

describe('ImportAuditTrailService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-audit-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('records preview and import events in a persistent trail', () => {
    const service = new ImportAuditTrailService({
      now: () => new Date('2026-04-08T12:00:00.000Z'),
      projectRoot: root,
    });
    const preview: SkillImportDetailedPreview = {
      sourceId: 'external-review-source',
      sourceLabel: 'External review source',
      sourcePath: path.join(root, 'mirror'),
      targetSourceId: 'workspace-imported-library',
      targetRootPath: path.join(root, 'skill-library', 'imported'),
      totalCandidates: 1,
      allowedCount: 1,
      blockedCount: 0,
      safeCount: 1,
      previewAudit: null,
      entries: [
        {
          skillName: 'security-threat-model',
          sourceSkillDirPath: path.join(root, 'mirror', 'security-threat-model'),
          targetSkillDirPath: path.join(root, 'skill-library', 'imported', 'security-threat-model'),
          allowed: true,
          reason: 'ok',
          alreadyImported: false,
          license: 'MIT',
          licenseConfidence: 'high',
          licenseEvidence: ['EXTERNAL_SOURCE.json'],
          licensePolicy: {
            label: 'permissive',
            allowImport: true,
            allowRuntimeUse: true,
            allowCoreCopy: true,
            reviewRequired: false,
            summary: 'ok',
          },
          risk: {
            score: 8,
            level: 'low',
            reviewRequired: false,
            reasons: ['ok'],
          },
          safeToImport: true,
          issues: [],
          importableFiles: ['SKILL.md'],
          skippedFiles: [],
        },
      ],
    };

    const previewAudit = service.recordPreview(preview);
    const importAudit = service.recordImport(preview, 1, 0);

    expect(previewAudit.lastEventId).toContain('preview-');
    expect(importAudit.lastEventId).toContain('import-');

    const history = service.readHistory();
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual(
      expect.objectContaining({
        kind: 'import',
        importedCount: 1,
        governance: expect.objectContaining({
          highestRiskLevel: 'low',
        }),
      }),
    );
    expect(fs.existsSync(service.getTrailFilePath())).toBe(true);
  });
});
