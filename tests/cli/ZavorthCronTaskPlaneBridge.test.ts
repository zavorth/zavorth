import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runZavorthLiveNamespaceCommand } from '../../src/cli/ZavorthCliLiveNamespaces';

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cron-task-plane-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'cron-task-plane-test' }));
  return root;
}

describe('Zavorth cron to Task Plane bridge', () => {
  afterEach(() => {
    delete process.env.ZAVORTH_HOME;
  });

  test('materializes due cron jobs into the persistent Task Plane', async () => {
    const root = makeRoot();
    const home = path.join(root, 'isolated-home');
    await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'cron',
      args: [
        'schedule',
        'nightly review',
        '--id',
        'cron-task-plane',
        '--task-plane',
        '--task-title',
        'Nightly review task',
        '--command',
        'node -e "console.log(\\"token=abc\\")"',
        '--at',
        new Date(Date.now() - 1000).toISOString(),
      ],
    });

    const worker = await runZavorthLiveNamespaceCommand({
      projectRoot: root,
      command: 'cron',
      args: ['worker', '--yes', '--task-plane', '--home', home, '--json'],
    });
    const payload = JSON.parse(worker.output);
    const cronRecords = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'cron-jobs.json'), 'utf8'));
    const taskPlane = JSON.parse(fs.readFileSync(path.join(home, 'runtime', 'task-plane.json'), 'utf8'));

    expect(payload.processed[0].taskPlane.created).toBe(true);
    expect(cronRecords[0].status).toBe('completed');
    expect(cronRecords[0].lastMaterializedTaskId).toBe(taskPlane.items[0].id);
    expect(taskPlane.items[0].title).toBe('Nightly review task');
    expect(taskPlane.items[0].source).toBe('cron:cron-task-plane');
    expect(taskPlane.items[0].payload.commandPreview).toContain('token=***');
    expect(taskPlane.items[0].payload.commandDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(taskPlane.items[0].payload.command).toBeUndefined();
  });
});
