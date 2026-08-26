import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine.js';
import type {
  SmartDecisionAdvice,
  SmartDecisionInput,
} from '../../../src/services/approvals/SmartDecisionAdvisor.js';
import { SmartDecisionAdvisor } from '../../../src/services/approvals/SmartDecisionAdvisor.js';
import type { AgentPermissionService } from '../../../src/services/permission/AgentPermissionService.js';

function buildSpine(smartAdvisor?: Pick<SmartDecisionAdvisor, 'advise'>): SurfaceDecisionSpine {
  return new SurfaceDecisionSpine({
    coordinator: {
      registerPendingApproval: () => ({ leaderRef: '', isDuplicate: false }),
      collectPresenterDismissals: () => [],
    },
    scopeMemory: {
      respond: jest.fn(),
      evaluate: jest.fn(),
    } as unknown as Pick<AgentPermissionService, 'respond' | 'evaluate'>,
    smartAdvisor,
  });
}

const BASE_INPUT: SmartDecisionInput = {
  toolName: 'permission:perm-headless-1',
  pattern: 'run the deploy command',
  risk: 'attention',
};

describe('spine smart advisor hook (off by default)', () => {
  it('answers the fail-closed disabled verdict when no advisor is wired', async () => {
    const spine = buildSpine();

    await expect(spine.advisePending(BASE_INPUT)).resolves.toEqual({ action: 'ask', source: 'disabled' });
  });

  it('delegates advisePending to the wired advisor without touching resolve', async () => {
    const advise = jest.fn().mockResolvedValue({ action: 'allow', source: 'deterministic' });
    const spine = buildSpine({ advise });

    await expect(spine.advisePending(BASE_INPUT)).resolves.toEqual({
      action: 'allow',
      source: 'deterministic',
    });
    expect(advise).toHaveBeenCalledWith(BASE_INPUT);
    expect(spine.listRegisteredTypes()).toEqual([]);
  });

  it('keeps resolve() untouched by an advisor that would allow everything', async () => {
    const advise = jest
      .fn<Promise<SmartDecisionAdvice>, [SmartDecisionInput]>()
      .mockResolvedValue({ action: 'deny', source: 'smart-model' });
    const spine = buildSpine({ advise });

    const receipt = await spine.resolve({
      decisionType: 'permission',
      decisionRef: 'perm-headless-1',
      surface: 'web',
      chatId: 'web-1',
      choice: 'once',
    });

    expect(advise).not.toHaveBeenCalled();
    expect(receipt).toMatchObject({ resolved: false, receiptText: null });
  });

  it('exposes the real advisor through the same Pick surface', async () => {
    const evaluate = jest.fn().mockReturnValue({
      contractVersion: 1,
      action: 'allow',
      reason: 'matched rule',
      matchedRule: null,
      satisfiedBy: null,
    });
    const advisor = new SmartDecisionAdvisor({
      permissionService: { evaluate },
      enabled: true,
    });
    const spine = buildSpine(advisor);

    await expect(
      spine.advisePending({ toolName: 'permission:p1', pattern: 'npm test', risk: null }),
    ).resolves.toEqual({ action: 'allow', source: 'deterministic' });
  });
});
