import fs from 'fs';
import path from 'path';
import { WorkspaceCommandRunnerService } from '../../src/services/WorkspaceCommandRunnerService';

describe('WorkspaceCommandRunnerService', () => {
  const runner = new WorkspaceCommandRunnerService();
  const workspaceRoot = fs.realpathSync(path.resolve('.'));

  it('runs command inside workspace successfully', async () => {
    // Run simple git status or node command
    const res = await runner.executeCommand('node -v', '.', workspaceRoot, 10000, 'LOW');
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('v');
    expect(res.timeoutFlag).toBe(false);
    expect(res.truncatedFlag).toBe(false);
  });

  it('fails if directory is outside workspace', async () => {
    await expect(
      runner.executeCommand('node -v', 'C:/Windows', workspaceRoot, 10000, 'LOW')
    ).rejects.toThrow();
  });

  it('respects timeout flags', async () => {
    // Run a script that sleeps (e.g. node -e "setTimeout(() => {}, 10000)") with 500ms timeout
    const res = await runner.executeCommand('node -e "setTimeout(()=>{},5000)"', '.', workspaceRoot, 500, 'MEDIUM');
    expect(res.timeoutFlag).toBe(true);
  });

  it('truncates very long outputs', async () => {
    // Generate a very long output
    const res = await runner.executeCommand('node -e "console.log(\'A\'.repeat(12000))"', '.', workspaceRoot, 5000, 'MEDIUM');
    expect(res.truncatedFlag).toBe(true);
    expect(res.stdout.length).toBeLessThanOrEqual(10050); // 10000 + length of suffix
    expect(res.stdout).toContain('[TRUNCATED]');
  });

  it('sanitizes environment variables from secrets', async () => {
    // Run a node command that prints a secret key if it is present
    process.env.MY_SECRET_API_KEY = 'super-secret-12345';
    const res = await runner.executeCommand('node -e "console.log(process.env.MY_SECRET_API_KEY)"', '.', workspaceRoot, 5000, 'MEDIUM');
    expect(res.stdout.trim()).toBe('undefined');
    delete process.env.MY_SECRET_API_KEY;
  });
});
