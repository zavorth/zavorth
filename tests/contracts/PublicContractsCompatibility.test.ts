import type {
  GatewayDomainListDTO,
  LearningMetricsDTO,
  LearningStatusDTO,
  MemoryMetricsDTO,
  MemorySearchResultsDTO,
  SessionDTO,
} from '../../src/contracts/public/rest/dto.js';
import type { OpsQualityDTO, PlatformStatusDTO } from '../../src/contracts/public/rest/platform-ops-dto.js';
import type { PublicErrorResponse } from '../../src/contracts/public/errors.js';
import type { PublicRuntimeEvent, PublicSseEvent } from '../../src/contracts/public/events/sse.js';

describe('Public contracts compatibility', () => {
  it('keeps SessionDTO compatible with the canonical public shape', () => {
    const mockSession: SessionDTO = {
      id: 'sess_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      tags: ['test'],
    };

    expect(mockSession.id).toBeDefined();
    expect(['active', 'archived', 'error']).toContain(mockSession.status);
  });

  it('keeps PublicErrorResponse compatible with the canonical public structure', () => {
    const errorBody: PublicErrorResponse = {
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing required field',
      },
    };

    expect(errorBody.error).toBeDefined();
    expect(errorBody.error.code).toBe('INVALID_REQUEST');
  });

  it('keeps SSE event typing stable for the public contract', () => {
    const event: PublicSseEvent = {
      id: 'evt_1',
      type: 'workflow_status',
      timestamp: new Date().toISOString(),
      data: {
        workflowId: 'wf_123',
        status: 'running',
      },
    };

    expect(event.type).toBe('workflow_status');
    expect(event.data.status).toBe('running');
  });

  it('keeps canonical runtime event typing stable for public clients', () => {
    const event: PublicRuntimeEvent = {
      schemaVersion: 1,
      id: 'evt_1',
      type: 'approval.request',
      timestamp: new Date().toISOString(),
      traceId: 'evt_trace',
      sessionId: 'session-1',
      data: {
        approvalId: 'apr_1',
        taskId: 'task_1',
        workflowId: null,
        risk: 'medium',
        action: 'workspace.write',
        summary: 'Edit one file',
        preview: {
          files: ['src/index.ts'],
          diff: null,
          requestedValue: 'src/index.ts',
          resolvedValue: 'src/index.ts',
        },
        policy: 'workspace.write.requires_approval',
        expiresAt: null,
        options: ['allow_once', 'deny', 'view_preview', 'view_rollback'],
      },
      safety: {
        dashboardCanExecute: false,
        policyBrokerRequiredForMutableActions: true,
        rawSecretsSerialized: false,
      },
    };

    expect(event.type).toBe('approval.request');
    expect(event.data.options).toContain('allow_once');
    expect(event.safety.dashboardCanExecute).toBe(false);
  });

  it('keeps gateway domain list typing stable for the public contract', () => {
    const domains: GatewayDomainListDTO = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 2,
        initialized: 2,
        pending: 0,
      },
      domains: [
        {
          id: 'gateway',
          label: 'Gateway',
          initialized: true,
          initializedAt: new Date().toISOString(),
          summary: 'Gateway consolidado.',
        },
      ],
    };

    expect(domains.summary.total).toBe(2);
    expect(domains.domains[0].id).toBe('gateway');
  });

  it('keeps learning and layered memory DTOs compatible with the public contract', () => {
    const learning: LearningStatusDTO = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 1,
        pending: 1,
        approved: 0,
        rejected: 0,
        promoted: 0,
        published: 0,
        quarantined: 0,
        highConfidence: 1,
      },
    };
    const memorySearch: MemorySearchResultsDTO = {
      generatedAt: new Date().toISOString(),
      query: 'gateway release',
      total: 1,
      data: [
        {
          id: 'candidate:wf-1',
          label: 'Ship playbook',
          summary: 'Procedure validated.',
          memoryLayer: 'procedural',
          source: 'learning-plane',
          confidence: 0.91,
          lastValidatedAt: new Date().toISOString(),
        },
      ],
    };

    expect(learning.summary.total).toBe(1);
    expect(memorySearch.data[0].memoryLayer).toBe('procedural');
  });

  it('keeps learning, memory and ops quality metrics typing stable for the public contract', () => {
    const learningMetrics: LearningMetricsDTO = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCandidates: 2,
        acceptedRate: 0.5,
        rejectedRate: 0.5,
        promotedRate: 0.5,
        averageScore: 0.81,
      },
      counts: {
        pending: 1,
        approved: 1,
        rejected: 1,
        promoted: 1,
        published: 0,
        quarantined: 1,
        highConfidence: 1,
      },
    };
    const memoryMetrics: MemoryMetricsDTO = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalEntries: 12,
        episodic: 5,
        semantic: 4,
        procedural: 3,
        averageBudgetUsage: 0.61,
        pressure: 'elevated',
      },
      budgets: {
        perLayer: 12,
        episodicUsage: 0.42,
        semanticUsage: 0.33,
        proceduralUsage: 0.83,
      },
      procedures: {
        total: 3,
        trustedLocal: 1,
        learnedDraft: 1,
        implicit: 1,
      },
    };
    const quality: OpsQualityDTO = {
      generatedAt: new Date().toISOString(),
      score: 0.77,
      healthy: true,
      gate: {
        state: 'warn',
        allowsPromotion: true,
        allowsPublishing: false,
        blockers: [],
        warnings: ['Ha itens waiting for review in the platform plane.'],
        nextStep: 'Ha itens waiting for review in the platform plane.',
      },
      summary: {
        recoveryState: 'ready',
        learningPending: 1,
        quarantinedItems: 1,
        memoryPressure: 'elevated',
      },
      operations: {
        uptime: 123,
        components: {
          database: 'ok',
          eventBus: 'ok',
        },
      },
      learning: {
        totalCandidates: 2,
        acceptedRate: 0.5,
        rejectedRate: 0.5,
        promotedRate: 0.5,
        averageScore: 0.81,
        pending: 1,
        quarantined: 1,
      },
      memory: {
        totalEntries: 12,
        episodic: 5,
        semantic: 4,
        procedural: 3,
        averageBudgetUsage: 0.61,
        pressure: 'elevated',
      },
      platform: {
        total: 4,
        trusted: 2,
        reviewPending: 1,
        quarantined: 1,
        learnedLocal: 1,
      },
    };

    expect(learningMetrics.summary.averageScore).toBe(0.81);
    expect(memoryMetrics.summary.pressure).toBe('elevated');
    expect(quality.summary.recoveryState).toBe('ready');
    expect(quality.gate.state).toBe('warn');
  });

  it('keeps platform trust/provenance typing stable for the public contract', () => {
    const platform: PlatformStatusDTO = {
      registryConnected: true,
      lastSync: new Date().toISOString(),
      summary: {
        total: 2,
        plugins: 1,
        skills: 1,
        mcps: 0,
        trusted: 1,
        reviewPending: 1,
        quarantined: 0,
        learnedLocal: 1,
      },
      plugins: [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          version: 'unknown',
          status: 'active',
        },
      ],
      items: [
        {
          id: 'skill:learned:ship:workspace-a:wf-1',
          label: 'Ship playbook',
          kind: 'skill',
          source: 'learning-plane',
          origin: 'learned-local',
          readiness: 'partial',
          trustState: 'review',
          reviewState: 'pending',
          installState: 'available',
          signatureState: 'unsigned',
          runtimePermissionProfile: 'learned-review',
          promotedFromLearning: false,
          discoveryOnly: false,
          featured: true,
          summary: 'Playbook aprendido.',
          provenance: {
            sourceLocator: 'workflow-run:wf-1',
          },
        },
      ],
    };

    expect(platform.summary?.learnedLocal).toBe(1);
    expect(platform.items?.[0].origin).toBe('learned-local');
  });
});
