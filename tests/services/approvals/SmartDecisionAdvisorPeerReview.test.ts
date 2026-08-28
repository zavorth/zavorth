import { SmartDecisionAdvisor } from '../../../src/services/approvals/SmartDecisionAdvisor.js';
import { PeerReviewAdvisoryService } from '../../../src/runtime/agent/advisory/PeerReviewAdvisoryService.js';
import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine.js';
import type { AgentPermissionService } from '../../../src/services/permission/AgentPermissionService.js';

describe('SmartDecisionAdvisor with PeerReviewAdvisoryService', () => {
  const mockPermissionService: Pick<AgentPermissionService, 'evaluate'> = {
    evaluate: jest.fn(() => ({
      action: 'ask',
      matchedRule: null,
      reason: 'requires evaluation',
    })),
  };

  const peerReviewService = new PeerReviewAdvisoryService();

  it('vetoes action when peer review detects critical security violation', async () => {
    const advisor = new SmartDecisionAdvisor({
      permissionService: mockPermissionService,
      peerReviewService,
      enabled: true,
    });

    const advice = await advisor.advise({
      toolName: 'terminal_backends',
      pattern: 'rmdir /s /q C:\\Windows',
      risk: 'medium',
    });

    expect(advice.action).toBe('deny');
    expect(advice.source).toBe('peer-review-veto');
    expect(advice.dissentingOpinions?.[0]).toContain('Destructive root');
  });

  it('vetoes action when proposed code violates clean code typing invariant', async () => {
    const advisor = new SmartDecisionAdvisor({
      permissionService: mockPermissionService,
      peerReviewService,
      enabled: true,
    });

    const advice = await advisor.advise({
      toolName: 'write_patch',
      pattern: 'src/services/OrderService.ts',
      proposedCode: 'const order: any = fetchOrder();',
      risk: 'low',
    });

    expect(advice.action).toBe('deny');
    expect(advice.source).toBe('peer-review-veto');
    expect(advice.dissentingOpinions?.[0]).toContain('untyped dynamic casting');
  });

  it('allows action when peer review approves and askModel approves', async () => {
    const askModel = jest.fn(async () => 'approve' as const);
    const advisor = new SmartDecisionAdvisor({
      permissionService: mockPermissionService,
      peerReviewService,
      askModel,
      enabled: true,
    });

    const advice = await advisor.advise({
      toolName: 'write_patch',
      pattern: 'src/domain/model/Item.ts',
      proposedCode: 'export interface Item { id: string; price: number; }',
      risk: 'low',
    });

    expect(advice.action).toBe('allow');
    expect(advice.source).toBe('smart-model');
  });

  it('connects to SurfaceDecisionSpine and denies dangerous actions via advisePending', async () => {
    const advisor = new SmartDecisionAdvisor({
      permissionService: mockPermissionService,
      peerReviewService,
      enabled: true,
    });

    const spine = new SurfaceDecisionSpine({
      coordinator: {
        registerPendingApproval: jest.fn(),
        collectPresenterDismissals: jest.fn(() => []),
        getGatewayPort: jest.fn(() => ({
          findPendingApproval: () => null,
          approve: async () => null,
          reject: async () => null,
          listRuns: () => [],
        })),
      },
      scopeMemory: {
        respond: jest.fn(),
        evaluate: jest.fn(() => ({ action: 'ask' as const, matchedRule: null, reason: 'unverified' })),
      },
      smartAdvisor: advisor,
    });

    const spineAdvice = await spine.advisePending({
      toolName: 'terminal_backends',
      pattern: 'rm -rf /',
      risk: 'high',
    });

    expect(spineAdvice.action).toBe('deny');
    expect(spineAdvice.source).toBe('peer-review-veto');
    expect(spineAdvice.dissentingOpinions?.length).toBeGreaterThan(0);
  });
});
