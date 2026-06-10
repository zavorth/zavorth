import { WebAppRuntimeSessionMutationService } from '../../src/services/WebAppRuntimeSessionMutationService';

type CompactOptions = { receiptId: string; keepLastMessages?: number };

interface MockDeps {
  realtime: {
    createSession: jest.Mock;
    ensureSession: jest.Mock;
    getResolvedSnapshot: jest.Mock;
    compactSessionTranscript: jest.Mock;
    captureBaseline: jest.Mock;
  };
  writeJson: jest.Mock;
  readJsonBody: jest.Mock;
}

interface MockHelpers {
  buildCanonicalStatePayload: jest.Mock;
}

function createCompactHarness(snapshotOverrides: Record<string, unknown> = {}) {
  const compactSessionTranscript = jest.fn((_sessionId: string, content: string, options: CompactOptions) => ({
    message: {
      id: options.receiptId,
      role: 'assistant',
      content,
      createdAt: '2026-06-06T12:00:00.000Z',
      kind: 'session.compaction',
    },
    originalMessageCount: 3,
    retainedMessageCount: Number(options.keepLastMessages || 0),
  }));
  const snapshot = {
    sessionId: 'session-1',
    messages: [
      { role: 'user', content: 'Use OPENAI_API_KEY=sk-super-secret-token-here for the test.' },
      { role: 'assistant', content: 'I will help safely.' },
      { role: 'user', content: 'Keep the pending approval visible.' },
    ],
    tasks: [{ task_id: 'task-1', status: 'running', title: 'Review workspace' }],
    permissions: [{ permission_id: 'perm-1', task_id: 'task-approval-1', status: 'pending', reason: 'Needs shell approval' }],
    workflowRuns: [{ workflow_run_id: 'workflow-1', workflow_name: 'Nightly review', status: 'running' }],
    toolRuns: [{ runId: 'tool-1' }],
    ...snapshotOverrides,
  };
  const deps: MockDeps = {
    realtime: {
      createSession: jest.fn(() => 'session-created'),
      ensureSession: jest.fn(),
      getResolvedSnapshot: jest.fn(async () => snapshot),
      compactSessionTranscript,
      captureBaseline: jest.fn(async () => undefined),
    },
    writeJson: jest.fn(),
    readJsonBody: jest.fn(),
  };
  const helpers: MockHelpers = {
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
  return { deps, helpers, compactSessionTranscript };
}

describe('WebAppRuntimeSessionMutationService compact', () => {
  it('compacts the active transcript with a redacted summary and receipt', async () => {
    const service = new WebAppRuntimeSessionMutationService();
    const { deps, helpers, compactSessionTranscript } = createCompactHarness();

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
    expect(summary).toContain('workflow-1');
    expect(summary).toContain('Nightly review');
    expect(helpers.buildCanonicalStatePayload).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ sessionPlaneMode: 'summary' }),
    );
  });

  it('summarizes empty sessions without inventing open items', async () => {
    const service = new WebAppRuntimeSessionMutationService();
    const { deps, helpers, compactSessionTranscript } = createCompactHarness({
      messages: [],
      tasks: [],
      permissions: [],
      workflowRuns: [],
      toolRuns: [],
    });

    await service.executeCanonicalCompact({ sessionId: 'session-empty' }, deps as any, helpers as any);

    const summary = compactSessionTranscript.mock.calls[0]?.[1] || '';
    expect(summary).toContain('No previous transcript content was available.');
    expect(summary).toContain('No open task, workflow, or approval was visible');
  });

  it.each([0, 3, 12, 20])('clamps keepLastMessages=%s before transcript replacement', async (keepLastMessages) => {
    const service = new WebAppRuntimeSessionMutationService();
    const { deps, helpers, compactSessionTranscript } = createCompactHarness();

    await service.executeCanonicalCompact({
      sessionId: 'session-keep',
      keepLastMessages,
    }, deps as any, helpers as any);

    expect(compactSessionTranscript).toHaveBeenCalledWith(
      'session-keep',
      expect.any(String),
      expect.objectContaining({ keepLastMessages: Math.min(12, Math.max(0, keepLastMessages)) }),
    );
  });

  it('returns a safe error payload when compaction fails through the handler', async () => {
    const service = new WebAppRuntimeSessionMutationService();
    const { deps, helpers } = createCompactHarness();
    deps.readJsonBody.mockResolvedValue({ sessionId: 'session-error' });
    deps.realtime.compactSessionTranscript.mockImplementation(() => {
      throw new Error('SECRET_TOKEN=super-secret-value');
    });

    await service.handleCompact({} as any, {} as any, deps as any, helpers as any);

    expect(deps.writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: false,
        error: expect.stringContaining('Falha ao compactar sessao.'),
      }),
      400,
    );
    expect(JSON.stringify(deps.writeJson.mock.calls)).not.toContain('super-secret-value');
  });
});
