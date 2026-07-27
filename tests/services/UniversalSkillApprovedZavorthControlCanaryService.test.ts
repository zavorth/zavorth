import fs from 'fs';
import os from 'os';
import path from 'path';
import { UniversalSkillApprovedZavorthControlCanaryService } from '../../src/services/UniversalSkillApprovedZavorthControlCanaryService.js';

function writeSkill(root: string, input: { dirName: string; name: string; description: string; body-: string }): void {
  const dir = path.join(root, input.dirName);
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), [
    '---',
    `name: ${input.name}`,
    `description: ${input.description}`,
    'license: MIT',
    '---',
    '',
    `# ${input.name}`,
    '',
    input.body || input.description,
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(dir, 'references', 'notes.md'), '# Notes\n', 'utf8');
}

function writeSkills(root: string, count: number): void {
  for (let index = 1; index <= count; index += 1) {
    writeSkill(root, {
      dirName: `skill-${String(index).padStart(2, '0')}`,
      name: `skill-${String(index).padStart(2, '0')}`,
      description: `Useful governed skill number ${index}.`,
      body: 'Read local notes and summarize evidence.',
    });
  }
}

describe('UniversalSkillApprovedZavorthControlCanaryService Intent model0', () => {
  let root: string;
  let source: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approved-zavorthControl-canary-'));
    source = path.join(root, 'skill-source');
    fs.mkdirSync(source, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds the approved zavorthControl endpoint model without mutating visual files', async () => {
    writeSkills(source, 4);

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      now: () => new Date('2026-05-10T22:00:00.000Z'),
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source, presetId: 'generic-skill-folder' }],
      discover: false,
      batchSize: 2,
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.zavorthControlImplementation.endpoint).toBe('/api/skills/scale-hardening');
    expect(snapshot.zavorthControlImplementation.cards.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.zavorthControlImplementation.table.rows).toHaveLength(2);
    expect(snapshot.zavorthControlImplementation.filters.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.zavorthControlImplementation.visualFilesChanged).toBe(false);
    expect(snapshot.zavorthControlImplementation.layoutMutationPerformed).toBe(false);
    expect(snapshot.policy.endpointRequiresManagementAuth).toBe(true);
  });

  it('prepares dry-run canary without executing skills', async () => {
    writeSkills(source, 3);

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      batchSize: 2,
      canaryMode: 'dry-run',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.canary).toEqual(expect.objectContaining({
      status: 'dry-run-ready',
      dryRunPrepared: true,
      liveExecutionPerformed: false,
      upstreamExecutionPerformed: false,
    }));
    expect(snapshot.canary.commands.dryRun).toContain('--canary dry-run');
  });

  it('keeps preview coverage limits visible without downgrading a clean dry-run canary', async () => {
    const cleanBatch = {
      id: 'clean-local-1-of-1',
      sourceLabel: 'Clean local skills',
      sourcePath: path.join(root, 'clean-local'),
      batchIndex: 1,
      totalBatchesForSource: 1,
      candidateStart: 1,
      candidateEnd: 2,
      candidateEstimate: 2,
      recommendedMode: 'preview',
      approvalRequired: true,
    };
    const scale = {
      status: 'attention',
      projectRoot: root,
      channel: 'cli',
      capacity: {
        scaleBand: 'small',
        candidateCount: 3,
        includedSourceCount: 2,
        batchSize: 2,
        batchCount: 1,
        largeLibraryThreshold: 50,
        massiveLibraryThreshold: 500,
      },
      gates: [
        {
          id: 'zavorthControl-controls-onboarding',
          label: 'ZavorthControl controls onboarding',
          status: 'attention',
          severity: 'warning',
          observed: 'preview coverage warning',
          target: 'full preview coverage',
          summary: 'Uma fonte grande excedeu limite de files no preview.',
        },
      ],
      batches: [cleanBatch],
      zavorthControlReview: {
        items: [],
      },
      onboarding: {
        regression: { findings: [] },
        qa: {
          certification: {
            gates: {
              hostileBlocked: true,
            },
          },
          expansion: {
            summary: {
              denied: 0,
              executionPerformed: false,
              directUpstreamRuntimeUse: false,
            },
            sourceResults: [
              {
                sourcePath: cleanBatch.sourcePath,
                blockedCandidateNames: [],
                importSnapshot: {
                  preview: { candidates: [] },
                },
              },
              {
                sourcePath: path.join(root, 'large-local'),
                blockedCandidateNames: ['large-reference-pack'],
                importSnapshot: {
                  preview: {
                    candidates: [
                      {
                        status: 'blocked',
                        blockedReason: 'Limite de 1000 files atingido no preview.',
                        issues: [{ code: 'zip-entry-limit' }],
                        manifest: { name: 'large-reference-pack' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    };

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
      scaleService: {
        buildSnapshot: async () => scale as never,
        formatSnapshotText: () => 'scale fixture',
      },
    }).buildSnapshot({
      projectRoot: root,
      canaryMode: 'dry-run',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.scale.status).toBe('attention');
    expect(snapshot.canary.status).toBe('dry-run-ready');
    expect(snapshot.zavorthControlImplementation.cards).toContainEqual(expect.objectContaining({
      id: 'operational-status',
      value: 'passed',
      tone: 'success',
    }));
    expect(snapshot.zavorthControlImplementation.cards).toContainEqual(expect.objectContaining({
      id: 'scale-status',
      value: 'attention',
      tone: 'warning',
    }));
  });

  it('keeps non-coverage scale attention as operational attention', async () => {
    const batch = {
      id: 'review-local-1-of-1',
      sourceLabel: 'Review local skills',
      sourcePath: path.join(root, 'review-local'),
      batchIndex: 1,
      totalBatchesForSource: 1,
      candidateStart: 1,
      candidateEnd: 1,
      candidateEstimate: 1,
      recommendedMode: 'preview',
      approvalRequired: true,
    };
    const scale = {
      status: 'attention',
      projectRoot: root,
      channel: 'cli',
      capacity: {
        scaleBand: 'small',
        candidateCount: 1,
        includedSourceCount: 1,
        batchSize: 1,
        batchCount: 1,
        largeLibraryThreshold: 50,
        massiveLibraryThreshold: 500,
      },
      gates: [
        {
          id: 'zavorthControl-controls-onboarding',
          label: 'ZavorthControl controls onboarding',
          status: 'attention',
          severity: 'warning',
          observed: 'hostile candidate blocked',
          target: 'coverage-only warnings only',
          summary: 'A candidate required blocking due to content risk.',
        },
      ],
      batches: [batch],
      zavorthControlReview: {
        items: [],
      },
      onboarding: {
        regression: { findings: [] },
        qa: {
          certification: {
            gates: {
              hostileBlocked: true,
            },
          },
          expansion: {
            summary: {
              denied: 0,
              executionPerformed: false,
              directUpstreamRuntimeUse: false,
            },
            sourceResults: [
              {
                sourcePath: batch.sourcePath,
                blockedCandidateNames: ['dangerous-skill'],
                importSnapshot: {
                  preview: {
                    candidates: [
                      {
                        status: 'blocked',
                        blockedReason: 'Script autoexecutavel detectado.',
                        issues: [{ code: 'script-auto-executable' }],
                        manifest: { name: 'dangerous-skill' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    };

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
      scaleService: {
        buildSnapshot: async () => scale as never,
        formatSnapshotText: () => 'scale fixture',
      },
    }).buildSnapshot({
      projectRoot: root,
      canaryMode: 'dry-run',
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.canary.status).toBe('dry-run-ready');
  });

  it('requires approval before live canary preparation', async () => {
    writeSkills(source, 2);

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      canaryMode: 'live',
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.canary.status).toBe('approval-required');
    expect(snapshot.canary.livePrepared).toBe(false);
    expect(snapshot.rollout.readyForLiveCanary).toBe(false);
  });

  it('prepares live canary with approval while still avoiding execution', async () => {
    writeSkills(source, 2);

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      canaryMode: 'live',
      approvalId: 'approval-test-123',
    });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.canary).toEqual(expect.objectContaining({
      status: 'live-prepared',
      approvalId: 'approval-test-123',
      dryRunPrepared: true,
      livePrepared: true,
      liveExecutionPerformed: false,
      upstreamExecutionPerformed: false,
    }));
    expect(snapshot.rollout.readyForLiveCanary).toBe(true);
  });

  it('propagates blocked scale gates into zavorthControl and canary readiness', async () => {
    writeSkills(source, 5);

    const snapshot = await new UniversalSkillApprovedZavorthControlCanaryService({
      projectRoot: root,
    }).buildSnapshot({
      projectRoot: root,
      sources: [{ sourcePath: source }],
      discover: false,
      maxCandidates: 2,
      canaryMode: 'dry-run',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.canary.status).toBe('blocked');
    expect(snapshot.rollout.readyForZavorthControlUse).toBe(false);
  });
});
