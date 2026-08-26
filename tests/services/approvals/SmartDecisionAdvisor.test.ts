import { SmartDecisionAdvisor } from '../../../src/services/approvals/SmartDecisionAdvisor.js';
import {
  ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
  type AgentPermissionAction,
  type AgentPermissionEvaluateResult,
} from '../../../src/contracts/permission/AgentPermissionContract.js';

type EvaluateCall = {
  toolName?: string | null;
  pattern?: string | null;
  risk?: string | null;
};

function createPermissionService(action: AgentPermissionAction) {
  const evaluate = jest.fn(
    (_input: EvaluateCall): AgentPermissionEvaluateResult => ({
      contractVersion: ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION,
      action,
      reason: 'stub verdict',
      matchedRule: null,
      satisfiedBy: null,
    }),
  );
  return { evaluate };
}

function buildAdvisor(options: {
  action: AgentPermissionAction;
  askModel?: (prompt: string) => Promise<'approve' | 'deny' | null>;
  enabled?: boolean;
}): SmartDecisionAdvisor {
  return new SmartDecisionAdvisor({
    permissionService: createPermissionService(options.action),
    askModel: options.askModel,
    enabled: options.enabled,
  });
}

const baseInput = {
  toolName: 'shell',
  pattern: 'npm test',
  risk: 'attention',
};

describe('SmartDecisionAdvisor', () => {
  it('passes deterministic allow and deny straight through while disabled', async () => {
    const advisor = buildAdvisor({ action: 'allow' });
    const denyAdvisor = buildAdvisor({ action: 'deny' });

    await expect(advisor.advise(baseInput)).resolves.toEqual({
      action: 'allow',
      source: 'deterministic',
    });
    await expect(denyAdvisor.advise(baseInput)).resolves.toEqual({
      action: 'deny',
      source: 'deterministic',
    });
  });

  it('returns a disabled fail-closed ask when disabled and evaluation says ask', async () => {
    const askModel = jest.fn().mockResolvedValue('approve');
    const advisor = buildAdvisor({ action: 'ask', askModel });

    await expect(advisor.advise(baseInput)).resolves.toEqual({
      action: 'ask',
      source: 'disabled',
    });
    expect(askModel).not.toHaveBeenCalled();
  });

  it('never lets the model decide dangerous risks', async () => {
    const askModel = jest.fn().mockResolvedValue('approve');
    const advisor = buildAdvisor({ action: 'ask', askModel, enabled: true });

    for (const risk of ['danger', 'high', 'critical']) {
      await expect(advisor.advise({ ...baseInput, risk })).resolves.toEqual({
        action: 'ask',
        source: 'deterministic',
      });
    }
    expect(askModel).not.toHaveBeenCalled();
  });

  it('maps model approve and deny answers onto the advice', async () => {
    const approving = jest.fn().mockResolvedValue('approve');
    const denying = jest.fn().mockResolvedValue('deny');
    const approveAdvisor = buildAdvisor({ action: 'ask', askModel: approving, enabled: true });
    const denyAdvisor = buildAdvisor({ action: 'ask', askModel: denying, enabled: true });

    await expect(approveAdvisor.advise(baseInput)).resolves.toEqual({
      action: 'allow',
      source: 'smart-model',
    });
    await expect(denyAdvisor.advise(baseInput)).resolves.toEqual({
      action: 'deny',
      source: 'smart-model',
    });
    expect(approving).toHaveBeenCalledWith(expect.stringContaining('Tool "shell"'));
  });

  it('falls back to an ask on model nulls and errors', async () => {
    const nullModel = jest.fn().mockResolvedValue(null);
    const failingModel = jest.fn().mockRejectedValue(new Error('model offline'));
    const nullAdvisor = buildAdvisor({ action: 'ask', askModel: nullModel, enabled: true });
    const failingAdvisor = buildAdvisor({ action: 'ask', askModel: failingModel, enabled: true });

    await expect(nullAdvisor.advise(baseInput)).resolves.toEqual({
      action: 'ask',
      source: 'smart-model',
    });
    await expect(failingAdvisor.advise(baseInput)).resolves.toEqual({
      action: 'ask',
      source: 'smart-model',
    });
  });
});
