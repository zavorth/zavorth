import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runZavorthLiveNamespaceCommand } from '../../src/cli/ZavorthCliLiveNamespaces';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-cli-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'daily-cli-test' }));
  return root;
}

describe('Zavorth daily operations CLI commands', () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      const root = roots.pop();
      if (root) fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates background tasks and goals through simple daily commands', async () => {
    const root = makeRoot();
    roots.push(root);

    const background = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'background',
      args: ['summarize', 'the', 'workspace', '--json'],
    });
    const goal = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'go',
      args: ['finish', 'release', 'readiness', '--json'],
    });
    const goalPayload = JSON.parse(goal.output);
    const loop = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'goals',
      args: ['loop', goalPayload.goal.id, '--summary', 'Still need one validation step', '--json'],
    });
    const worker = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'goals',
      args: ['worker', '--max-items', '1', '--json'],
    });
    const daemonStatus = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'goals',
      args: ['daemon', 'status', '--json'],
    });

    expect(JSON.parse(background.output).task.status).toBe('queued');
    expect(goalPayload.goal.status).toBe('active');
    expect(JSON.parse(loop.output).verdict.status).toBe('continue');
    expect(JSON.parse(loop.output).continuationTask.status).toBe('queued');
    expect(JSON.parse(worker.output).processed).toBe(1);
    expect(JSON.parse(worker.output).runs[0].agentRun.status).toBe('completed');
    expect(JSON.parse(daemonStatus.output).contractVersion).toBe('goal-loop-daemon/1');
  });

  it('uses TaskBoard and session recall from CLI surfaces', async () => {
    const root = makeRoot();
    roots.push(root);

    const board = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'taskboard',
      args: ['decompose', 'Improve provider mesh', '--json'],
    });
    const append = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'mnemos',
      args: ['session-append', 'Provider mesh improved native search.', '--session-id', 'session-1', '--json'],
    });
    const recall = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'mnemos',
      args: ['session-recall', 'native search', '--json'],
    });
    const state = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'state',
      args: ['status', '--json'],
    });

    expect(JSON.parse(board.output).tasks.length).toBeGreaterThanOrEqual(3);
    expect(JSON.parse(append.output).session.id).toBe('session-1');
    expect(JSON.parse(recall.output).data.snapshot.returned).toBeGreaterThan(0);
    expect(JSON.parse(state.output).counts.messages).toBeGreaterThan(0);
    expect(JSON.parse(state.output).counts.tasks).toBeGreaterThanOrEqual(3);
  });

  it('reports xAI readiness honestly without requiring live credentials', async () => {
    const root = makeRoot();
    roots.push(root);

    const result = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'xai',
      args: ['doctor', '--json'],
    });

    const payload = JSON.parse(result.output);
    expect(payload.provider).toBe('xai');
    expect(['XAI_API_KEY', 'XAI_OAUTH_TOKEN']).toContain(payload.credentialEnv);
    expect(['api_key', 'oauth', 'missing']).toContain(payload.authMode);
    expect(payload.capabilities.oauth).toBe(true);
  });
});
