import { ZavorthLearningPlaneService } from '../../src/services/ZavorthLearningPlaneService.js';
import type { UniversalAgentRun } from '../../src/runtime/agent/UniversalAgentRuntimeTypes.js';

function createWorkflowRun(overrides: Record<string, any> = {}) {
  const phases = [
    {
      id: 'stage-1',
      label: 'Inspect runtime',
      executor: 'codex',
      role: 'operator',
      strategy_note: null,
      index: 0,
      status: 'completed',
      task_id: 'task-1',
      attempt_count: 1,
      objective: 'Inspecionar',
      handoff_summary: null,
      started_at: '2026-04-09T13:00:00.000Z',
      finished_at: '2026-04-09T13:02:00.000Z',
      result_summary: 'All good.',
      artifact_count: 1,
    },
    {
      id: 'stage-2',
      label: 'Publish release',
      executor: 'codex',
      role: 'operator',
      strategy_note: null,
      index: 1,
      status: 'completed',
      task_id: 'task-2',
      attempt_count: 1,
      objective: 'Publicar',
      handoff_summary: null,
      started_at: '2026-04-09T13:03:00.000Z',
      finished_at: '2026-04-09T13:09:00.000Z',
      result_summary: 'Release criado.',
      artifact_count: 1,
    },
  ];
  return {
    workflow_run_id: 'wf-1',
    workflow_name: 'ship',
    objective: 'Publicar o pacote do gateway.',
    workspace: 'C:/repo/demo',
    origin: {
      origin_task_id: 'task-1',
      source_surface: 'web',
    },
    trigger: {
      kind: 'manual',
    },
    workspace_context: {
      workspace: 'C:/repo/demo',
    },
    created_at: '2026-04-09T13:00:00.000Z',
    updated_at: '2026-04-09T13:10:00.000Z',
    status: 'completed',
    operator_state: 'active',
    operator_closed_at: null,
    operator_close_reason: null,
    operator_closed_by_surface: null,
    stages: phases,
    phases,
    resume_stage: null,
    actionable_stages: [],
    resume_prompt: 'Repita este fluxo para futuros pacotes.',
    artifacts: [
      {
        id: 'artifact-1',
        name: 'release-notes.md',
        kind: 'doc',
        summary: 'Notas da release.',
        path: 'artifacts/release-notes.md',
        createdAt: '2026-04-09T13:09:30.000Z',
      },
    ],
    artifacts_manifest: {},
    externalized_state: null,
    ...overrides,
  };
}

