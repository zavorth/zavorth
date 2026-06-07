import { WebAppRuntimeSessionMutationService } from '../../src/services/WebAppRuntimeSessionMutationService';

describe('WebAppRuntimeSessionMutationService compact', () => {
  it('compacts the active transcript with a redacted summary and receipt', async () => {
    const service = new WebAppRuntimeSessionMutationService();
    const compactSessionTranscript = jest.fn((_sessionId: string, content: string, options: { receiptId: string }) => ({
      message: {
        id: options.receiptId,
        role: 'assistant',
        content,
        createdAt: '2026-06-06T12:00:00.000Z',
        kind: 'session.compaction',
      },
      originalMessageCount: 3,
      retainedMessageCount: 1,
    }));
    const deps: any = {
      realtime: {
        createSession: jest.fn(() => 'session-created'),
        ensureSession: jest.fn(),
        getResolvedSnapshot: jest.fn(async (sessionId: string) => ({
          sessionId,
          messages: [
            { role: 'user', content: 'Use OPENAI_API_KEY=sk-super-secret-token-here for the test.' },
            { role: 'assistant', content: 'I will help safely.' },
            { role: 'user', content: 'Keep the pending approval visible.' },
          ],
          tasks: [{ task_id: 'task-1', status: 'running', title: 'Review workspace' }],
          permissions: [{ permissionId: 'perm-1', status: 'pending', reason: 'Needs shell approval' }],
          workflowRuns: [],
          toolRuns: [{ runId: 'tool-1' }],
        })),
        compactSessionTranscript,
        captureBaseline: jest.fn(async () => undefined),
      },
      writeJson: jest.fn(),
      readJsonBody: jest.fn(),
    };
    const helpers: any = {
      buildCanonicalStatePayload: jest.fn(async (sessionId: string) => ({
        snapshot: { sessionId },
        agentRuntime: null,
        productMode: null,
        modeEscalation: null,
        gateway: null,
        session: { sessionId },
        sessions: null,
        sessionsSummary: null,
        gatewaySessionTools: null,
        memoryPlane: null,
        memoryRecall: null,
        controlPlane: null,
        sessionPlane: { summary: { sessionId } },
        approvalPlane: null,
        capabilityPlane: null,
        artifactPlane: null,
        selfmodPlane: null,
        resourcePlane: null,
        companionPlane: null,
        uiSurfaceHints: null,
        runtimeWarnings: [],
        actionRecommendations: [],
      })),
    };

    const payload = await service.executeCanonicalCompact({
      sessionId: 'session-1',
      reason: 'user requested /compact',
    }, deps, helpers);

    expect(payload.ok).toBe(true);
    expect(payload.compaction.status).toBe('compacted');
    expect(payload.receipt.kind).toBe('session.compaction');
    expect(payload.receipt.rawSecretsSerialized).toBe(false);
    expect(payload.receipt.activeTranscriptReplaced).toBe(true);
    expect(compactSessionTranscript).toHaveBeenCalledWith(
      'session-1',
      expect.stringContaining('Session compacted.'),
      expect.objectContaining({ keepLastMessages: 0 }),
    );
    const summary = compactSessionTranscript.mock.calls[0]?.[1] || '';
    expect(summary).toContain('OPENAI_API_KEY=[redacted]');
    expect(summary).not.toContain('sk-super-secret-token-here');
    expect(summary).toContain('perm-1');
    expect(helpers.buildCanonicalStatePayload).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ sessionPlaneMode: 'summary' }),
    );
  });
});
