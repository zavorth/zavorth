import {
  OperatorContinuityKernel,
  isOperatorContinuityEnvelope,
} from '../../../src/runtime/operator/OperatorContinuityEnvelope';
import type { OperatorContinuityEnvelope } from '../../../src/runtime/operator/OperatorContinuityEnvelope';
import { ToolRuntimeService } from '../../../src/services/tools/ToolRuntimeService';

describe('OperatorContinuity native-loop correlation helpers', () => {
  it('ToolRuntimeService exposes getLastContinuityEnvelope from the executor', async () => {
    const envelope: OperatorContinuityEnvelope = {
      kind: 'operator-continuity-envelope',
      version: 1,
      generatedAt: '2026-07-10T12:00:00.000Z',
      ids: {
        continuityId: 'child-1',
        requestId: 'req-1',
        receiptId: 'receipt-child-1',
        correlation: {
          policyBrokerReceiptId: 'broker-1',
        },
      },
      request: {
        surface: 'tool-executor',
        operation: 'tool.execute',
        target: 'read_file',
      },
      decision: {
        source: 'security-policy-broker',
        action: 'allow',
        allowed: true,
        rule: 'SAFE',
        reasons: ['ok'],
        brokerReceipt: {
          receiptId: 'broker-1',
          risk: 'safe',
          action: 'allow',
          rule: 'SAFE',
          reasons: ['ok'],
          generatedAt: '2026-07-10T12:00:00.000Z',
        } as any,
      },
      result: {
        ok: true,
        status: 'applied',
        summary: 'read ok',
      },
      receipt: {
        receiptId: 'receipt-child-1',
        generatedAt: '2026-07-10T12:00:00.000Z',
        ids: {
          continuityId: 'child-1',
          requestId: 'req-1',
          receiptId: 'receipt-child-1',
        },
        request: {
          surface: 'tool-executor',
          operation: 'tool.execute',
          target: 'read_file',
        },
        decision: null,
        result: null,
        terminal: true,
      },
    };

    const runtime = new ToolRuntimeService(
      undefined,
      {
        executeTool: async () => 'file contents',
        getLastContinuityEnvelope: () => envelope,
      },
      { cacheEnabled: false },
    );

    await expect(runtime.executeTool('read_file', { path: 'README.md' })).resolves.toBe('file contents');
    expect(runtime.getLastContinuityEnvelope()?.ids.receiptId).toBe('receipt-child-1');
    expect(isOperatorContinuityEnvelope(runtime.getLastContinuityEnvelope())).toBe(true);
  });

  it('parent kernel can finalize a correlated applied receipt', () => {
    const kernel = new OperatorContinuityKernel({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      createId: (() => {
        let n = 0;
        return () => `id-${++n}`;
      })(),
    });
    let parent = kernel.begin({
      continuityId: 'parent-1',
      correlation: { runId: 'run-1', toolCallId: 'tc-1' },
    });
    parent = kernel.recordRequest(parent, {
      surface: 'agent-native-tool-loop',
      operation: 'tool.execute',
      target: 'session_search',
      sourceSurface: 'agent-native-tool-loop',
    });
    parent = kernel.correlate(parent, {
      policyBrokerReceiptId: 'broker-child',
      parentContinuityId: 'parent-1',
    });
    parent = kernel.attachDecision(parent, {
      source: 'security-policy-broker',
      action: 'allow',
      allowed: true,
      rule: 'SAFE',
      reasons: ['observation'],
    });
    parent = kernel.attachResult(parent, {
      ok: true,
      status: 'applied',
      summary: 'session_search applied',
    });
    parent = kernel.finalizeReceipt(parent, { receiptId: 'broker-child' });

    const view = kernel.toPublicView(parent);
    expect(view.receiptId).toBe('broker-child');
    expect(view.terminal).toBe(true);
    expect(parent.ids.correlation?.policyBrokerReceiptId).toBe('broker-child');
  });
});
