import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ZavorthGitWorkflowService,
  type ZavorthGitWorkflowCommandRunner,
} from '../../src/services/ZavorthGitWorkflowService.js';

function createRunner(): {
  runner: jest.MockedFunction<ZavorthGitWorkflowCommandRunner>;
  calls: Array<{ command: string; args: string[] }>;
} {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runner = jest.fn(async (command: string, args: string[]) => {
    calls.push({ command, args });
    const text = `${command} ${args.join(' ')}`;
    if (text === 'git branch --show-current') {
      return { command, args, stdout: 'main\n', stderr: '', exitCode: 0 };
    }
    if (text === 'git status --short --branch') {
      return { command, args, stdout: '## main\n M src/a.ts\n', stderr: '', exitCode: 0 };
    }
    if (text === 'git switch -c feature/test') {
      return { command, args, stdout: 'Switched to a new branch feature/test\n', stderr: '', exitCode: 0 };
    }
    if (text === 'git add --all') {
      return { command, args, stdout: '', stderr: '', exitCode: 0 };
    }
    if (text === 'git commit -m fix auth') {
      return { command, args, stdout: '[main abc123] fix auth\n', stderr: '', exitCode: 0 };
    }
    if (text.startsWith('gh pr create')) {
      return { command, args, stdout: 'https://github.com/zavorth/zavorth/pull/42\n', stderr: '', exitCode: 0 };
    }
    return { command, args, stdout: '', stderr: `Unexpected command: ${text}`, exitCode: 1 };
  });
  return { runner, calls };
}

describe('ZavorthGitWorkflowService', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-git-workflow-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('previews branch creation without mutating git refs', async () => {
    const { runner, calls } = createRunner();
    const snapshot = await new ZavorthGitWorkflowService({ runner }).run({
      action: 'branch',
      workspaceRoot,
      args: 'feature/test',
    });

    expect(snapshot.status).toBe('preview');
    expect(snapshot.plannedCommands).toEqual([
      { command: 'git', args: ['switch', '-c', 'feature/test'], mutates: true },
    ]);
    expect(snapshot.approval.required).toBe(true);
    expect(calls.some((call) => call.args.join(' ') === 'switch -c feature/test')).toBe(false);
  });

  it('applies branch creation only with approval and writes a receipt', async () => {
    const { runner, calls } = createRunner();
    const snapshot = await new ZavorthGitWorkflowService({
      runner,
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    }).run({
      action: 'branch',
      workspaceRoot,
      args: 'feature/test',
      apply: true,
      approvalId: 'approval-1',
    });

    expect(snapshot.status).toBe('applied');
    expect(calls.some((call) => call.args.join(' ') === 'switch -c feature/test')).toBe(true);
    expect(snapshot.receipt).toEqual(expect.objectContaining({
      action: 'branch',
      approvedBy: 'approval-1',
    }));
    const receiptFile = fs.readFileSync(path.join(workspaceRoot, '.zavorth', 'receipts', 'git-workflow.json'), 'utf8');
    expect(receiptFile).toContain(snapshot.receipt!.receiptId);
  });

  it('keeps commits approval-gated', async () => {
    const { runner, calls } = createRunner();
    const snapshot = await new ZavorthGitWorkflowService({ runner }).run({
      action: 'commit',
      workspaceRoot,
      args: '-m "fix auth"',
      apply: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.approval.satisfied).toBe(false);
    expect(calls.some((call) => call.args[0] === 'commit')).toBe(false);
  });

  it('creates a PR through gh after approval', async () => {
    const { runner, calls } = createRunner();
    const snapshot = await new ZavorthGitWorkflowService({ runner }).run({
      action: 'pr',
      workspaceRoot,
      args: '--title "Ship cockpit" --base main --body "Ready"',
      apply: true,
      approvalId: 'approval-pr',
    });

    expect(snapshot.status).toBe('applied');
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: 'gh',
        args: ['pr', 'create', '--title', 'Ship cockpit', '--body', 'Ready', '--base', 'main', '--head', 'main'],
      }),
    ]));
    expect(snapshot.receipt?.action).toBe('pr');
  });
});
