import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildGovernedReviewCliSnapshot,
  formatGovernedReviewSnapshot,
  resolveGovernedReviewCliText,
  shouldHandleReviewCommand,
} from '../../src/cli/ZavorthCliGovernedReviewRenderer.js';
import { GOVERNED_REVIEW_CONTRACT_VERSION } from '../../src/runtime/review/index.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-governed-review',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Governed Review', () => {
  it('parses governed review text without flags', () => {
    expect(resolveGovernedReviewCliText('run --security --file=src/a.ts "review auth"')).toBe('review auth');
    expect(resolveGovernedReviewCliText('github --pr=42 "review approvals"')).toBe('review approvals');
    expect(shouldHandleReviewCommand('review', '')).toBe(true);
    expect(shouldHandleReviewCommand('review', '--security "auth"')).toBe(true);
    expect(shouldHandleReviewCommand('review', 'github --pr=42')).toBe(true);
    expect(shouldHandleReviewCommand('review', 'this module')).toBe(false);
    expect(shouldHandleReviewCommand('review', 'review github helper')).toBe(false);
  });

  it('renders governed review JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'governed-review',
      normalized: 'governed-review',
      args: '--security --file=src/auth.ts "review auth changes"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        handled: true,
      }),
    );
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(
      expect.objectContaining({
        contractVersion: GOVERNED_REVIEW_CONTRACT_VERSION,
        mode: 'security-review',
        policy: expect.objectContaining({
          noMutationApplied: true,
          approvalRequiredBeforeMutation: true,
        }),
        agentRuntimePlan: expect.objectContaining({
          source: 'ReviewAgentOrchestrator',
          policy: expect.objectContaining({
            noSubagentsLaunched: true,
            approvalRequiredBeforeLaunch: true,
          }),
        }),
        verification: expect.objectContaining({
          acceptedThreshold: 80,
        }),
        policyGate: expect.objectContaining({
          source: 'ReviewPolicyGate',
        }),
      }),
    );
    expect(payload.context.files).toEqual([expect.objectContaining({ path: 'src/auth.ts' })]);
  });

  it('formats a compact human product surface', () => {
    const snapshot = buildGovernedReviewCliSnapshot({
      commandName: 'security-review',
      args: '--file=src/auth.ts "review auth"',
      userId: 'grey',
      sessionId: 'session-cli-governed-review-human',
    });

    const text = formatGovernedReviewSnapshot(snapshot);

    expect(text).toContain('Zavorth Governed Review - Connector registry');
    expect(text).toContain('Agents');
    expect(text).toContain('Policy Gate');
    expect(text).toContain('/zavorthControl/reviews');
    expect(text).toContain('approval-gated');
  });

  it('executes approved mock-live agents through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'governed-review',
      normalized: 'governed-review',
      args: '--security --mock-live-agents --approval-id=approval-cli-1 --file=src/auth.ts "review auth changes"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        handled: true,
      }),
    );
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload.execution).toEqual(
      expect.objectContaining({
        status: 'completed',
        approvalId: 'approval-cli-1',
        liveAgentSnapshot: expect.objectContaining({
          status: 'completed',
          liveRuns: 1,
          externalIoPerformed: false,
        }),
      }),
    );
    expect(payload.execution.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'launch-live-agents',
          status: 'completed',
          allowed: true,
        }),
      ]),
    );
  });
});
