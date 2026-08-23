import * as http from 'http';
import { WebAppRuntimeDecisionRouteService } from '../../../../../src/domain/surface/presentation/web-app/WebAppRuntimeDecisionRouteService.js';

type StubAgentGateway = {
  resolveApprovalIntent: jest.Mock;
  approve: jest.Mock;
  reject: jest.Mock;
  buildSnapshot: jest.Mock;
};

type DecisionRouteDeps = Parameters<WebAppRuntimeDecisionRouteService['handleAgentRunDecision']>[2];

function createStubGateway(): StubAgentGateway {
  return {
    resolveApprovalIntent: jest.fn(),
    approve: jest.fn(async () => ({ ok: true, decision: 'approved', run: { id: 'run-1' } })),
    reject: jest.fn(async (ref: string, options?: { reason?: string | null }) => ({
      ok: true,
      decision: 'rejected',
      run: { id: 'run-1' },
      ref,
      relayedReason: options?.reason ?? null,
    })),
    buildSnapshot: jest.fn(() => ({ generatedAt: '2026-08-23T00:00:00.000Z', runs: [] })),
  };
}

function createDeps(gateway: StubAgentGateway, body: unknown): {
  deps: DecisionRouteDeps;
  jsonResponses: Array<{ body: unknown; status: number }>;
} {
  const jsonResponses: Array<{ body: unknown; status: number }> = [];
  const deps = {
    readJsonBody: jest.fn(async () => body),
    agentGateway: gateway,
    resolveSessionId: () => 'session-1',
    realtime: {
      captureBaseline: jest.fn(async () => undefined),
      getResolvedSnapshot: jest.fn(async () => ({ ok: true })),
    },
    writeJson: (_res: http.ServerResponse, responseBody: unknown, status = 200) => {
      jsonResponses.push({ body: responseBody, status });
    },
  };
  return { deps: deps as unknown as DecisionRouteDeps, jsonResponses };
}

describe('web dashboard approval decisions with free-text answers', () => {
  it('relays an "other" answer as a fail-closed deny-with-reason through the gateway spine', async () => {
    const service = new WebAppRuntimeDecisionRouteService();
    const gateway = createStubGateway();
    const { deps, jsonResponses } = createDeps(gateway, {
      approvalId: 'approval-1',
      answer: 'not while production is frozen',
    });

    await service.handleAgentRunDecision({} as http.IncomingMessage, {} as http.ServerResponse, deps, 'reject');

    expect(gateway.reject).toHaveBeenCalledWith('approval-1', { reason: 'not while production is frozen' });
    expect(gateway.resolveApprovalIntent).not.toHaveBeenCalled();
    expect(gateway.approve).not.toHaveBeenCalled();
    expect(jsonResponses[0]?.status).toBe(200);
  });

  it('keeps structured approvals on the intent resolver path without any free-text answer', async () => {
    const service = new WebAppRuntimeDecisionRouteService();
    const gateway = createStubGateway();
    gateway.resolveApprovalIntent.mockResolvedValue({
      ok: true,
      result: { ok: true, decision: 'approved', run: { id: 'run-1' } },
      resolution: { status: 'resolved' },
      error: null,
    });
    const { deps, jsonResponses } = createDeps(gateway, { approvalId: 'approval-1' });

    await service.handleAgentRunDecision({} as http.IncomingMessage, {} as http.ServerResponse, deps, 'approve');

    expect(gateway.resolveApprovalIntent).toHaveBeenCalled();
    expect(jsonResponses[0]?.status).toBe(200);
    expect((jsonResponses[0]?.body as { decision?: string })?.decision).toBe('approved');
  });
});
