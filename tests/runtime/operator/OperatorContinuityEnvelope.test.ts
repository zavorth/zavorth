import {
  OperatorContinuityKernel,
  decisionFromBroker,
  decisionFromEffectBoundary,
  digestOperatorPayload,
  isOperatorContinuityEnvelope,
  requestFromActionGatewayInput,
  resultFromActionResult,
  resultFromToolOutcome,
} from '../../../src/runtime/operator/OperatorContinuityEnvelope';
import { decideSecurityPolicy } from '../../../src/security/SecurityPolicyBroker';

describe('OperatorContinuityEnvelope', () => {
  const now = () => new Date('2026-07-10T12:00:00.000Z');
  let sequence = 0;
  const createId = () => `id-${++sequence}`;

  beforeEach(() => {
    sequence = 0;
  });

  it('normalizes request → decision → result → terminal receipt with stable ids', () => {
    const kernel = new OperatorContinuityKernel({ now, createId });
    let envelope = kernel.begin();
    envelope = kernel.recordRequest(envelope, {
      surface: 'tool-executor',
      operation: 'tool.execute',
      target: 'read_file',
      argsDigest: digestOperatorPayload({ path: 'README.md' }),
    });
    const broker = decideSecurityPolicy({
      surface: 'tool',
      operation: 'execute',
      target: 'read_file',
      reasons: ['safe observation'],
    });
    envelope = kernel.attachDecision(envelope, decisionFromBroker(broker));
    envelope = kernel.attachResult(envelope, resultFromToolOutcome({
      ok: true,
      status: 'applied',
      summary: 'read ok',
      output: 'hello',
    }));
    envelope = kernel.finalizeReceipt(envelope, {
      receiptId: broker.receipt.receiptId,
    });

    expect(isOperatorContinuityEnvelope(envelope)).toBe(true);
    expect(envelope.receipt?.terminal).toBe(true);
    expect(envelope.receipt?.receiptId).toBe(broker.receipt.receiptId);
    expect(envelope.decision?.action).toBe(broker.action);
    expect(envelope.ids.correlation?.policyBrokerReceiptId).toBe(broker.receipt.receiptId);

    const view = kernel.toPublicView(envelope);
    expect(view.continuityId).toBe(envelope.ids.continuityId);
    expect(view.receiptId).toBe(broker.receipt.receiptId);
    expect(view.decisionAction).toBe(broker.action);
    expect(view.terminal).toBe(true);
  });

  it('finalizes deferred effect-boundary outcomes with mutation plan correlation', () => {
    const kernel = new OperatorContinuityKernel({ now, createId });
    let envelope = kernel.begin({
      correlation: {
        runId: 'run-1',
        toolCallId: 'tc-1',
        mutationPlanId: 'plan-1',
      },
    });
    envelope = kernel.recordRequest(envelope, {
      surface: 'agent-native-tool-loop',
      operation: 'effect-boundary',
      target: 'remote_shell',
    });
    envelope = kernel.attachDecision(envelope, decisionFromEffectBoundary({
      action: 'require_user_confirmation',
      allowed: false,
      rule: 'SIDE_EFFECT_REQUIRES_APPROVAL',
      reasons: ['Shell has real side effects.'],
      risk: 'danger',
      requiresApproval: true,
      mutationPlanId: 'plan-1',
    }));
    envelope = kernel.attachResult(envelope, resultFromToolOutcome({
      ok: false,
      status: 'deferred',
      summary: 'Deferred pending approval.',
      data: { mutationPlanId: 'plan-1' },
    }));
    envelope = kernel.finalizeReceipt(envelope);

    expect(envelope.result?.status).toBe('deferred');
    expect(envelope.ids.correlation?.mutationPlanId).toBe('plan-1');
    expect(envelope.receipt?.terminal).toBe(true);
  });

  it('maps ActionGateway apply results into continuity public fields', () => {
    const kernel = new OperatorContinuityKernel({ now, createId });
    const request = requestFromActionGatewayInput({
      operation: 'action.apply',
      actionId: 'experience.set-profile',
      actorId: 'operator',
      sourceSurface: 'cli',
      args: { profile: 'personal' },
    });
    let envelope = kernel.recordRequest(kernel.begin(), request);
    envelope = kernel.attachDecision(envelope, {
      source: 'action-gateway',
      action: 'applied',
      allowed: true,
      rule: 'action-gateway:applied',
      reasons: ['Applied.'],
    });
    const mapped = resultFromActionResult({
      ok: true,
      actionId: 'experience.set-profile',
      operation: 'action.apply',
      status: 'applied',
      summary: 'Profile updated.',
      lines: ['ok'],
      receipt: {
        id: 'action-receipt-1',
        actionId: 'experience.set-profile',
        operation: 'action.apply',
        status: 'applied',
        createdAt: now().toISOString(),
        sourceSurface: 'cli',
        actorId: 'operator',
        summary: 'Profile updated.',
      },
    });
    envelope = kernel.attachResult(envelope, mapped);
    envelope = kernel.finalizeReceipt(envelope, { receiptId: 'action-receipt-1' });

    const view = kernel.toPublicView(envelope);
    expect(view.actionReceiptId).toBe('action-receipt-1');
    expect(view.status).toBe('applied');
    expect(view.receiptId).toBe('action-receipt-1');
  });

  it('runMutation blocks without executing when decision requires approval', async () => {
    const kernel = new OperatorContinuityKernel({ now, createId });
    const execute = jest.fn().mockResolvedValue('should-not-run');
    const { envelope, value } = await kernel.runMutation({
      request: {
        surface: 'tool-executor',
        operation: 'tool.execute',
        target: 'create_file',
      },
      decide: () => ({
        source: 'security-policy-broker',
        action: 'require_user_confirmation',
        allowed: false,
        rule: 'USER_CONFIRMATION_REQUIRED',
        reasons: ['Needs approval.'],
        requiresApproval: true,
      }),
      execute,
    });

    expect(value).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
    expect(envelope.result?.status).toBe('approval_required');
    expect(envelope.receipt?.terminal).toBe(true);
  });
});
