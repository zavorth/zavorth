import {
  ZavorthAgentReviewService,
  type ZavorthAgentReviewRequest,
} from '../../src/services/ZavorthAgentReviewService';
import type { GovernedReviewGitHubCommandRunner } from '../../src/runtime/review';

function createRunner(files: Record<string, string> = {}): jest.MockedFunction<GovernedReviewGitHubCommandRunner> {
  return jest.fn(async (command: string, args: string[]) => {
    const text = `${command} ${args.join(' ')}`;
    if (text.startsWith('git diff --name-status')) {
      return {
        command,
        args,
        stdout: 'M\tsrc/auth.ts\n',
        stderr: '',
        exitCode: 0,
      };
    }
    if (text.startsWith('git diff --numstat')) {
      return {
        command,
        args,
        stdout: '1\t0\tsrc/auth.ts\n',
        stderr: '',
        exitCode: 0,
      };
    }
    if (text.startsWith('git diff')) {
      return {
        command,
        args,
        stdout: files.diff || [
          'diff --git a/src/auth.ts b/src/auth.ts',
          '@@ -1 +1 @@',
          '+console.log("token", token)',
        ].join('\n'),
        stderr: '',
        exitCode: 0,
      };
    }
    return {
      command,
      args,
      stdout: '',
      stderr: `Unexpected command: ${text}`,
      exitCode: 1,
    };
  });
}

describe('ZavorthAgentReviewService', () => {
  it('exposes an official read-only Agent Review snapshot for workspace diffs', async () => {
    const runner = createRunner();
    const snapshot = await new ZavorthAgentReviewService({ gitRunner: runner }).run({
      objective: 'review auth token handling',
      workspace: 'C:/repo',
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: 'zavorth-agent-review/1',
      surface: 'zavorth-agent-review',
      target: 'workspace-diff',
    }));
    expect(snapshot.command).toEqual(expect.objectContaining({
      primary: 'zavorth agent-review',
      readOnlyDefault: true,
      approvalRequiredFor: ['comment-on-pr', 'apply-patch', 'launch-live-agents'],
    }));
    expect(snapshot.evidence).toEqual(expect.objectContaining({
      collectedFromGit: true,
      heuristicFindingsGenerated: 1,
      noMutationAppliedByDefault: true,
      noExternalCommentWithoutApproval: true,
    }));
    expect(snapshot.review.context.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'src/auth.ts', status: 'modified', additions: 1 }),
    ]));
    expect(snapshot.review.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Sensitive value may be logged',
        severity: 'high',
        file: 'src/auth.ts',
      }),
    ]));
    expect(snapshot.dashboard.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'show-findings', enabled: true, requiresApproval: false }),
      expect.objectContaining({ id: 'apply-patch', enabled: false, requiresApproval: true }),
    ]));
    expect(snapshot.visual).toEqual(expect.objectContaining({
      route: '/dashboard/reviews',
      layout: 'review-board',
      statusTone: 'danger',
      severityCounts: expect.objectContaining({ high: 1 }),
      patchApplyMode: 'approval-gated',
      primaryFinding: expect.objectContaining({
        title: 'Sensitive value may be logged',
        location: 'src/auth.ts:1',
      }),
      findingCards: expect.arrayContaining([
        expect.objectContaining({
          title: 'Sensitive value may be logged',
          severity: 'high',
        }),
      ]),
      actionCards: expect.arrayContaining([
        expect.objectContaining({ id: 'apply-patch', state: 'approval-required' }),
      ]),
    }));
    expect(new ZavorthAgentReviewService({ gitRunner: runner }).renderText(snapshot)).toContain('Visual Review:');
  });

  it('blocks PR comment requests until an approval id exists', async () => {
    const snapshot = await new ZavorthAgentReviewService({ gitRunner: createRunner() }).run({
      objective: 'review and comment',
      workspace: 'C:/repo',
      postComment: true,
    });

    expect(snapshot.status).toBe('waiting_approval');
    expect(snapshot.review.execution.status).toBe('approval-required');
    expect(snapshot.review.policy.externalEgressNotPerformed).toBe(true);
    expect(snapshot.review.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'comment-on-pr',
        status: 'approval-required',
        allowed: false,
      }),
    ]));
  });

  it('supports provided diff input without probing git', async () => {
    const runner = createRunner();
    const request: ZavorthAgentReviewRequest = {
      target: 'provided',
      objective: 'review injected markup',
      diffText: [
        'diff --git a/src/ui.tsx b/src/ui.tsx',
        '@@ -8 +8 @@',
        '+element.innerHTML = userHtml',
      ].join('\n'),
    };

    const snapshot = await new ZavorthAgentReviewService({ gitRunner: runner }).run(request);

    expect(runner).not.toHaveBeenCalled();
    expect(snapshot.target).toBe('provided');
    expect(snapshot.evidence.collectedFromGit).toBe(false);
    expect(snapshot.review.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'HTML injection surface introduced',
        file: 'src/ui.tsx',
        line: 8,
      }),
    ]));
  });
});
