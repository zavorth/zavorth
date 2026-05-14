import { EventEmitter } from 'events';
import { WorkspaceHookService } from '../../src/services/WorkspaceHookService';

describe('WorkspaceHookService', () => {
  it('lists and filters hooks from workspace metadata', () => {
    const service = new WorkspaceHookService();
    const profile = {
      workspace_hooks: [
        { event: 'before-complete', command: 'npm test' },
        { event: 'before-publish', command: 'npm run security:preflight' },
      ],
    };

    expect(service.listHooks(profile)).toEqual(expect.arrayContaining([
      { event: 'before-complete', command: 'npm test' },
      { event: 'before-publish', command: 'npm run security:preflight' },
    ]));
    expect(service.getHooksForEvent(profile, 'before-complete')).toEqual([
      { event: 'before-complete', command: 'npm test' },
    ]);
    expect(service.buildNotes(profile, 'before-publish')).toEqual([
      'Hook before-publish: npm run security:preflight',
    ]);
  });

  it('supports dry-run execution reports without spawning commands', async () => {
    const service = new WorkspaceHookService();
    const report = await service.runHooksForEvent({
      workspace: 'C:/repo',
      source: {
        workspace_hooks: [
          { event: 'before-complete', command: 'npm test' },
        ],
      },
      event: 'before-complete',
      dryRun: true,
    });

    expect(report.ok).toBe(true);
    expect(report.results).toEqual([
      expect.objectContaining({
        command: 'npm test',
        status: 'dry_run',
      }),
    ]);
  });

  it('runs hooks sequentially and reports command completion', async () => {
    const spawnShellCommand = jest.fn().mockImplementation(() => {
      const child = new EventEmitter() as any;
      process.nextTick(() => {
        child.emit('close', 0);
      });
      return child;
    });
    const service = new WorkspaceHookService({
      spawnShellCommand,
    });

    const report = await service.runHooksForEvent({
      workspace: 'C:/repo',
      source: {
        workspace_hooks: [
          { event: 'before-complete', command: 'npm test' },
        ],
      },
      event: 'before-complete',
    });

    expect(spawnShellCommand).toHaveBeenCalledWith('npm test', expect.objectContaining({
      cwd: 'C:/repo',
      stdio: 'inherit',
    }));
    expect(report.ok).toBe(true);
    expect(report.results[0]).toEqual(expect.objectContaining({
      command: 'npm test',
      status: 'completed',
      exitCode: 0,
    }));
  });
});
