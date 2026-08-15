import fs from 'fs';
import path from 'path';
import { HostCommandRunnerService } from '../../src/services/HostCommandRunnerService';


describe('HostCommandRunnerService', () => {
  let runner: HostCommandRunnerService;
  const workspaceId = 'test-workspace';

  beforeAll(() => {
    runner = new HostCommandRunnerService();
  });

  it('executes a basic host command successfully', async () => {
    // Run echo command
    const res = await runner.executeCommand(
      workspaceId,
      'node',
      ['-e', 'console.log("hello world")'],
      __dirname,
      false
    );

    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe('hello world');
    expect(res.stderr).toBe('');
    expect(res.timeoutFlag).toBe(false);
    expect(res.truncatedFlag).toBe(false);
  });

  it('enforces command timeout and kills process', async () => {
    // Run a script that sleeps
    const res = await runner.executeCommand(
      workspaceId,
      'node',
      ['-e', 'setTimeout(() => {}, 10000)'],
      __dirname,
      false,
      500 // 500ms timeout
    );

    expect(res.timeoutFlag).toBe(true);
  });

  it('limits environment variables to allowlist', async () => {
    // Set a custom env variable containing secret token
    process.env.MY_SECRET_API_TOKEN = 'supersecret123';
    process.env.PATH = process.env.PATH || '';

    // Run node process printing all env variables
    const res = await runner.executeCommand(
      workspaceId,
      'node',
      ['-e', 'console.log(JSON.stringify(process.env))'],
      __dirname,
      false
    );

    const childEnv = JSON.parse(res.stdout.trim());

    // PATH should be preserved
    expect(childEnv.PATH).toBeDefined();

    // Sensitive custom variable must NOT be present
    expect(childEnv.MY_SECRET_API_TOKEN).toBeUndefined();

    delete process.env.MY_SECRET_API_TOKEN;
  });

  it('truncates stdout/stderr if too large', async () => {
    // Generate 12,000 character output
    const res = await runner.executeCommand(
      workspaceId,
      'node',
      ['-e', 'console.log("a".repeat(12000))'],
      __dirname,
      false
    );

    expect(res.truncatedFlag).toBe(true);
    expect(res.stdout.length).toBeLessThanOrEqual(10020);
    expect(res.stdout).toContain('[TRUNCATED]');
  });

  it('guarantees no PTY/interactive terminal imports are used', () => {
    const filePath = path.resolve(__dirname, '../../src/services/HostCommandRunnerService.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).not.toContain('node-pty');
    expect(content).not.toContain('spawnPersistent');
    expect(content).not.toContain('stdio: \'inherit\'');
    expect(content).not.toContain('stdio: "inherit"');
  });
});
