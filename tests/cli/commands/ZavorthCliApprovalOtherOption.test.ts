import type { ZavorthCliFlags, ZavorthCliRuntime } from '../../../src/cli/ZavorthCliContract.js';
import {
  executeCliUniversalApprovalDecision,
  parseCliApprovalReason,
} from '../../../src/cli/ZavorthCliRuntimeFlowHelpers.js';

type RecordedRejection = {
  ref: string;
  options?: { reason?: string | null };
};

type StubAgentGateway = {
  findPendingApproval(ref: string): { run: unknown; approval: unknown } | null;
  approve(ref: string): Promise<unknown>;
  reject(ref: string, options?: { reason?: string | null }): Promise<unknown>;
};

function createRuntime(gateway: StubAgentGateway): ZavorthCliRuntime {
  return {
    agentGateway: gateway,
  } as unknown as ZavorthCliRuntime;
}

function createFlags(): ZavorthCliFlags {
  return {
    command: 'reject',
    repl: false,
    json: false,
    live: false,
    userId: 'operator',
    platform: 'web',
    chatId: 'cli',
    sessionId: 'session-1',
    workspaceHint: null,
    commandText: null,
    headless: false,
    approvalMode: null,
  };
}

describe('CLI approval free-text parity with the approval spine', () => {
  it('splits the ref and the quoted free-text answer out of the args', () => {
    expect(parseCliApprovalReason('approval-1 --reason "not while production is frozen"')).toEqual({
      refArgs: 'approval-1',
      reason: 'not while production is frozen',
    });
    expect(parseCliApprovalReason('approval-1 --reason=changed target first')).toEqual({
      refArgs: 'approval-1',
      reason: 'changed target first',
    });
    expect(parseCliApprovalReason('approval-1')).toEqual({ refArgs: 'approval-1', reason: null });
  });

  it('relays the CLI free-text answer into the spine resolver as a deny-with-reason', async () => {
    const rejections: RecordedRejection[] = [];
    const approvals: string[] = [];
    const gateway: StubAgentGateway = {
      findPendingApproval(ref) {
        return ref === 'approval-1'
          ? { run: { channel: 'api', input: 'run npm test', metadata: {} }, approval: { id: ref } }
          : null;
      },
      async approve(ref) {
        approvals.push(ref);
        return { ok: true };
      },
      async reject(ref, options) {
        rejections.push({ ref, options });
        return {
          ok: true,
          run: {
            id: 'run-1',
            status: 'cancelled',
            summary: 'Execution canceled by the operator before touching sensitive tools.',
            approvals: [],
            input: 'run npm test',
          },
          replies: [{ text: 'Execution canceled by the operator before touching sensitive tools.' }],
        };
      },
    };

    const lines: string[] = [];
    const writer = { line: (text: string) => lines.push(text), error: () => undefined };
    const result = await executeCliUniversalApprovalDecision(
      createRuntime(gateway),
      'approval-1 --reason "not while production is frozen"',
      'reject',
      createFlags(),
      writer,
    );

    expect(result?.ok).toBe(true);
    expect(rejections).toEqual([
      { ref: 'approval-1', options: { reason: 'not while production is frozen' } },
    ]);
    expect(approvals).toEqual([]);
  });
});
