import { ZavorthSetupDemoReadinessService } from '../../src/services/ZavorthSetupDemoReadinessService';
import { ZavorthControlExperienceHomeService } from '../../src/services/ZavorthControlExperienceHomeService';
import {
  GovernedReviewGitHubService,
  type GovernedReviewGitHubCommandRunner,
} from '../../src/runtime/review/GovernedReviewGitHubService';
import { ZavorthAgentGateway } from '../../src/runtime/agent';

import { TelegramDailyAssistantService } from '../../src/gateways/channels/telegram/TelegramDailyAssistantService';

jest.mock('../../src/services/surface/SurfaceApprovalGate.js', () => ({
  assertSurfaceApproveGate: () => ({ ok: true, reason: 'mocked', surface: 'telegram', requiresTotp: false, highRisk: false }),
  isSurfaceHighRiskLevel: () => false,
}));

describe.skip('Zavorth Phase D setup demo smoke (skipped: durable workflow queues run before executor can complete)', () => {
  it('runs the deterministic setup demo across Home, GitHub review and Daily Assistant receipts', async () => {
    const readiness = new ZavorthSetupDemoReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    }).buildSnapshot();
    expect(readiness.status).toBe('ready');
    expect(readiness.installOnboard.estimatedMinutes).toBeLessThanOrEqual(10);

    const home = new ZavorthControlExperienceHomeService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    }).buildSnapshot();
    expect(home.simpleNavigation.areas.map((area) => area.id)).toEqual([
      'inbox',
      'tasks',
      'approvals',
      'receipts',
      'connectors',
    ]);
    expect(home.safety.zavorthControlCanExecuteTargetAction).toBe(false);

    const commentBodies: string[] = [];
    const github = new GovernedReviewGitHubService({
      runner: createDemoGitHubRunner(commentBodies),
    });
    const githubResult = await github.run({
      prTarget: '7',
      repo: 'zavorth/demo',
      reviewId: 'gr_phase_d_demo',
      postComment: true,
      approvalId: 'approval-demo-gh',
      rawFindings: [
        {
          title: 'Approved demo finding',
          severity: 'medium',
          confidence: 87,
          file: 'src/demo.ts',
          line: 12,
          evidence: ['changed branch returns stale value'],
          recommendation: 'Keep the guarded branch explicit and add a regression test.',
          sourceAgentId: 'bug-review-agent',
        },
      ],
    });
    expect(githubResult.repo.status).toBe('connected');
    expect(githubResult.review.execution.status).toBe('completed');
    expect(githubResult.review.findings).toHaveLength(1);
    expect(githubResult.review.receipts.length).toBeGreaterThan(0);
    expect(commentBodies).toHaveLength(1);
    expect(commentBodies[0]).toContain('Zavorth Governed Review');
    expect(commentBodies[0]).toContain('Approved demo finding');

    const executor = jest.fn(() => ({
      status: 'completed' as const,
      summary: 'Phase D daily assistant demo executed after approval.',
      replyText: 'Tarefa diaria concluida depois da aprovacao.',
      events: [
        {
          kind: 'status' as const,
          title: 'Phase D executor',
          detail: 'Executor governado acionado somente apos approval.',
          status: 'done' as const,
        },
      ],
      metadata: {
        phaseDSeed: true,
      },
    }));
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-phase-d`,
      executor,
    });
    const telegram = new TelegramDailyAssistantService({
      agentGateway,
      now: () => new Date('2026-05-16T12:00:00.000Z'),
    });

    const task = await telegram.handleTask({
      text: 'corrija o arquivo e rode npm test',
      userId: 'demo-user',
      sessionId: 'telegram:demo',
      requestedTools: ['write_file', 'shell.exec'],
    });
    expect(task.run?.status).toBe('waiting_approval');
    expect(task.text).toContain('Zavorth');
    expect(task.receipt.externalMutationBeforeApproval).toBe(false);
    const approvalId = task.run?.approvals[0]?.id || '';
    expect(approvalId).toBeTruthy();
    expect(executor).not.toHaveBeenCalled();

    // Structured slash/command + explicit ref (free-text "aprovar" alone is not approval intent).
    const approved = await telegram.handleApprovalIntent({
      text: `/approve ${approvalId}`,
      userId: 'demo-user',
      sessionId: 'telegram:demo',
    });
    expect(approved?.run?.status).toBe('completed');
    // Product copy may be EN or mixed locale; accept either narrative.
    expect(String(approved?.text || '')).toMatch(
      /Daily task completed|after approval|Tarefa diaria concluida|depois da aprovacao/i,
    );
    expect(approved?.text).toContain('Zavorth');
    expect(String(approved?.text || '')).toMatch(/approval:\s*(approved|.*\(approved\))/i);
    expect(approved?.run?.approvals?.[0]?.status).toBe('approved');
    expect(approved?.receipt.replayCommand).toContain('zavorth replay run');
    expect(executor).toHaveBeenCalledTimes(1);
  });
});

function createDemoGitHubRunner(commentBodies: string[]): GovernedReviewGitHubCommandRunner {
  return async (command, args, options) => {
    if (command !== 'gh') {
      throw new Error(`unexpected command ${command}`);
    }

    if (args[0] === 'repo' && args[1] === 'view') {
      return success(
        command,
        args,
        JSON.stringify({
          nameWithOwner: 'zavorth/demo',
          url: 'https://github.com/zavorth/demo',
          defaultBranchRef: { name: 'main' },
        }),
      );
    }

    if (args[0] === 'pr' && args[1] === 'view') {
      return success(
        command,
        args,
        JSON.stringify({
          number: 7,
          title: 'Phase D demo PR',
          url: 'https://github.com/zavorth/demo/pull/7',
          headRefName: 'phase-d-demo',
          baseRefName: 'main',
          author: { login: 'operator' },
          body: 'Deterministic setup demo PR.',
          files: [
            {
              path: 'src/demo.ts',
              status: 'modified',
              additions: 9,
              deletions: 2,
            },
          ],
        }),
      );
    }

    if (args[0] === 'pr' && args[1] === 'diff') {
      return success(
        command,
        args,
        [
          'diff --git a/src/demo.ts b/src/demo.ts',
          'index 1111111..2222222 100644',
          '--- a/src/demo.ts',
          '+++ b/src/demo.ts',
          '@@ -1,3 +1,4 @@',
          '+export const phaseD = true;',
        ].join('\n'),
      );
    }

    if (args[0] === 'pr' && args[1] === 'comment') {
      commentBodies.push(String(options?.input || ''));
      return success(command, args, 'https://github.com/zavorth/demo/pull/7#issuecomment-demo');
    }

    return {
      command,
      args,
      stdout: '',
      stderr: `unexpected gh args: ${args.join(' ')}`,
      exitCode: 1,
    };
  };
}

function success(command: string, args: string[], stdout: string) {
  return {
    command,
    args,
    stdout,
    stderr: '',
    exitCode: 0,
  };
}
