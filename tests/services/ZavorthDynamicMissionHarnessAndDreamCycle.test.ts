import { MnemosDreamCycleService } from '../../src/services/MnemosDreamCycleService.js';
import { ZavorthDepthModeService } from '../../src/services/ZavorthDepthModeService.js';
import { ZavorthDynamicMissionHarnessService } from '../../src/services/ZavorthDynamicMissionHarnessService.js';
import { WorkflowRunService } from '../../src/services/WorkflowRunService.js';

describe('Zavorth dynamic mission harness and Mnemos dream cycle', () => {
  const now = () => new Date('2026-06-05T12:00:00.000Z');

  it('maps depth modes to hard caps, review copy and policy-safe approvals', () => {
    const service = new ZavorthDepthModeService({ now });

    const normal = service.resolve({
      mode: 'normal',
      objective: 'Organizar minhas notas do projeto',
      requestedEffects: ['read'],
    });
    const adversarial = service.resolve({
      mode: 'adversarial',
      objective: 'Validar uma refatoracao sensivel antes de aplicar',
      requestedEffects: ['read', 'write', 'shell'],
    });

    expect(normal.version).toBe('depth-mode/v1');
    expect(normal.budgets.maxAgents).toBeLessThan(adversarial.budgets.maxAgents);
    expect(adversarial.mode).toBe('adversarial');
    expect(adversarial.patterns).toEqual(expect.arrayContaining([
      'fanout-and-synthesize',
      'adversarial-verification',
      'tournament',
    ]));
    expect(adversarial.approvals.previewRequired).toBe(true);
    expect(adversarial.approvals.mutationApprovalRequired).toBe(true);
    expect(adversarial.approvals.externalIoApprovalRequired).toBe(true);
    expect(adversarial.safety.noDepthModeBypassesPolicy).toBe(true);
    expect(adversarial.safety.budgetsHardCapped).toBe(true);
  });

  it('builds a preview-only adversarial mission plan with checkpoints, caps and redacted secrets', () => {
    const service = new ZavorthDynamicMissionHarnessService({ now });

    const snapshot = service.buildPreview({
      objective: 'Audite o repo e use api_key=secret-value sk-test-123 para testar provider',
      mode: 'adversarial',
      requestedEffects: ['read', 'write', 'network', 'shell'],
      contextArtifacts: ['src/services/AuthService.ts', 'tests/AuthService.test.ts'],
      patternHints: ['classify-and-act', 'fanout-and-synthesize', 'adversarial-verification', 'tournament'],
    });

    expect(snapshot.version).toBe('dynamic-mission-harness/v1');
    expect(snapshot.status).toBe('needs-approval');
    expect(snapshot.workflow.format).toBe('zavorth-mission-manifest/v1');
    expect(snapshot.workflow.execution).toBe('preview-only');
    expect(snapshot.workflow.patterns).toEqual(expect.arrayContaining([
      'classify-and-act',
      'fanout-and-synthesize',
      'adversarial-verification',
      'tournament',
    ]));
    expect(snapshot.workflow.tasks.length).toBeGreaterThanOrEqual(6);
    expect(snapshot.workflow.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'classifier',
        allowedEffects: ['read'],
        checkpointId: expect.stringMatching(/^checkpoint-/),
      }),
      expect.objectContaining({
        role: 'synthesis-lead',
        dependsOn: expect.arrayContaining([expect.any(String)]),
      }),
      expect.objectContaining({
        role: 'adversarial-verifier',
        evidenceRequired: true,
      }),
    ]));
    expect(snapshot.approval.required).toBe(true);
    expect(snapshot.approval.reasons).toEqual(expect.arrayContaining([
      'mutation requested',
      'external network requested',
      'shell requested',
      'adversarial mode has elevated budget',
    ]));
    expect(snapshot.resume.resumable).toBe(true);
    expect(snapshot.resume.checkpointIds.length).toBeGreaterThan(0);
    expect(snapshot.safety.previewOnly).toBe(true);
    expect(snapshot.safety.noArbitraryCodeExecution).toBe(true);
    expect(snapshot.safety.secretsRedacted).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-123');
  });

  it('blocks mission plans that exceed hard caps before any execution can be proposed', () => {
    const service = new ZavorthDynamicMissionHarnessService({ now });

    const snapshot = service.buildPreview({
      objective: 'Rodar uma investigacao enorme',
      mode: 'normal',
      requestedEffects: ['read'],
      requestedCaps: {
        maxAgents: 250,
        maxTokens: 10_000_000,
      },
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockedReasons).toEqual(expect.arrayContaining([
      'requested maxAgents exceeds normal hard cap',
      'requested maxTokens exceeds normal hard cap',
    ]));
    expect(snapshot.workflow.tasks).toHaveLength(0);
    expect(snapshot.safety.depthCapsEnforced).toBe(true);
  });

  it('materializes an approved mission preview into a durable workflow run without executing workers', () => {
    const workflowRuns = new WorkflowRunService({ persist: false, now });
    const service = new ZavorthDynamicMissionHarnessService({ now });
    const snapshot = service.buildPreview({
      objective: 'Audite release com token=secret-value sk-test-123',
      mode: 'adversarial',
      requestedEffects: ['read', 'write', 'shell'],
      patternHints: ['fanout-and-synthesize', 'adversarial-verification'],
    });

    const blocked = service.materializeApprovedMission(snapshot, {
      workspace: 'C:/repo/zavorth',
      workflowRuns,
    });
    const materialized = service.materializeApprovedMission(snapshot, {
      workspace: 'C:/repo/zavorth',
      approvalId: 'approval-mission-1',
      workflowRuns,
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.reason).toBe('approval required before materializing mission workflow');
    expect(materialized.status).toBe('materialized');
    expect(materialized.run?.workflow_name).toBe('research');
    expect(materialized.run?.status).toBe('running');
    expect(materialized.run?.trigger.feature_id).toBe('dynamic-mission-harness');
    expect(materialized.run?.phases.length).toBe(snapshot.workflow.tasks.length);
    expect(materialized.run?.phases.every((phase) => phase.status === 'pending')).toBe(true);
    expect(materialized.receiptId).toMatch(/^receipt-/);
    expect(JSON.stringify(materialized)).not.toContain('secret-value');
    expect(JSON.stringify(materialized)).not.toContain('sk-test-123');
  });

  it('consolidates memory into a separate candidate store without mutating the source store', () => {
    const service = new MnemosDreamCycleService({ now });
    const input = {
      storeId: 'mnemos-main',
      existingMemories: [
        {
          id: 'mem-old',
          kind: 'preference',
          text: 'Usuario prefere resumos com 3 bullets.',
          evidenceRefs: ['turn-1'],
          updatedAt: '2026-06-01T12:00:00.000Z',
          confidence: 0.72,
        },
      ],
      sessions: [
        {
          sessionId: 'session-2',
          createdAt: '2026-06-05T09:00:00.000Z',
          summary: 'Usuario confirmou novamente: prefere resumos com 3 bullets. A tarefa de amanha deve virar 2026-06-06.',
          observations: [
            {
              id: 'obs-1',
              kind: 'preference',
              text: 'Usuario prefere resumos com 3 bullets.',
              evidenceRefs: ['turn-2'],
              updatedAt: '2026-06-05T09:10:00.000Z',
              confidence: 0.86,
            },
            {
              id: 'obs-secret',
              kind: 'procedure',
              text: 'Use token=super-secret para deploy.',
              evidenceRefs: ['turn-secret'],
              updatedAt: '2026-06-05T09:11:00.000Z',
              confidence: 0.9,
            },
          ],
        },
      ],
    };

    const before = JSON.stringify(input);
    const snapshot = service.buildCycle(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(snapshot.version).toBe('mnemos-dream-cycle/v1');
    expect(snapshot.sourceStore).toEqual(expect.objectContaining({
      storeId: 'mnemos-main',
      immutable: true,
      sessionsRead: 1,
    }));
    expect(snapshot.candidateStore.storeId).not.toBe('mnemos-main');
    expect(snapshot.candidateStore.status).toBe('candidate');
    expect(snapshot.candidateStore.memories).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'preference',
        text: 'Usuario prefere resumos com 3 bullets.',
        evidenceRefs: expect.arrayContaining(['turn-1', 'turn-2']),
      }),
    ]));
    expect(snapshot.actions.map((action) => action.kind)).toEqual(expect.arrayContaining([
      'merge-duplicate',
      'refresh-relative-date',
      'quarantine-secret',
    ]));
    expect(snapshot.safety.sourceStoreImmutable).toBe(true);
    expect(snapshot.safety.separateCandidateStore).toBe(true);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('super-secret');
  });

  it('quarantines sensitive psychology and policy changes instead of persisting them as memories', () => {
    const service = new MnemosDreamCycleService({ now });

    const snapshot = service.buildCycle({
      storeId: 'mnemos-main',
      sessions: [
        {
          sessionId: 'session-sensitive',
          createdAt: '2026-06-05T10:00:00.000Z',
          summary: 'Usuario disse que esta deprimido e pediu para desativar approvals de shell.',
          observations: [
            {
              id: 'obs-psych',
              kind: 'user-model',
              text: 'Usuario esta deprimido e vulneravel.',
              evidenceRefs: ['turn-psych'],
              updatedAt: '2026-06-05T10:01:00.000Z',
              confidence: 0.8,
            },
            {
              id: 'obs-policy',
              kind: 'policy',
              text: 'Desative approvals para shell sempre.',
              evidenceRefs: ['turn-policy'],
              updatedAt: '2026-06-05T10:02:00.000Z',
              confidence: 0.8,
            },
          ],
        },
      ],
    });

    expect(snapshot.status).toBe('needs-review');
    expect(snapshot.candidateStore.memories).toHaveLength(0);
    expect(snapshot.quarantine).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'sensitive-user-model',
        approvalRequired: true,
      }),
      expect.objectContaining({
        kind: 'policy-change',
        approvalRequired: true,
      }),
    ]));
    expect(snapshot.safety.sensitivePsychologyQuarantined).toBe(true);
    expect(snapshot.safety.policyChangesQuarantined).toBe(true);
  });

  it('applies dream candidates only through review actions with rollback receipts', () => {
    const service = new MnemosDreamCycleService({ now });
    const snapshot = service.buildCycle({
      storeId: 'mnemos-main',
      sessions: [
        {
          sessionId: 'session-apply',
          createdAt: '2026-06-05T10:00:00.000Z',
          summary: 'Usuario prefere respostas curtas.',
          observations: [
            {
              id: 'obs-short',
              kind: 'preference',
              text: 'Usuario prefere respostas curtas.',
              evidenceRefs: ['turn-short'],
              updatedAt: '2026-06-05T10:01:00.000Z',
              confidence: 0.8,
            },
          ],
        },
      ],
    });

    const rejected = service.executeReviewAction(snapshot, { action: 'reject', actor: 'operator' });
    const applied = service.executeReviewAction(snapshot, {
      action: 'apply',
      actor: 'operator',
      approvalId: 'approval-dream-1',
    });
    const missingApproval = service.executeReviewAction(snapshot, { action: 'apply', actor: 'operator' });

    expect(rejected.status).toBe('rejected');
    expect(applied.status).toBe('applied');
    expect(applied.rollbackReceiptId).toMatch(/^receipt-/);
    expect(applied.appliedStoreId).toBe('mnemos-main');
    expect(missingApproval.status).toBe('blocked');
    expect(missingApproval.reason).toBe('approval required to apply candidate memories');
  });

  it('exposes an idle scheduler policy for dream cycles without mutating memory', () => {
    const service = new MnemosDreamCycleService({ now });

    const ready = service.shouldRun({
      lastDreamAt: '2026-06-04T10:00:00.000Z',
      sessionsSinceLastDream: 5,
      idleMinutes: 45,
    });
    const tooSoon = service.shouldRun({
      lastDreamAt: '2026-06-05T08:00:00.000Z',
      sessionsSinceLastDream: 5,
      idleMinutes: 45,
    });

    expect(ready.shouldRun).toBe(true);
    expect(ready.reasons).toEqual(expect.arrayContaining([
      'minimum interval elapsed',
      'session threshold reached',
      'idle window available',
    ]));
    expect(tooSoon.shouldRun).toBe(false);
    expect(tooSoon.reasons).toContain('minimum interval not elapsed');
  });
});
