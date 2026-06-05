import {
  buildZavorthControlRunObservabilityRows,
  zavorthControlRunObservatoryHasQuery,
  filterZavorthControlRunObservatory,
  formatZavorthControlBudgetDetail,
  formatZavorthControlBudgetLabel,
  formatZavorthControlModelRouteDetail,
  formatZavorthControlModelRouteLabel,
  formatZavorthControlRunIdentity,
  formatZavorthControlRunMatchedBy,
  formatZavorthControlRunObservatoryQuery,
  formatZavorthControlRunStatusIndex,
  normalizeZavorthControlRunObservatoryQuery,
  normalizeZavorthControlRunStatus,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlObservability.js';
import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import type { ZavorthControlRunObservatorySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/contracts/index.js';

describe('ZavorthControlObservabilityFormatting', () => {
  it('formats budget units before falling back to token budget or raw status', () => {
    expect(formatZavorthControlBudgetLabel({
      status: 'ok',
      summary: 'Budget real do run.',
      estimatedCostUnits: 2,
      maxEstimatedCostUnits: 8,
    })).toBe('2/8 unidades');

    expect(formatZavorthControlBudgetLabel({
      status: 'attention',
      summary: 'Budget por token.',
      tokensUsed: 300,
      tokenBudget: 1200,
    })).toBe('300/1200 tokens');

    expect(formatZavorthControlBudgetLabel({
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

    expect(formatZavorthControlModelRouteLabel(profile)).toBe('gemini');
    expect(formatZavorthControlModelRouteDetail(profile)).toContain('Gemini/gemini-2.5-flash');
    expect(formatZavorthControlModelRouteDetail(profile)).toContain('fonte current-config');
    expect(formatZavorthControlModelRouteDetail(profile)).toContain('fallback gemini -> openai');
  });

  it('formats Run Observatory query, status index and matched run identity', () => {
    const observatory: ZavorthControlRunObservatorySnapshot = {
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

    expect(formatZavorthControlRunObservatoryQuery(observatory)).toBe('trace trace-1; status failed');
    expect(formatZavorthControlRunStatusIndex(observatory)).toBe('completed:2 | failed:1');
    expect(formatZavorthControlRunIdentity(observatory.runs[0])).toBe('trace-1');
    expect(formatZavorthControlRunMatchedBy(observatory.runs[0].matchedBy)).toBe('trace + status');
    expect(formatZavorthControlRunMatchedBy(['recent'])).toBe('recente');
  });

  it('normalizes and filters Run Observatory snapshots for URL-driven Z7 queries', () => {
    const observatory: ZavorthControlRunObservatorySnapshot = {
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

    expect(normalizeZavorthControlRunStatus('waiting approval')).toBe('waiting_approval');
    expect(zavorthControlRunObservatoryHasQuery({ status: 'failed' })).toBe(true);
    expect(normalizeZavorthControlRunObservatoryQuery({
      runId: ' run-1 ',
      status: 'failed,waiting approval',
      limit: '1',
    } as any)).toEqual({
      runId: 'run-1',
      status: ['failed', 'waiting_approval'],
      limit: 1,
    });

    const filtered = filterZavorthControlRunObservatory(observatory, {
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

  it('builds run observability rows from the zavorthControl view model', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
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

    expect(formatZavorthControlBudgetDetail(viewModel.budget)).toContain('fonte RunBudgetPolicy');
    expect(buildZavorthControlRunObservabilityRows(viewModel)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'route', value: 'gemini' }),
      expect.objectContaining({ id: 'budget', value: '2/8 unidades' }),
      expect.objectContaining({ id: 'trace', value: 'trace-1' }),
    ]));
  });
});
