import {
  GovernedReviewGitHubService,
  type GovernedReviewGitHubCommandRunner,
} from '../../../src/runtime/review';

function createRunner(): {
  runner: jest.MockedFunction<GovernedReviewGitHubCommandRunner>;
  calls: Array<{ command: string; args: string[]; input: string | null }>;
} {
  const calls: Array<{ command: string; args: string[]; input: string | null }> = [];
  const runner = jest.fn(async (command: string, args: string[], options-: { input-: string | null }) => {
    calls.push({ command, args, input: options?.input || null });
    const text = `${command} ${args.join(' ')}`;
    if (text.includes('repo view')) {
      return {
        command,
        args,
        stdout: JSON.stringify({
          nameWithOwner: 'zavorth/zavorth',
          url: 'https://github.com/zavorth/zavorth',
          defaultBranchRef: { name: 'main' },
        }),
        stderr: '',
        exitCode: 0,
      };
    }
    if (text.includes('pr view')) {
      return {
        command,
        args,
        stdout: JSON.stringify({
          number: 42,
          title: 'Harden approvals',
          url: 'https://github.com/zavorth/zavorth/pull/42',
          headRefName: 'feature/approval-hardening',
          baseRefName: 'main',
          author: { login: 'grey' },
          body: 'Tightens governed review approvals.',
          files: [
            { path: 'src/runtime/review/ReviewPolicyGate.ts', additions: 12, deletions: 3, status: 'modified' },
            { path: 'tests/runtime/review/GovernedReviewGitHubService.test.ts', additions: 40, deletions: 0, status: 'added' },
          ],
        }),
        stderr: '',
        exitCode: 0,
      };
    }
    if (text.includes('pr diff')) {
      return {
        command,
        args,
        stdout: [
          'diff --git a/src/runtime/review/ReviewPolicyGate.ts b/src/runtime/review/ReviewPolicyGate.ts',
          '@@ -1 +1 @@',
          '-old',
          '+new',
        ].join('\n'),
        stderr: '',
        exitCode: 0,
      };
    }
    if (text.includes('pr comment')) {
      return {
        command,
        args,
        stdout: 'https://github.com/zavorth/zavorth/pull/42#issuecomment-1',
        stderr: '',
        exitCode: 0,
      };
    }
    return { command, args, stdout: '', stderr: `Unexpected command: ${text}`, exitCode: 1 };
  });
  return { runner, calls };
}

describe('GovernedReviewGitHubService', () => {
  it('connects the repo, reads PR metadata and diff, then runs governed review read-only', async () => {
    const { runner, calls } = createRunner();

    const result = await new GovernedReviewGitHubService({ runner }).run({
      prTarget: '42',
      repo: 'zavorth/zavorth',
      workspace: 'C:/workspace/zavorth',
      userId: 'grey',
      sessionId: 'session-github-review',
    });

    expect(result.source).toBe('GovernedReviewGitHubService');
    expect(result.repo).toEqual(expect.objectContaining({
      status: 'connected',
      nameWithOwner: 'zavorth/zavorth',
    }));
    expect(result.pullRequest).toEqual(expect.objectContaining({
      number: 42,
      title: 'Harden approvals',
      baseRef: 'main',
      headRef: 'feature/approval-hardening',
      additions: 52,
      deletions: 3,
    }));
    expect(result.review.context.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'src/runtime/review/ReviewPolicyGate.ts' }),
    ]));
    expect(result.review.context.metadata).toEqual(expect.objectContaining({
      source: 'github-pr',
      repo: 'zavorth/zavorth',
      prNumber: 42,
    }));
    expect(result.review.execution.status).toBe('not-requested');
    expect(calls.map((call) => call.args.slice(0, 3).join(' '))).toEqual([
      'repo view zavorth/zavorth',
      'pr view 42',
      'pr diff 42',
    ]);
  });

  it('keeps GitHub PR commenting approval-gated', async () => {
    const { runner, calls } = createRunner();

    const result = await new GovernedReviewGitHubService({ runner }).run({
      prTarget: '42',
      repo: 'zavorth/zavorth',
      postComment: true,
    });

    expect(result.status).toBe('waiting_approval');
    expect(result.review.execution.status).toBe('approval-required');
    expect(result.review.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'comment-on-pr',
        status: 'approval-required',
        allowed: false,
      }),
    ]));
    expect(calls.some((call) => call.args.slice(0, 2).join(' ') === 'pr comment')).toBe(false);
  });

  it('posts a real GitHub PR comment through gh after approval', async () => {
    const { runner, calls } = createRunner();

    const result = await new GovernedReviewGitHubService({ runner }).run({
      prTarget: '42',
      repo: 'zavorth/zavorth',
      postComment: true,
      approvalId: 'approval-gh-1',
    });

    const commentCall = calls.find((call) => call.args.slice(0, 2).join(' ') === 'pr comment');
    expect(commentCall).toEqual(expect.objectContaining({
      command: 'gh',
      args: ['pr', 'comment', '42', '--body-file', '-', '--repo', 'zavorth/zavorth'],
    }));
    expect(commentCall?.input).toContain('Zavorth Governed Review');
    expect(result.review.execution.status).toBe('completed');
    expect(result.review.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'comment-on-pr',
        status: 'completed',
        allowed: true,
        approvalId: 'approval-gh-1',
      }),
    ]));
    expect(result.review.policy.externalEgressNotPerformed).toBe(false);
  });

  it('keeps the GitHub path compatible with approved governed live agents', async () => {
    const { runner } = createRunner();

    const result = await new GovernedReviewGitHubService({ runner }).run({
      prTarget: '42',
      repo: 'zavorth/zavorth',
      launchLiveAgents: true,
      liveAgentMode: 'mock-live',
      maxLiveWorkers: 2,
      approvalId: 'approval-gh-live-1',
    });

    expect(result.review.execution.status).toBe('completed');
    expect(result.review.execution.liveAgentSnapshot).toEqual(expect.objectContaining({
      status: 'completed',
      liveRuns: 1,
      externalIoPerformed: false,
    }));
    expect(result.review.execution.outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'launch-live-agents',
        status: 'completed',
        allowed: true,
      }),
    ]));
  });
});
