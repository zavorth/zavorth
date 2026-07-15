import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SelfModificationCommandService } from '../../src/services/SelfModificationCommandService.js';
import { SelfModificationPathPolicyService } from '../../src/services/selfmod-command/SelfModificationPathPolicyService.js';

describe('SelfModification multi-file', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-selfmod-multi-'));
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'skills', 'pack-a'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tmp', 'selfmod-previews'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tmp', 'selfmod-goal-previews'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tmp', 'selfmod-shadow-workspaces'), { recursive: true });
    fs.mkdirSync(path.join(root, 'data', 'runtime', 'selfmod-history'), { recursive: true });
    fs.copyFileSync(
      path.join(process.cwd(), 'config', 'selfmod-path-policy.json'),
      path.join(root, 'config', 'selfmod-path-policy.json'),
    );
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp' }), 'utf8');
    fs.writeFileSync(path.join(root, 'skills', 'pack-a', 'SKILL.md'), '---\nname: pack-a\n---\n# Pack A\n', 'utf8');
    fs.writeFileSync(
      path.join(root, 'skills', 'pack-a', 'manifest.json'),
      JSON.stringify({ name: 'pack-a', version: '0.1.0' }),
      'utf8',
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function createService() {
    return new SelfModificationCommandService({
      projectRoot: root,
      previewDir: path.join(root, 'tmp', 'selfmod-previews'),
      goalPreviewDir: path.join(root, 'tmp', 'selfmod-goal-previews'),
      historyDir: path.join(root, 'data', 'runtime', 'selfmod-history'),
      shadowWorkspaceDir: path.join(root, 'tmp', 'selfmod-shadow-workspaces'),
      pathPolicy: new SelfModificationPathPolicyService({ projectRoot: root }),
      safeModificationService: {
        validateCandidate: () => ({ passes: true, output: 'ok' }),
        safeApply: async (absolutePath: string, content: string) => {
          fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
          fs.writeFileSync(absolutePath, content, 'utf8');
          return { success: true, reason: 'applied' };
        },
      } as any,
      engine: {
        previewModification: async () => ({ success: false, reason: 'unused' }),
      } as any,
      selfmodPatternMemory: {
        rememberPreview: () => undefined,
        rememberApply: () => undefined,
        rememberRollback: () => undefined,
      } as any,
      selfmodImpactAnalyzer: {
        analyzeGoalPreview: () => null,
      } as any,
    });
  }

  it('creates multi-file preview under one preview_id with rollback plan', async () => {
    const svc = createService();
    const preview = await svc.createMultiFilePreview({
      requestedBy: 'tester',
      summary: 'Add skill pack notes',
      files: [
        {
          relativePath: 'skills/pack-a/SKILL.md',
          content: '---\nname: pack-a\n---\n# Pack A\n\nUpdated procedure.\n',
          instruction: 'update skill body',
        },
        {
          relativePath: 'skills/pack-a/manifest.json',
          content: JSON.stringify({ name: 'pack-a', version: '0.2.0', description: 'updated' }, null, 2),
          instruction: 'bump version',
        },
      ],
    });

    expect(preview.success).toBe(true);
    expect(preview.mode).toBe('multi');
    expect(preview.previewId).toBeTruthy();
    expect(preview.changeCount).toBe(2);
    expect(preview.relativePaths).toEqual(
      expect.arrayContaining(['skills/pack-a/SKILL.md', 'skills/pack-a/manifest.json']),
    );
    expect(preview.rollbackPlan?.length).toBe(2);
  });

  it('applies multi-file changeset and leaves receipt + promote hint', async () => {
    const svc = createService();
    const preview = await svc.createMultiFilePreview({
      requestedBy: 'tester',
      files: [
        {
          relativePath: 'skills/pack-a/SKILL.md',
          content: '---\nname: pack-a\n---\n# Pack A\n\nApplied body.\n',
        },
        {
          relativePath: 'skills/pack-a/README.md',
          content: '# Pack A\n\nNew file from multi selfmod.\n',
        },
      ],
    });
    expect(preview.success).toBe(true);

    const applied = await svc.applyPreview(String(preview.previewId), 'tester');
    expect(applied.success).toBe(true);
    expect(applied.mode).toBe('multi');
    expect(applied.changeCount).toBe(2);
    expect(applied.changeId).toBeTruthy();
    expect(applied.receiptPath && fs.existsSync(applied.receiptPath)).toBe(true);
    expect(applied.promoteHint || '').toMatch(/promote|learn promote/i);

    expect(fs.readFileSync(path.join(root, 'skills', 'pack-a', 'SKILL.md'), 'utf8')).toMatch(/Applied body/);
    expect(fs.existsSync(path.join(root, 'skills', 'pack-a', 'README.md'))).toBe(true);

    const rolled = await svc.rollbackChangeSet(String(applied.changeId), 'tester');
    expect(rolled.success).toBe(true);
    expect(rolled.restoredFiles).toBe(2);
    expect(fs.readFileSync(path.join(root, 'skills', 'pack-a', 'SKILL.md'), 'utf8')).not.toMatch(/Applied body/);
    expect(fs.existsSync(path.join(root, 'skills', 'pack-a', 'README.md'))).toBe(false);
  });

  it('blocks paths outside policy', async () => {
    const svc = createService();
    const preview = await svc.createMultiFilePreview({
      requestedBy: 'tester',
      files: [
        {
          relativePath: 'node_modules/evil/index.js',
          content: 'module.exports = {}',
        },
      ],
    });
    expect(preview.success).toBe(false);
    expect(preview.summary).toMatch(/block|policy|Path/i);
  });

  it('blocks apply when validationCommands fail', async () => {
    const svc = createService();
    const preview = await svc.createMultiFilePreview({
      requestedBy: 'tester',
      validationCommands: ['node -e process.exit(1)'],
      requireValidationCommandsOnApply: true,
      files: [
        {
          relativePath: 'skills/pack-a/SKILL.md',
          content: '---\nname: pack-a\n---\n# fail gate\n',
        },
      ],
    });
    expect(preview.success).toBe(true);
    const applied = await svc.applyPreview(String(preview.previewId), 'tester');
    expect(applied.success).toBe(false);
    expect(applied.summary).toMatch(/validation gate/i);
    // file unchanged
    expect(fs.readFileSync(path.join(root, 'skills', 'pack-a', 'SKILL.md'), 'utf8')).not.toMatch(/fail gate/);
  });
});