function createNativeAutonomyRun(overrides: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-native-1',
    traceId: 'trace-native-1',
    requestId: 'request-native-1',
    sessionId: 'session-native-1',
    userId: 'grey',
    channel: 'web',
    title: 'Release notes workflow',
    input: 'prefiro bullets e repita esse fluxo com token sk-test-secret',
    workspace: 'C:/repo/demo',
    status: 'completed',
    createdAt: '2026-04-09T13:30:00.000Z',
    updatedAt: '2026-04-09T13:40:00.000Z',
    summary: 'Fluxo concluido com checklist.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Sem ferramentas sensiveis.',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      nativeAutonomySpine: {
        version: 'native-autonomy-spine/v1',
        generatedAt: '2026-04-09T13:40:00.000Z',
        status: 'attention',
        learning: {
          candidates: [
            {
              candidateId: 'learn-pref-1',
              kind: 'preference',
              lane: 'green',
              risk: 'low',
              status: 'auto-applied',
              approvalRequired: false,
              evidenceRefs: ['turn:run-native-1'],
              confidence: 0.79,
              expiry: '2026-07-08T13:40:00.000Z',
              receiptId: 'receipt-pref-1',
              summary: 'Low-risk reversible preference can be learned quietly with receipt.',
            },
            {
              candidateId: 'learn-skill-1',
              kind: 'skill-signal',
              lane: 'yellow',
              risk: 'medium',
              status: 'candidate',
              approvalRequired: true,
              evidenceRefs: ['turn:run-native-1'],
              confidence: 0.74,
              expiry: '2026-05-09T13:40:00.000Z',
              receiptId: 'receipt-skill-1',
              summary: 'Repeated or complex workflow should become a reviewable skill draft.',
            },
          ],
          postTurnReview: {
            redactedObservation: 'user: prefiro bullets com [REDACTED_SECRET]',
          },
        },
        skillForge: {
          drafts: [
            {
              draftId: 'draft-release-notes',
              title: 'Release Notes Workflow',
              status: 'draft',
              materialized: false,
              approvalRequired: true,
              smokeRequired: true,
              rollbackAvailable: true,
              risk: 'medium',
              evidenceRefs: ['turn:run-native-1'],
              preview: {
                manifest: '{"name":"release-notes-workflow"}',
                skillBody: 'secret sk-test-secret must not leak',
                tests: ['static-risk-scan', 'non-destructive-smoke'],
              },
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

describe('ZavorthLearningPlaneService', () => {
  it('derives reviewed candidates from successful workflow history', () => {
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      existsSync: jest.fn(() => false),
    });

    const snapshot = service.buildSnapshot({
      workspace: 'C:/repo/demo',
    });

    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.summary.pending).toBe(1);
    expect(snapshot.candidates).toEqual([
      expect.objectContaining({
        id: 'candidate:wf-1',
        platformEntryId: 'skill:learned:ship:demo:wf-1',
        kind: 'playbook',
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        source: expect.objectContaining({
          workflowRunId: 'wf-1',
          workspace: 'C:/repo/demo',
          objective: 'Publicar o pacote do gateway.',
        }),
      }),
    ]);
  });

  it('keeps approval and promotion explicit through persisted learning state', async () => {
    let storedState: string | null = null;
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      skillPromotionGate: null,
      stateFile: 'C:/tmp/learning-plane.json',
      existsSync: jest.fn(() => storedState !== null),
      readFileSync: jest.fn(() => storedState || ''),
      writeFileSync: jest.fn((_file, data) => {
        storedState = String(data);
      }),
      mkdirSync: jest.fn(),
    });

    const approved = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'approve',
    });
    expect(approved.ok).toBe(true);
    expect(approved.status).toBe('applied');
    expect(approved.snapshot.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'approved',
        lifecycle: 'learned_draft',
      }),
    );

    const promoted = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(promoted.ok).toBe(true);
    expect(promoted.status).toBe('applied');
    expect(promoted.snapshot.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'approved',
        lifecycle: 'trusted_local',
      }),
    );
    expect(storedState).toContain('"trusted_local"');
  });

  it('forgets candidates and separates procedure/skill promotion receipts', async () => {
    let storedState: string | null = null;
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      skillPromotionGate: null,
      stateFile: 'C:/tmp/learning-plane.json',
      existsSync: jest.fn(() => storedState !== null),
      readFileSync: jest.fn(() => storedState || ''),
      writeFileSync: jest.fn((_file, data) => {
        storedState = String(data);
      }),
      mkdirSync: jest.fn(),
    });

    const forgotten = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'forget',
    });
    expect(forgotten.ok).toBe(true);
    expect(forgotten.summary).toContain('foi esquecido');
    expect(forgotten.snapshot.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'rejected',
        lifecycle: 'quarantined',
      }),
    );

    const blocked = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promoteSkill',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.status).toBe('blocked');

    await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'approve',
    });

    const promotedSkill = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promoteSkill',
    });
    // Without a real gate, promoteSkill falls back to lifecycle promote notes.
    expect(promotedSkill.ok).toBe(true);
    expect(promotedSkill.details.join('\n')).toMatch(/SkillPromotionGate unavailable|habilidade|skill/i);

    const promotedProcedure = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promoteProcedure',
    });
    expect(promotedProcedure.ok).toBe(true);
    expect(promotedProcedure.status).toBe('noop');
  });

  it('routes promoteSkill through SkillPromotionGate preview/apply with silentInstallBlocked', async () => {
    let storedState: string | null = null;
    const materializeCandidate = jest.fn(async () => ({
      ok: true,
      summary: 'Skill candidate skill-draft:demo materialized.',
      candidateId: 'skill-draft:demo',
      installed: false,
      status: 'materialized',
      silentInstallBlocked: true,
      mutationPlanId: null,
    }));
    const preview = jest.fn(async () => ({
      ok: true,
      summary: 'Preview ready; waiting approval.',
      candidateId: 'skill-draft:demo',
      installed: false,
      status: 'waiting_approval',
      silentInstallBlocked: true,
      mutationPlanId: 'plan-1',
      details: ['mutation plan pending'],
    }));
    const apply = jest.fn(async () => ({
      ok: true,
      summary: 'Skill installed as trusted_local.',
      installed: true,
      status: 'installed',
      candidateId: 'skill-draft:demo',
      silentInstallBlocked: true,
      details: ['installed with approvalId'],
    }));
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      skillPromotionGate: { materializeCandidate, preview, apply },
      stateFile: 'C:/tmp/learning-plane.json',
      existsSync: jest.fn(() => storedState !== null),
      readFileSync: jest.fn(() => storedState || ''),
      writeFileSync: jest.fn((_file, data) => {
        storedState = String(data);
      }),
      mkdirSync: jest.fn(),
    });

    await service.executeAction({ candidateId: 'candidate:wf-1', actionId: 'approve' });

    const blockedInstall = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promoteSkill',
    });
    expect(blockedInstall.ok).toBe(false);
    expect(blockedInstall.status).toBe('blocked');
    expect(blockedInstall.silentInstallBlocked).toBe(true);
    expect(blockedInstall.skillCandidateId).toBe('skill-draft:demo');
    expect(blockedInstall.skillInstalled).toBe(false);
    expect(materializeCandidate).toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith('skill-draft:demo', expect.any(Object));
    expect(apply).not.toHaveBeenCalled();
    expect(blockedInstall.snapshot.candidates[0].lifecycle).toBe('learned_draft');

    const installed = await service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promoteSkill',
      approvalId: 'approval-skill-1',
    });
    expect(installed.ok).toBe(true);
    expect(installed.status).toBe('applied');
    expect(installed.skillInstalled).toBe(true);
    expect(installed.silentInstallBlocked).toBe(true);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      candidateId: 'skill-draft:demo',
      approvalId: 'approval-skill-1',
    }));
    expect(installed.snapshot.candidates[0].lifecycle).toBe('trusted_local');
  });

  it('emits stable learning quality metrics from candidate history', () => {
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [
          createWorkflowRun(),
          createWorkflowRun({
            workflow_run_id: 'wf-2',
            workflow_name: 'release',
            updated_at: '2026-04-09T13:20:00.000Z',
            origin: {
              origin_task_id: 'task-2',
              source_surface: 'cli',
            },
          }),
        ]),
      } as any,
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-09T14:00:00.000Z',
        entries: {
          'candidate:wf-1': {
            reviewState: 'approved',
            lifecycle: 'trusted_local',
            updatedAt: '2026-04-09T13:50:00.000Z',
          },
          'candidate:wf-2': {
            reviewState: 'rejected',
            lifecycle: 'quarantined',
            updatedAt: '2026-04-09T13:55:00.000Z',
          },
        },
      })),
    });

    const metrics = service.readMetrics({
      workspace: 'C:/repo/demo',
    });

    expect(metrics.summary).toEqual(
      expect.objectContaining({
        totalCandidates: 2,
        acceptedRate: 0.5,
        rejectedRate: 0.5,
        promotedRate: 0.5,
      }),
    );
  });

  it('projects native autonomy spine turn learning into the reviewable learning plane without raw secrets', () => {
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => []),
      } as any,
      nativeRunStore: {
        loadRuns: jest.fn(() => [createNativeAutonomyRun()]),
      },
      existsSync: jest.fn(() => false),
    });

    const snapshot = service.buildSnapshot({
      workspace: 'C:/repo/demo',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.summary.total).toBe(3);
    expect(snapshot.summary.pending).toBe(2);
    expect(snapshot.summary.promoted).toBe(1);
    expect(snapshot.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'candidate:native:run-native-1:learn-pref-1',
        platformEntryId: 'skill:learned:native-turn:demo:learn-pref-1',
        kind: 'recipe',
        reviewState: 'approved',
        lifecycle: 'trusted_local',
        source: expect.objectContaining({
          workflowRunId: 'run-native-1',
          workflow: 'native-autonomy-spine',
          sourceSurface: 'web',
        }),
      }),
      expect.objectContaining({
        id: 'candidate:native:run-native-1:learn-skill-1',
        kind: 'skill',
        reviewState: 'pending',
        lifecycle: 'learned_draft',
      }),
      expect.objectContaining({
        id: 'candidate:native-skill:run-native-1:draft-release-notes',
        title: 'Release Notes Workflow',
        kind: 'skill',
        reviewState: 'pending',
        lifecycle: 'learned_draft',
      }),
    ]));
    expect(serialized).toContain('[REDACTED_SECRET]');
    expect(serialized).not.toContain('sk-test-secret');
  });
});
