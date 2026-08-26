import {
  ApprovalCoordinator,
  APPROVAL_MENU_TIMEOUT_MS,
  type ApprovalCoordinatorGatewayPort,
} from '../../../src/services/approvals/ApprovalCoordinator.js';
import { SurfaceDecisionSpine } from '../../../src/services/approvals/SurfaceDecisionSpine.js';
import type { SurfaceDecisionPendingFilter } from '../../../src/services/approvals/SurfaceDecisionPort.js';
import type {
  SurfaceDecisionReceipt,
} from '../../../src/services/approvals/SurfaceDecisionContract.js';
import { TaskDecisionPort } from '../../../src/services/approvals/ports/TaskDecisionPort.js';

function createPassiveGateway(): ApprovalCoordinatorGatewayPort {
  return {
    findPendingApproval: () => null,
    approve: async () => null,
    reject: async () => null,
    listRuns: () => [],
  };
}

type StubPortOptions = {
  isPending?: (ref: string) => boolean;
  pendingRefs?: (filter: SurfaceDecisionPendingFilter) => string[];
};

function createStubPort(options: StubPortOptions = {}) {
  const decide = jest.fn<Promise<SurfaceDecisionReceipt>, []>().mockResolvedValue({
    resolved: true,
    receiptText: 'stub',
    decidedBy: 'operator',
    dismissals: [],
  });
  return {
    decide,
    port: {
      findPending: (ref: string) => (options.isPending ? options.isPending(ref) : true),
      decide: () => decide(),
      listPending: options.pendingRefs ? options.pendingRefs : undefined,
    },
  };
}

describe('spine cross-surface pending listing', () => {
  it('orders entries by canonical decision-type order, then coordinator menus', () => {
    const coordinator = new ApprovalCoordinator(createPassiveGateway());
    const spine = new SurfaceDecisionSpine({
      coordinator,
      scopeMemory: { respond: jest.fn(), evaluate: jest.fn() },
    });
    const taskStub = createStubPort({ pendingRefs: () => ['task-1'] });
    const permissionStub = createStubPort({
      pendingRefs: ({ sessionId }) =>
        sessionId === 'sess-1' ? [] : ['perm-1', 'perm-2'],
    });
    spine.registerDecisionPort('permission', permissionStub.port);
    spine.registerDecisionPort('task', taskStub.port);
    coordinator.registerPendingMenu('telegram:100', ['run-9']);

    expect(spine.listPending()).toEqual([
      { decisionType: 'task', ref: 'task-1' },
      { decisionType: 'permission', ref: 'perm-1' },
      { decisionType: 'permission', ref: 'perm-2' },
      { decisionType: 'agent-run', ref: 'run-9' },
    ]);
    expect(spine.listPending({ sessionId: 'sess-1' })).toEqual([
      { decisionType: 'task', ref: 'task-1' },
      { decisionType: 'agent-run', ref: 'run-9' },
    ]);
  });

  it('does not repeat a reference already listed by a port under the agent-run attribution', () => {
    const coordinator = new ApprovalCoordinator(createPassiveGateway());
    const spine = new SurfaceDecisionSpine({
      coordinator,
      scopeMemory: { respond: jest.fn(), evaluate: jest.fn() },
    });
    spine.registerDecisionPort(
      'task',
      createStubPort({ pendingRefs: () => ['task-shared'] }).port,
    );
    coordinator.registerPendingMenu('web:1', ['task-shared', 'run-only']);

    expect(spine.listPending()).toEqual([
      { decisionType: 'task', ref: 'task-shared' },
      { decisionType: 'agent-run', ref: 'run-only' },
    ]);
  });

  it('returns an empty listing when ports cannot enumerate and no menus are live', () => {
    const spine = new SurfaceDecisionSpine({
      coordinator: new ApprovalCoordinator(createPassiveGateway()),
      scopeMemory: { respond: jest.fn(), evaluate: jest.fn() },
    });
    spine.registerDecisionPort('task', new TaskDecisionPort({
      handleApproval: async () => undefined,
      handleRejection: async () => undefined,
    }));

    expect(spine.listPending()).toEqual([]);
  });

  it('resolves the first registered port claiming a reference and reports none otherwise', () => {
    const spine = new SurfaceDecisionSpine({
      coordinator: new ApprovalCoordinator(createPassiveGateway()),
      scopeMemory: { respond: jest.fn(), evaluate: jest.fn() },
    });
    const taskStub = createStubPort({ isPending: (ref) => ref === 'claimed-by-task' });
    const permissionStub = createStubPort({ isPending: (ref) => ref.startsWith('perm') });
    spine.registerDecisionPort('permission', permissionStub.port);
    spine.registerDecisionPort('task', taskStub.port);

    expect(spine.findClaimingType('claimed-by-task')).toBe('task');
    expect(spine.findClaimingType('perm-headless')).toBe('permission');
    expect(spine.findClaimingType('ghost')).toBeNull();
  });
});

describe('ApprovalCoordinator.listPendingMenuRefs', () => {
  it('flattens live menus in registration order without duplication', () => {
    let nowMs = 1_000;
    const coordinator = new ApprovalCoordinator(
      createPassiveGateway(),
      () => nowMs,
    );
    coordinator.registerPendingMenu('telegram:1', ['run-a', 'run-b']);
    coordinator.registerPendingMenu('web:2', ['run-b', 'run-c']);

    expect(coordinator.listPendingMenuRefs()).toEqual(['run-a', 'run-b', 'run-c']);

    nowMs += APPROVAL_MENU_TIMEOUT_MS + 1;
    expect(coordinator.listPendingMenuRefs()).toEqual([]);
  });
});

describe('TaskDecisionPort pending enumeration', () => {
  it('delegates to the supplied provider and stays empty without one', () => {
    const withProvider = new TaskDecisionPort(
      { handleApproval: async () => undefined, handleRejection: async () => undefined },
      { pendingRefs: () => ['task-7'] },
    );
    const withoutProvider = new TaskDecisionPort({
      handleApproval: async () => undefined,
      handleRejection: async () => undefined,
    });

    expect(withProvider.listPending()).toEqual(['task-7']);
    expect(withProvider.listPending({ sessionId: 'sess-9' })).toEqual(['task-7']);
    expect(withoutProvider.listPending()).toEqual([]);
  });
});
