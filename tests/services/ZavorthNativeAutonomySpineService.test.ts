import { ZavorthChannelLiveCertificationService } from '../../src/services/ZavorthChannelLiveCertificationService.js';
import { ZavorthExecutionBackendProviderService } from '../../src/services/ZavorthExecutionBackendProviderService.js';
import { ZavorthExperienceLearningDaemonService } from '../../src/services/ZavorthExperienceLearningDaemonService.js';
import { ZavorthNativeAutonomySpineService } from '../../src/services/ZavorthNativeAutonomySpineService.js';
import { ZavorthSkillForgeRuntimeService } from '../../src/services/ZavorthSkillForgeRuntimeService.js';

describe('Zavorth native autonomy spine', () => {
  const now = () => new Date('2026-06-05T12:00:00.000Z');

  it('turns a successful turn into governed learning candidates without leaking secrets', async () => {
    const service = new ZavorthExperienceLearningDaemonService({ now });

    const snapshot = await service.reviewTurn({
      turnId: 'turn-1',
      sessionId: 'session-1',
      userId: 'user-1',
      outcome: 'success',
      userMessage: 'Quando eu pedir resumo, use 3 bullets. token=secret-token sk-test-123',
      assistantResponse: 'Combinado, vou usar 3 bullets nos resumos.',
      toolReceipts: [{ id: 'receipt-1', kind: 'message', status: 'done', summary: 'Answered safely.' }],
      toolCallCount: 1,
      sourceSurface: 'chat',
    });

    expect(snapshot.version).toBe('experience-learning-daemon/v1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.preTurnRecall.ranBeforeTurn).toBe(false);
    expect(snapshot.postTurnReview.ranAfterSuccessfulTurn).toBe(true);
    expect(snapshot.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'preference',
        lane: 'green',
        status: 'auto-applied',
        approvalRequired: false,
      }),
    ]));
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(snapshot.safety.redactionBeforeClassification).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-token');
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-123');
  });

  it('keeps sensitive user-model and policy changes out of green lane', async () => {
    const service = new ZavorthExperienceLearningDaemonService({ now });

    const snapshot = await service.reviewTurn({
      turnId: 'turn-2',
      outcome: 'success',
      userMessage: 'Estou deprimido e quero que desative approvals para shell sempre.',
      assistantResponse: 'Nao vou desativar protecoes.',
      toolReceipts: [],
      toolCallCount: 0,
    });

    expect(snapshot.status).toBe('needs-review');
    expect(snapshot.candidates.map((candidate) => candidate.lane)).not.toContain('green');
    expect(snapshot.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'sensitive-user-model',
        lane: 'red',
        approvalRequired: true,
        status: 'blocked',
      }),
      expect.objectContaining({
        kind: 'policy-change',
        lane: 'red',
        approvalRequired: true,
        status: 'blocked',
      }),
    ]));
  });

  it('creates skill drafts from repeated successful work without materializing executable behavior', async () => {
    const service = new ZavorthSkillForgeRuntimeService({ now });

    const snapshot = service.reviewSkillOpportunity({
      turnId: 'turn-3',
      outcome: 'success',
      toolCallCount: 7,
      userMessage: 'Da proxima vez que eu pedir release notes, siga este fluxo.',
      assistantResponse: 'Fluxo executado com tests, changelog e resumo.',
      observedFiles: ['CHANGELOG.md'],
      requestedCapabilities: ['write_file', 'shell'],
    });

    expect(snapshot.version).toBe('skill-forge-runtime/v1');
    expect(snapshot.status).toBe('needs-approval');
    expect(snapshot.drafts).toHaveLength(1);
    expect(snapshot.drafts[0]).toEqual(expect.objectContaining({
      status: 'draft',
      materialized: false,
      approvalRequired: true,
      smokeRequired: true,
      rollbackAvailable: true,
    }));
    expect(snapshot.safety.noDirectSkillFileWrites).toBe(true);
    expect(snapshot.safety.executableSupportFilesHeldForApproval).toBe(true);
  });

  it('certifies a channel as default route only after live stop, inbound, outbound, approval and receipt proofs', async () => {
    const service = new ZavorthChannelLiveCertificationService({ now });

    const snapshot = service.certify({
      channelId: 'slack',
      configured: true,
      proofResults: {
        handshake: true,
        inboundEcho: true,
        outboundEcho: true,
        progressSignal: true,
        stopCommand: true,
        approvalCard: true,
        fileSend: true,
        receiptRecorded: true,
      },
    });

    expect(snapshot.version).toBe('channel-live-certification/v1');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.readiness.liveReady).toBe(true);
    expect(snapshot.readiness.defaultRouteAllowed).toBe(true);
    expect(snapshot.proofs.every((proof) => proof.status === 'passed')).toBe(true);

    const blocked = service.certify({
      channelId: 'whatsapp',
      configured: true,
      proofResults: {
        handshake: true,
        inboundEcho: true,
        outboundEcho: true,
        progressSignal: true,
        stopCommand: false,
        approvalCard: true,
        fileSend: true,
        receiptRecorded: true,
      },
    });

    expect(blocked.status).toBe('attention');
    expect(blocked.readiness.liveReady).toBe(false);
    expect(blocked.readiness.defaultRouteAllowed).toBe(false);
    expect(blocked.blockedReasons).toContain('stop command proof is required before live routing');
  });

  it('assimilates channel mesh readiness without treating catalog or outbox as live proof', () => {
    const service = new ZavorthChannelLiveCertificationService({ now });
    const baseEntry = {
      id: 'slack',
      label: 'Slack',
      readiness: 'ready',
      implementationState: 'full',
      configured: true,
      transport: 'native',
      notes: [],
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: true,
        approvals: true,
        interactiveControls: true,
        slashCommands: true,
        richReplies: true,
      },
      source: 'runtime',
      summary: 'Slack live.',
      operatorSummary: 'bridge ready.',
      actionHint: 'ready',
      tags: [],
      actions: [],
      liveReady: true,
      defaultRouteAllowed: true,
      readinessProof: 'live_event',
      defaultBlockReason: null,
      lastEventAt: '2026-06-05T12:00:00.000Z',
      connection: {
        running: true,
        linked: true,
        connected: true,
        mode: 'bot',
        provider: 'slack',
        lastStartAt: '2026-06-05T11:50:00.000Z',
        lastConnectedAt: '2026-06-05T11:51:00.000Z',
        lastInboundAt: '2026-06-05T11:52:00.000Z',
        lastOutboundAt: '2026-06-05T11:53:00.000Z',
        lastError: null,
        authAgeMs: 1000,
      },
      interactiveSurface: {
        statusCard: true,
        inlineButtons: true,
        slashCommands: true,
        richReplies: true,
        modelMenus: true,
        qrLogin: false,
      },
    } as any;

    const certified = service.certifyFromChannelMesh({
      channelId: 'slack',
      snapshot: {
        generatedAt: now().toISOString(),
        summary: {} as any,
        entries: [baseEntry],
        selected: null,
        featuredIds: [],
        liveCompletion: {} as any,
        narrative: {} as any,
      },
    });

    expect(certified.status).toBe('certified');
    expect(certified.readiness.defaultRouteAllowed).toBe(true);
    expect(certified.proofs.every((proof) => proof.status === 'passed')).toBe(true);

    const catalogOnly = service.certifyFromChannelMesh({
      channelId: 'slack',
      snapshot: {
        generatedAt: now().toISOString(),
        summary: {} as any,
        entries: [{
          ...baseEntry,
          liveReady: false,
          defaultRouteAllowed: false,
          readinessProof: 'catalog',
          connection: null,
          lastEventAt: null,
        }],
        selected: null,
        featuredIds: [],
        liveCompletion: {} as any,
        narrative: {} as any,
      },
    });

    expect(catalogOnly.status).toBe('attention');
    expect(catalogOnly.readiness.liveReady).toBe(false);
    expect(catalogOnly.readiness.defaultRouteAllowed).toBe(false);
  });

  it('requires backend proof before live mutation and keeps unproven backends in dry-run', () => {
    const service = new ZavorthExecutionBackendProviderService({ now });

    const proven = service.certify({
      backendId: 'modal',
      configured: true,
      command: 'npm test',
      mutationRequested: true,
      approvalId: 'approval-1',
      proofResults: {
        doctor: true,
        prepareWorkspace: true,
        run: true,
        stream: true,
        upload: true,
        download: true,
        snapshot: true,
        hibernate: true,
        resume: true,
        cleanup: true,
        costEstimate: true,
      },
    });

    expect(proven.version).toBe('execution-backend-provider/v1');
    expect(proven.status).toBe('certified');
    expect(proven.readiness.liveReady).toBe(true);
    expect(proven.executionPlan.mode).toBe('live');
    expect(proven.executionPlan.willMutate).toBe(true);

    const unproven = service.certify({
      backendId: 'daytona',
      configured: true,
      command: 'rm -rf dist',
      mutationRequested: true,
      proofResults: {
        doctor: true,
        prepareWorkspace: false,
        run: true,
        stream: true,
        upload: false,
        download: true,
        snapshot: false,
        hibernate: true,
        resume: true,
        cleanup: true,
        costEstimate: true,
      },
    });

    expect(unproven.status).toBe('attention');
    expect(unproven.readiness.liveReady).toBe(false);
    expect(unproven.executionPlan.mode).toBe('dry-run');
    expect(unproven.executionPlan.willMutate).toBe(false);
    expect(unproven.approval.required).toBe(true);
  });

  it('assimilates terminal backend snapshots while keeping unproven live execution dry-run only', () => {
    const service = new ZavorthExecutionBackendProviderService({ now });
    const terminalSnapshot = {
      selectedBackend: 'docker',
      status: 'preview',
      command: {
        raw: 'npm test -- --token sk-test-secret',
        redacted: 'npm test -- --token [REDACTED_SECRET]',
        risk: 'workspace-mutation',
        approvalRequired: true,
        timeoutMs: 30000,
        workspace: 'C:/repo/demo',
      },
      plan: {
        mode: 'preview',
        executable: 'docker',
        args: [],
        displayCommand: 'docker run <redacted>',
        backendConfigured: true,
        willExecute: false,
        reason: 'preview',
      },
      execution: {
        attempted: false,
        performed: false,
        exitCode: null,
        stdoutPreview: null,
        stderrPreview: null,
        error: null,
      },
      backends: [
        {
          id: 'docker',
          label: 'Docker container',
          status: 'ready',
          isolation: 'container',
          liveCapable: true,
          liveReady: true,
          requiresConfiguration: [],
          defaultCommand: 'docker run',
          nextCommand: 'zavorth execution-backends --backend docker',
          limitations: [],
        },
      ],
    } as any;

    const dryRun = service.certifyFromTerminalBackendSnapshot({
      snapshot: terminalSnapshot,
      mutationRequested: true,
    });

    expect(dryRun.status).toBe('attention');
    expect(dryRun.executionPlan.mode).toBe('dry-run');
    expect(dryRun.readiness.liveMutationAllowed).toBe(false);
    expect(JSON.stringify(dryRun)).not.toContain('sk-test-secret');

    const certified = service.certifyFromTerminalBackendSnapshot({
      snapshot: terminalSnapshot,
      mutationRequested: true,
      approvalId: 'approval-1',
      proofOverrides: {
        doctor: true,
        prepareWorkspace: true,
        run: true,
        stream: true,
        upload: true,
        download: true,
        snapshot: true,
        hibernate: true,
        resume: true,
        cleanup: true,
        costEstimate: true,
      },
    });

    expect(certified.status).toBe('certified');
    expect(certified.executionPlan.mode).toBe('live');
    expect(certified.readiness.liveMutationAllowed).toBe(true);
  });

  it('composes learning, skill forge, channel proof and backend proof into one daily runtime spine', async () => {
    const service = new ZavorthNativeAutonomySpineService({ now });

    const snapshot = await service.buildSnapshot({
      turn: {
        turnId: 'turn-4',
        outcome: 'success',
        userMessage: 'Sempre use 3 bullets nos resumos. api_key=secret-value',
        assistantResponse: 'Entendido.',
        toolReceipts: [{ id: 'receipt-4', kind: 'message', status: 'done', summary: 'Answered.' }],
        toolCallCount: 6,
      },
      channel: {
        channelId: 'telegram',
        configured: true,
        proofResults: {
          handshake: true,
          inboundEcho: true,
          outboundEcho: true,
          progressSignal: true,
          stopCommand: true,
          approvalCard: true,
          fileSend: true,
          receiptRecorded: true,
        },
      },
      backend: {
        backendId: 'docker',
        configured: true,
        command: 'npm test',
        mutationRequested: false,
        proofResults: {
          doctor: true,
          prepareWorkspace: true,
          run: true,
          stream: true,
          upload: true,
          download: true,
          snapshot: true,
          hibernate: true,
          resume: true,
          cleanup: true,
          costEstimate: true,
        },
      },
      mission: {
        objective: 'Auditar o fluxo de release com verificacao adversarial',
        mode: 'adversarial',
        requestedEffects: ['read', 'write', 'shell'],
        patternHints: ['fanout-and-synthesize', 'adversarial-verification'],
      },
      dreamCycle: {
        storeId: 'mnemos-main',
        sessions: [
          {
            sessionId: 'session-4',
            createdAt: '2026-06-05T11:00:00.000Z',
            summary: 'Usuario prefere release notes com 3 bullets.',
            observations: [
              {
                id: 'obs-release',
                kind: 'preference',
                text: 'Usuario prefere release notes com 3 bullets.',
                evidenceRefs: ['turn-4'],
                updatedAt: '2026-06-05T11:01:00.000Z',
                confidence: 0.86,
              },
            ],
          },
        ],
      },
    });

    expect(snapshot.version).toBe('native-autonomy-spine/v1');
    expect(snapshot.status).toBe('attention');
    expect(snapshot.stages.map((stage) => stage.id)).toEqual([
      'pre-turn-recall',
      'post-turn-learning',
      'skill-forge',
      'dynamic-mission-harness',
      'mnemos-dream-cycle',
      'channel-certification',
      'backend-provider',
      'review-center',
    ]);
    expect(snapshot.summary.organicLearningReady).toBe(true);
    expect(snapshot.summary.skillForgeReady).toBe(true);
    expect(snapshot.summary.dynamicMissionReady).toBe(false);
    expect(snapshot.summary.dreamCycleReady).toBe(true);
    expect(snapshot.dynamicMission?.status).toBe('needs-approval');
    expect(snapshot.dynamicMission?.safety.previewOnly).toBe(true);
    expect(snapshot.dreamCycle?.candidateStore.status).toBe('candidate');
    expect(snapshot.summary.liveChannelReady).toBe(true);
    expect(snapshot.summary.backendProviderReady).toBe(true);
    expect(snapshot.reviewCenter.actions).toEqual(expect.arrayContaining([
      'learn approve',
      'learn reject',
      'learn forget',
      'skill draft review',
      'mission preview approve',
      'dream review apply',
      'channel proof review',
      'backend proof review',
    ]));
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(snapshot.safety.noLiveMutationWithoutProof).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
  });
});
