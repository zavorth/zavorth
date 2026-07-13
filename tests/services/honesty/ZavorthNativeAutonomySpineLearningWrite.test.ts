import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthNativeAutonomySpineService } from '../../../src/services/ZavorthNativeAutonomySpineService.js';
import { ZavorthAutonomousLearningWriteService } from '../../../src/services/ZavorthAutonomousLearningWriteService.js';

describe('ZavorthNativeAutonomySpineService learning write', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-spine-write-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('applies durable writes when autonomous policy is injected', async () => {
    const write = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      policy: {
        contractVersion: 'zavorth-learning-runtime-policy/1',
        mode: 'autonomous',
        source: 'explicit',
        securityProfileId: 'personal',
        autoWriteGreenPreferences: true,
        autoMaterializeYellowSkillDrafts: true,
        autoInstallSkills: false,
        canModifySecurityPolicy: false,
        userConsentRequired: false,
        summary: 'autonomous',
      },
    });
    const spine = new ZavorthNativeAutonomySpineService({
      projectRoot: tempDir,
      learningWrite: write,
    });

    const snapshot = await spine.buildSnapshot({
      turn: {
        turnId: 'turn-spine-1',
        outcome: 'success',
        userMessage: 'I prefer short bullet summaries when I ask for release notes workflow next time.',
        assistantResponse: 'Understood. I will use bullets for release notes.',
        toolReceipts: [
          { id: 't1', kind: 'tool', status: 'done', summary: 'read files' },
          { id: 't2', kind: 'tool', status: 'done', summary: 'write notes' },
          { id: 't3', kind: 'tool', status: 'done', summary: 'patch' },
          { id: 't4', kind: 'tool', status: 'done', summary: 'test' },
          { id: 't5', kind: 'tool', status: 'done', summary: 'commit' },
        ],
        toolCallCount: 5,
        sourceSurface: 'cli',
      },
    });

    expect(snapshot.learningWrite?.mode).toBe('autonomous');
    expect(snapshot.summary.learningWriteApplied).toBe(true);
    expect((snapshot.learningWrite?.appliedPreferences || 0) + (snapshot.learningWrite?.draftedSkills || 0)).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(tempDir, 'data', 'runtime', 'learning'))).toBe(true);
  });

  it('does not write when governed', async () => {
    const write = new ZavorthAutonomousLearningWriteService({
      projectRoot: tempDir,
      policy: {
        contractVersion: 'zavorth-learning-runtime-policy/1',
        mode: 'governed',
        source: 'explicit',
        securityProfileId: 'enterprise',
        autoWriteGreenPreferences: false,
        autoMaterializeYellowSkillDrafts: false,
        autoInstallSkills: false,
        canModifySecurityPolicy: false,
        userConsentRequired: true,
        summary: 'governed',
      },
    });
    const spine = new ZavorthNativeAutonomySpineService({
      projectRoot: tempDir,
      learningWrite: write,
    });

    const snapshot = await spine.buildSnapshot({
      turn: {
        turnId: 'turn-spine-2',
        outcome: 'success',
        userMessage: 'I prefer short bullet summaries.',
        assistantResponse: 'Ok.',
        toolReceipts: [],
        toolCallCount: 0,
        sourceSurface: 'cli',
      },
    });

    expect(snapshot.learningWrite?.mode).toBe('governed');
    expect(snapshot.learningWrite?.appliedPreferences).toBe(0);
    expect(snapshot.summary.learningWriteApplied).toBe(false);
  });
});
