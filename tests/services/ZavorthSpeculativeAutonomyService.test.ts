import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildSpeculativeDockerValidationArgs,
  parseSpeculativeValidationCommand,
  ZavorthSpeculativeAutonomyCancellationRegistry,
  ZavorthSpeculativeAutonomyService,
  type ZavorthSpeculativeDockerValidationRunner,
  type ZavorthSpeculativeCommandRunner,
} from '../../src/services/ZavorthSpeculativeAutonomyService.js';
import { ZavorthMutationPlaneService } from '../../src/services/ZavorthMutationPlaneService.js';

describe('ZavorthSpeculativeAutonomyService', () => {
  it('builds an AST dependency graph for touched TypeScript files', () => {
    const root = makeWorkspace({
      'src/types.ts': 'export interface User { id: string }\n',
      'src/service.ts': [
        "import type { User } from './types';",
        "import fs from 'fs';",
        'export class UserService {',
        '  load(user: User) { return user.id; }',
        '}',
        '',
      ].join('\n'),
    });
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const graph = service.buildAstContextGraph({
      workspaceRoot: root,
      entryFiles: ['src/service.ts'],
    });

    expect(graph.summary.fileCount).toBe(2);
    expect(graph.files.map((file) => file.path).sort()).toEqual(['src/service.ts', 'src/types.ts']);
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'src/service.ts', to: 'src/types.ts', kind: 'relative-import' }),
      expect.objectContaining({ from: 'src/service.ts', to: 'fs', kind: 'external-import' }),
    ]));
    expect(graph.files.find((file) => file.path === 'src/service.ts')?.symbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'UserService', kind: 'class', exported: true }),
    ]));
  });

  it('applies patches only in the sandbox, validates them, and creates an approval plan', async () => {
    const root = makeWorkspace({
      'package.json': JSON.stringify({ scripts: { 'runtime:check': 'tsc --noEmit' } }, null, 2),
      'src/a.ts': 'export const value = "old";\n',
    });
    const plansDir = path.join(root, '..', 'plans');
    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => ({
      command: input.command,
      status: 'passed',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      durationMs: 4,
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane,
      commandRunner,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Troque old por new',
      runId: 'run-1',
      patches: [{
        path: 'src/a.ts',
        hunks: [{ search: '"old"', replace: '"new"' }],
      }],
      validationCommands: ['npm run runtime:check -- --pretty false'],
      validationMode: 'provided',
    });

    expect(result.status).toBe('approved');
    expect(result.mutationPlan?.status).toBe('waiting_approval');
    expect(fs.readFileSync(path.join(root, 'src/a.ts'), 'utf8')).toContain('"old"');
    expect(fs.readFileSync(path.join(result.finalAttempt!.sandboxWorkspace, 'src/a.ts'), 'utf8')).toContain('"new"');
    expect(result.finalAttempt?.diffText).toContain('-export const value = "old";');
    expect(result.finalAttempt?.diffText).toContain('+export const value = "new";');
    expect(result.finalAttempt?.validationResults[0]).toEqual(expect.objectContaining({ status: 'passed' }));
    expect(commandRunner).toHaveBeenCalledWith(expect.objectContaining({
      command: 'npm run runtime:check -- --pretty false',
      cwd: result.finalAttempt?.sandboxWorkspace,
    }));
  });

  it('parses validation commands without allowing shell composition', () => {
    expect(parseSpeculativeValidationCommand('npm run runtime:check -- --pretty false')).toEqual({
      executable: 'npm',
      args: ['run', 'runtime:check', '--', '--pretty', 'false'],
    });
    expect(parseSpeculativeValidationCommand('npm run runtime:check && curl https://evil.example')).toBeNull();
    expect(parseSpeculativeValidationCommand('npm test -- --token=sk-1234567890abcdef')).toBeNull();
  });

  it('blocks unsafe validation commands before the command runner is invoked', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => ({
      command: input.command,
      status: 'passed',
      exitCode: 0,
      stdout: 'should not run',
      stderr: '',
      durationMs: 1,
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      commandRunner,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Valide sem shell injection',
      runId: 'run-blocked-command',
      writes: [{ path: 'src/a.ts', content: 'export const value = "new";\n' }],
      validationCommands: ['npm run runtime:check && curl https://evil.example'],
      validationMode: 'provided',
    });

    expect(result.status).toBe('needs_correction');
    expect(result.finalAttempt?.validationResults[0]).toEqual(expect.objectContaining({ status: 'blocked' }));
    expect(commandRunner).not.toHaveBeenCalled();
    expect(result.mutationPlan).toBeNull();
  });

  it('redacts validation output before storing the mutation plan payload', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(root, '..', 'plans'),
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => ({
      command: input.command,
      status: 'passed',
      exitCode: 0,
      stdout: 'token=sk-1234567890abcdef',
      stderr: 'Bearer abcdefghijklmnopqrstuvwxyz',
      durationMs: 2,
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane,
      commandRunner,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Troque o valor',
      runId: 'run-redaction',
      writes: [{ path: 'src/a.ts', content: 'export const value = "new";\n' }],
      validationCommands: ['npm run runtime:check'],
      validationMode: 'provided',
    });

    const payloadText = JSON.stringify(result.mutationPlan?.payload || {});
    expect(result.status).toBe('approved');
    expect(payloadText).toContain('[redacted-secret]');
    expect(payloadText).not.toContain('sk-1234567890abcdef');
    expect(payloadText).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('runs validation through the container backend when Docker isolation is requested', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const dockerRuntime = {
      getStatus: jest.fn(() => ({
        enabled: true,
        language: 'javascript' as const,
        image: 'node:22-bullseye',
        dockerReachable: true,
        daemonReachable: true,
        imagePresent: true,
        autoPullEnabled: false,
        sandboxRuntime: 'runsc',
        canRun: true,
        detail: 'docker ready',
      })),
    };
    const dockerRunner: ZavorthSpeculativeDockerValidationRunner = jest.fn(async (input) => ({
      command: input.originalCommand,
      status: 'passed',
      exitCode: 0,
      stdout: 'container ok',
      stderr: '',
      durationMs: 5,
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      dockerRuntime,
      dockerRunner,
      sandboxIsolation: 'container',
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Valide em Docker',
      runId: 'run-container',
      writes: [{ path: 'src/a.ts', content: 'export const value = "new";\n' }],
      validationCommands: ['npm run runtime:check'],
      validationMode: 'provided',
      sandboxIsolation: 'container',
    });

    expect(result.status).toBe('approved');
    expect(result.receipts).toContain('strong-container-sandbox-validation');
    expect(result.finalAttempt?.sandboxBackend).toEqual(expect.objectContaining({
      kind: 'container',
      validationExecution: 'container',
      runtime: 'DockerSpeculativeSandboxBackend',
      hardened: true,
    }));
    expect(dockerRunner).toHaveBeenCalledWith(expect.objectContaining({
      command: expect.any(String),
      originalCommand: 'npm run runtime:check',
      args: expect.arrayContaining([
        'run',
        '--rm',
        '--network',
        'none',
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        'node:22-bullseye',
        'npm',
        'run',
        'runtime:check',
      ]),
    }));
  });

  it('builds hardened Docker validation args without passing host secrets into the container', () => {
    const parsed = parseSpeculativeValidationCommand('npm test -- --runInBand');
    expect(parsed).not.toBeNull();

    const args = buildSpeculativeDockerValidationArgs({
      image: 'node:22-bullseye',
      parsed: parsed!,
      sandboxWorkspace: 'C:/tmp/zavorth-spec/workspace',
    });

    expect(args).toEqual(expect.arrayContaining([
      '--network',
      'none',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--read-only',
      '-e',
      'CI=true',
      'node:22-bullseye',
      'npm',
      'test',
    ]));
    expect(args.join('\n')).not.toMatch(/OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|TOKEN=/i);
  });

  it('blocks microvm isolation requests instead of silently downgrading workspace validation', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      sandboxIsolation: 'microvm',
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Exija microVM',
      runId: 'run-microvm',
      writes: [{ path: 'src/a.ts', content: 'export const value = "new";\n' }],
      validationCommands: ['npm run runtime:check'],
      validationMode: 'provided',
      sandboxIsolation: 'microvm',
    });

    expect(result.status).toBe('needs_correction');
    expect(result.finalAttempt?.sandboxBackend).toEqual(expect.objectContaining({
      kind: 'microvm',
      validationExecution: 'blocked',
      runtime: 'FirecrackerWorkspaceBackend',
    }));
    expect(result.finalAttempt?.validationResults[0]).toEqual(expect.objectContaining({
      status: 'blocked',
    }));
    expect(result.mutationPlan).toBeNull();
  });

  it('uses the correction provider when validation fails before approving the final diff', async () => {
    const root = makeWorkspace({
      'package.json': JSON.stringify({ scripts: { 'runtime:check': 'tsc --noEmit' } }, null, 2),
      'src/a.ts': 'export const value = "old";\n',
    });
    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(root, '..', 'plans'),
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => {
      const content = fs.readFileSync(path.join(input.cwd, 'src/a.ts'), 'utf8');
      return {
        command: input.command,
        status: content.includes('"good"') ? 'passed' : 'failed',
        exitCode: content.includes('"good"') ? 0 : 1,
        stdout: content.includes('"good"') ? 'ok' : '',
        stderr: content.includes('"good"') ? '' : 'bad value failed validation',
        durationMs: 3,
      };
    });
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane,
      commandRunner,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Atualize o valor com autocorrecao',
      runId: 'run-correction',
      writes: [{ path: 'src/a.ts', content: 'export const value = "bad";\n' }],
      validationCommands: ['npm run runtime:check -- --pretty false'],
      validationMode: 'provided',
      maxCorrectionRounds: 1,
      correctionProvider: jest.fn(async () => ({
        writes: [{ path: 'src/a.ts', content: 'export const value = "good";\n' }],
        summary: 'corrige valor ruim',
      })),
    });

    expect(result.status).toBe('approved');
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].status).toBe('needs_correction');
    expect(result.finalAttempt?.validationResults[0]).toEqual(expect.objectContaining({ status: 'passed' }));
    expect(result.finalAttempt?.diffText).toContain('+export const value = "good";');
    expect(fs.readFileSync(path.join(root, 'src/a.ts'), 'utf8')).toContain('"old"');
  });

  it('stops auto-healing correction when the run is cancelled', async () => {
    const root = makeWorkspace({
      'package.json': JSON.stringify({ scripts: { 'runtime:check': 'tsc --noEmit' } }, null, 2),
      'src/a.ts': 'export const value = "old";\n',
    });
    const cancellationRegistry = new ZavorthSpeculativeAutonomyCancellationRegistry();
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => {
      cancellationRegistry.requestCancel('run-cancel', 'test-cancel');
      return {
        command: input.command,
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: 'validation failed',
        durationMs: 3,
      };
    });
    const correctionProvider = jest.fn(async () => ({
      writes: [{ path: 'src/a.ts', content: 'export const value = "good";\n' }],
      summary: 'should not run',
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      commandRunner,
      cancellationRegistry,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Atualize com autocorrecao cancelavel',
      runId: 'run-cancel',
      writes: [{ path: 'src/a.ts', content: 'export const value = "bad";\n' }],
      validationCommands: ['npm run runtime:check -- --pretty false'],
      validationMode: 'provided',
      maxCorrectionRounds: 1,
      correctionProvider,
    });

    expect(result.status).toBe('blocked');
    expect(result.autoHealing.cancelRequested).toBe(true);
    expect(result.receipts).toContain('auto-healing-cancelled');
    expect(result.finalAttempt?.summary).toContain('cancelado');
    expect(correctionProvider).not.toHaveBeenCalled();
  });

  it('stops auto-healing correction when the time budget is exhausted', async () => {
    const root = makeWorkspace({
      'package.json': JSON.stringify({ scripts: { 'runtime:check': 'tsc --noEmit' } }, null, 2),
      'src/a.ts': 'export const value = "old";\n',
    });
    let nowMs = Date.parse('2026-05-21T00:00:00.000Z');
    const commandRunner: ZavorthSpeculativeCommandRunner = jest.fn(async (input) => {
      nowMs += 2_000;
      return {
        command: input.command,
        status: 'failed',
        exitCode: 1,
        stdout: '',
        stderr: 'validation failed',
        durationMs: 2000,
      };
    });
    const correctionProvider = jest.fn(async () => ({
      writes: [{ path: 'src/a.ts', content: 'export const value = "good";\n' }],
      summary: 'should not run',
    }));
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      commandRunner,
      now: () => new Date(nowMs),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Atualize com budget curto',
      runId: 'run-budget',
      writes: [{ path: 'src/a.ts', content: 'export const value = "bad";\n' }],
      validationCommands: ['npm run runtime:check -- --pretty false'],
      validationMode: 'provided',
      maxCorrectionRounds: 1,
      timeBudgetMs: 1_000,
      correctionProvider,
    });

    expect(result.status).toBe('blocked');
    expect(result.autoHealing.timedOut).toBe(true);
    expect(result.autoHealing.elapsedMs).toBeGreaterThanOrEqual(2_000);
    expect(result.receipts).toContain('auto-healing-budget-exhausted');
    expect(result.finalAttempt?.summary).toContain('budget de tempo excedido');
    expect(correctionProvider).not.toHaveBeenCalled();
  });

  it('does not follow symlinks while copying or diffing the speculative workspace', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const outsideSecret = path.join(root, '..', 'outside-secret.ts');
    const symlinkPath = path.join(root, 'src', 'linked-secret.ts');
    fs.writeFileSync(outsideSecret, 'export const leaked = "outside";\n', 'utf8');

    try {
      fs.symlinkSync(outsideSecret, symlinkPath, 'file');
    } catch {
      return;
    }

    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane: null,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Tente editar um symlink',
      runId: 'run-symlink',
      writes: [{ path: 'src/linked-secret.ts', content: 'export const linked = "new";\n' }],
      validationMode: 'skip',
    });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('symlink');
    expect(fs.readFileSync(outsideSecret, 'utf8')).toContain('"outside"');
  });

  it('blocks traversal writes and does not create a mutation plan', async () => {
    const root = makeWorkspace({
      'src/a.ts': 'export const value = "old";\n',
    });
    const mutationPlane = new ZavorthMutationPlaneService({
      plansDir: path.join(root, '..', 'plans'),
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });
    const service = new ZavorthSpeculativeAutonomyService({
      runRoot: path.join(root, '..', 'runs'),
      mutationPlane,
      now: () => new Date('2026-05-21T00:00:00.000Z'),
    });

    const result = await service.prepare({
      workspaceRoot: root,
      task: 'Tentativa de escapar',
      runId: 'run-blocked',
      writes: [{ path: '../escape.ts', content: 'export const escaped = true;\n' }],
      validationMode: 'skip',
    });

    expect(result.status).toBe('blocked');
    expect(result.mutationPlan).toBeNull();
    expect(fs.existsSync(path.join(root, '..', 'escape.ts'))).toBe(false);
  });
});

function makeWorkspace(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-spec-'));
  const workspace = path.join(root, 'workspace');
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return workspace;
}
