import {
  buildDashboardRunObservabilityRows,
  dashboardRunObservatoryHasQuery,
  filterDashboardRunObservatory,
  formatDashboardBudgetDetail,
  formatDashboardBudgetLabel,
  formatDashboardModelRouteDetail,
  formatDashboardModelRouteLabel,
  formatDashboardRunIdentity,
  formatDashboardRunMatchedBy,
  formatDashboardRunObservatoryQuery,
  formatDashboardRunStatusIndex,
  normalizeDashboardRunObservatoryQuery,
  normalizeDashboardRunStatus,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/components/DashboardObservability.js';
import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import type { DashboardRunObservatorySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/contracts/index.js';

describe('DashboardObservabilityFormatting', () => {
  it('formats budget units before falling back to token budget or raw status', () => {
    expect(formatDashboardBudgetLabel({
      status: 'ok',
      summary: 'Budget real do run.',
      estimatedCostUnits: 2,
      maxEstimatedCostUnits: 8,
    })).toBe('2/8 unidades');

    expect(formatDashboardBudgetLabel({
      status: 'attention',
      summary: 'Budget por token.',
      tokensUsed: 300,
      tokenBudget: 1200,
    })).toBe('300/1200 tokens');

    expect(formatDashboardBudgetLabel({
      status: 'unknown',
      summary: 'Sem budget.',
    })).toBe('unknown');
  });

  it('formats Model Picker route detail without hiding fallback/readiness context', () => {
    const profile = {
      providerLabel: 'Gemini',
      modelLabel: 'gemini-2.5-flash',
      routingPolicy: 'direct' as const,
      routeId: 'gemini',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['gemini', 'openai'],
    };

    expect(formatDashboardModelRouteLabel(profile)).toBe('gemini');
    expect(formatDashboardModelRouteDetail(profile)).toContain('Gemini/gemini-2.5-flash');
    expect(formatDashboardModelRouteDetail(profile)).toContain('fonte current-config');
    expect(formatDashboardModelRouteDetail(profile)).toContain('fallback gemini -> openai');
  });

  it('formats Run Observatory query, status index and matched run identity', () => {
    const observatory: DashboardRunObservatorySnapshot = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      query: {
        traceId: 'trace-1',
        status: 'failed',
        limit: 10,
      },
      totalRuns: 3,
      matchedRuns: 1,
      indexes: {
        runIds: ['run-1', 'run-2', 'run-3'],
        traceIds: ['trace-1', 'trace-2'],
        sessionIds: ['session-1'],
        statuses: [
          { status: 'completed', count: 2 },
          { status: 'failed', count: 1 },
        ],
      },
      runs: [{
        id: 'run-1',
        traceId: 'trace-1',
        requestId: 'request-1',
        sessionId: 'session-1',
        title: 'Falha auditavel',
        status: 'failed',
        summary: 'Run falhou com causa estruturada.',
        updatedAt: '2026-01-01T00:00:01.000Z',
        eventCount: 2,
        artifactCount: 1,
        approvalCount: 0,
        matchedBy: ['traceId', 'status'],
      }],
    };

    expect(formatDashboardRunObservatoryQuery(observatory)).toBe('trace trace-1; status failed');
    expect(formatDashboardRunStatusIndex(observatory)).toBe('completed:2 | failed:1');
    expect(formatDashboardRunIdentity(observatory.runs[0])).toBe('trace-1');
    expect(formatDashboardRunMatchedBy(observatory.runs[0].matchedBy)).toBe('trace + status');
    expect(formatDashboardRunMatchedBy(['recent'])).toBe('recente');
  });

  it('normalizes and filters Run Observatory snapshots for URL-driven Z7 queries', () => {
    const observatory: DashboardRunObservatorySnapshot = {
      generatedAt: '2026-01-01T00:00:00.000Z',
      query: {},
      totalRuns: 3,
      matchedRuns: 3,
      indexes: {
        runIds: ['run-1', 'run-2', 'run-3'],
        traceIds: ['trace-1', 'trace-2', 'trace-3'],
        sessionIds: ['session-a', 'session-b'],
        statuses: [
          { status: 'completed', count: 1 },
          { status: 'failed', count: 1 },
          { status: 'waiting_approval', count: 1 },
        ],
      },
      runs: [
        {
          id: 'run-1',
          traceId: 'trace-1',
          sessionId: 'session-a',
          title: 'Falha auditavel',
          status: 'failed',
          summary: 'Run falhou com causa estruturada.',
          updatedAt: '2026-01-01T00:00:01.000Z',
          eventCount: 2,
          artifactCount: 1,
          approvalCount: 0,
          matchedBy: ['recent'],
        },
        {
          id: 'run-2',
          traceId: 'trace-2',
          sessionId: 'session-a',
          title: 'Approval pendente',
          status: 'waiting_approval',
          summary: 'Run exige permissao conversacional.',
          updatedAt: '2026-01-01T00:00:02.000Z',
          eventCount: 1,
          artifactCount: 0,
          approvalCount: 1,
          matchedBy: ['recent'],
        },
        {
          id: 'run-3',
          traceId: 'trace-3',
          sessionId: 'session-b',
          title: 'Concluida',
          status: 'completed',
          summary: 'Run concluida.',
          updatedAt: '2026-01-01T00:00:03.000Z',
          eventCount: 3,
          artifactCount: 1,
          approvalCount: 0,
          matchedBy: ['recent'],
        },
      ],
    };

    expect(normalizeDashboardRunStatus('waiting approval')).toBe('waiting_approval');
    expect(dashboardRunObservatoryHasQuery({ status: 'failed' })).toBe(true);
    expect(normalizeDashboardRunObservatoryQuery({
      runId: ' run-1 ',
      status: 'failed,waiting approval',
      limit: '1',
    } as any)).toEqual({
      runId: 'run-1',
      status: ['failed', 'waiting_approval'],
      limit: 1,
    });

    const filtered = filterDashboardRunObservatory(observatory, {
      status: 'waiting approval' as any,
      limit: 2,
    });

    expect(filtered.query).toEqual({
      status: 'waiting_approval',
      limit: 2,
    });
    expect(filtered.matchedRuns).toBe(1);
    expect(filtered.runs).toEqual([
      expect.objectContaining({
        id: 'run-2',
        matchedBy: ['status'],
      }),
    ]);
    expect(filtered.indexes.statuses).toHaveLength(3);
  });

  it('builds run observability rows from the dashboard view model', () => {
    const viewModel = buildDashboardDashboardViewModel({
      wsStatus: 'connected',
      agentRun: {
        id: 'run-1',
        traceId: 'trace-1',
        requestId: 'request-1',
        status: 'completed',
        modelProfile: {
          providerLabel: 'Gemini',
          modelLabel: 'gemini-2.5-flash',
          routingPolicy: 'direct',
          routeId: 'gemini',
          selectionSource: 'current-config',
          readiness: 'ready',
          ready: true,
        },
        metadata: {
          runBudget: {
            source: 'RunBudgetPolicy',
            estimatedCostUnits: 2,
            maxEstimatedCostUnits: 8,
          },
        },
      },
    });

    expect(formatDashboardBudgetDetail(viewModel.budget)).toContain('fonte RunBudgetPolicy');
    expect(buildDashboardRunObservabilityRows(viewModel)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'route', value: 'gemini' }),
      expect.objectContaining({ id: 'budget', value: '2/8 unidades' }),
      expect.objectContaining({ id: 'trace', value: 'trace-1' }),
    ]));
  });
});
