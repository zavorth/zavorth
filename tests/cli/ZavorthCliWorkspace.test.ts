import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ZavorthCli } from '../../src/cli/ZavorthCli';
import { ProjectManifestLoader } from '../../src/project-workspace/index';

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-workspace-'));
}

function createCli(writes: string[], errors: string[] = []): ZavorthCli {
  return new ZavorthCli({
    runtime: {
      commandService: { maybeHandle: jest.fn(async () => false) },
      gatewayService: {
        buildHydratedSnapshot: jest.fn(async () => ({
          summary: {},
          narrative: { headline: 'stub', operatorSummary: 'stub' },
        })),
      },
    } as any,
    writer: {
      line: (text) => writes.push(text),
      error: (text) => errors.push(text),
    },
  });
}

describe('Zavorth CLI workspace commands', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('workspace init creates a valid zavorth.yml manifest', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const writes: string[] = [];
    const cli = createCli(writes);

    const exitCode = await cli.run(['workspace', 'init', '--cwd', root, '--template', 'node-web', '--json']);

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    const manifestPath = path.join(root, 'zavorth.yml');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      action: 'init',
      manifestPath,
    }));
    expect(fs.existsSync(manifestPath)).toBe(true);
    const resolved = new ProjectManifestLoader().loadFromFile(manifestPath);
    expect(resolved.manifest.project.name).toBe(path.basename(root));
    expect(resolved.manifest.processes.map((process) => process.id)).toEqual(['app', 'tests']);
  });

  it('workspace doctor and status read the manifest without starting processes', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const writes: string[] = [];
    const cli = createCli(writes);
    await cli.run(['workspace', 'init', '--cwd', root, '--json']);
    writes.splice(0);

    const doctorExitCode = await cli.run(['workspace', 'doctor', '--cwd', root, '--json']);
    const statusExitCode = await cli.run(['workspace', 'status', '--cwd', root, '--json']);

    expect(doctorExitCode).toBe(0);
    expect(statusExitCode).toBe(0);
    const doctor = JSON.parse(writes[0] || '{}');
    const status = JSON.parse(writes[1] || '{}');
    expect(doctor.doctor).toEqual(expect.objectContaining({
      status: 'ready',
      processes: 2,
      hooks: 1,
    }));
    expect(status.snapshot.summary).toEqual(expect.objectContaining({
      processes: 2,
      hooks: 1,
      running: 0,
    }));
  });

  it('workspace up stays approval-gated by default', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const writes: string[] = [];
    const errors: string[] = [];
    const cli = createCli(writes, errors);
    await cli.run(['workspace', 'init', '--cwd', root, '--json']);
    writes.splice(0);

    const exitCode = await cli.run(['workspace', 'up', '--cwd', root, '--json']);

    expect(exitCode).toBe(1);
    const payload = JSON.parse(errors[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: false,
      action: 'up',
      approvalRequired: true,
      approvalSatisfied: false,
    }));
    expect(payload.result).toEqual(expect.objectContaining({
      status: 'approval_required',
    }));
  });

  it('workspace restart dry-run returns a governed action plan', async () => {
    const root = createTempProject();
    tempRoots.push(root);
    const writes: string[] = [];
    const cli = createCli(writes);
    await cli.run(['workspace', 'init', '--cwd', root, '--json']);
    writes.splice(0);

    const exitCode = await cli.run(['workspace', 'restart', 'app', '--cwd', root, '--dry-run', '--json']);

    expect(exitCode).toBe(0);
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      action: 'restart',
      dryRun: true,
      approvalRequired: true,
    }));
    expect(payload.plan).toEqual(expect.objectContaining({
      action: 'restart',
      processId: 'app',
      targets: ['app'],
    }));
  });
});
