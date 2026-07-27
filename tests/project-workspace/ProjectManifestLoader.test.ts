import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ProjectManifestError,
  ProjectManifestLoader,
  ProjectWorkspaceService,
} from '../../src/project-workspace/index.js';

function createTempProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-project-manifest-'));
}

function writeManifest(root: string, content: string): string {
  const manifestPath = path.join(root, 'zavorth.yml');
  fs.writeFileSync(manifestPath, content.trimStart(), 'utf8');
  return manifestPath;
}

describe('ProjectManifestLoader', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('parses a valid manifest without starting any process', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const manifestPath = writeManifest(root, `
version: 1
project:
  name: demo
  root: .
  description: Demo workspace.
processes:
  ? id: app
    name: Web App
    command: npm run dev
    cwd: .
    restart: on-failure
    health:
      type: http
      url: http://localhost:3000
mcp:
  servers: []
agents:
  ? id: maintainer
    role: project-maintainer
    watches:
      ? app
    mode: suggest
hooks:
  ? id: app-error
    when:
      process: app
      pattern: "(FAIL|Error)"
    action:
      type: agent-run
      mode: suggest
      prompt: Diagnose the failure.
policy:
  defaultMode: suggest
  requireApprovalFor:
    ? filesystem.write
`);

    const resolved = new ProjectManifestLoader().loadFromFile(manifestPath);
    const snapshot = new ProjectWorkspaceService().buildSnapshot(resolved);

    expect(resolved.sideEffects).toBe('none');
    expect(resolved.manifest.project.name).toBe('demo');
    expect(resolved.manifest.processes[0]).toEqual(expect.objectContaining({
      id: 'app',
      restart: 'on-failure',
      health: { type: 'http', url: 'http://localhost:3000' },
    }));
    expect(resolved.processResolutions[0]).toEqual(expect.objectContaining({
      id: 'app',
      resolvedCwd: root,
      outsideProject: false,
    }));
    expect(snapshot).toEqual(expect.objectContaining({
      canonicalAgentLoop: 'ZavorthAgentGateway.handle',
      sideEffects: 'none',
      summary: expect.stringContaining('Loading the manifest is read-only'),
    }));
  });

  it('reports invalid manifests with a readable ProjectManifestError', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const manifestPath = writeManifest(root, `
version: 2
project:
  root: .
processes:
  ? id: app
    cwd: .
`);

    expect(() => new ProjectManifestLoader().loadFromFile(manifestPath)).toThrow(ProjectManifestError);
    try {
      new ProjectManifestLoader().loadFromFile(manifestPath);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ProjectManifestError);
      expect(String((error as Error).message)).toContain('version: expected 1');
      expect(String((error as Error).message)).toContain('project.name: required non-empty string');
      expect(String((error as Error).message)).toContain('processes[0].command: required non-empty string');
    }
  });

  it('prevents process cwd from escaping the project root unless explicitly allowed', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const manifestPath = writeManifest(root, `
version: 1
project:
  name: boundary
  root: project
  description: Boundary test.
processes:
  ? id: bad
    name: Bad
    command: npm test
    cwd: ../outside
`);
    fs.mkdirSync(path.join(root, 'project'));

    expect(() => new ProjectManifestLoader().loadFromFile(manifestPath)).toThrow(
      /must stay inside project\.root/,
    );

    const allowedPath = writeManifest(root, `
version: 1
project:
  name: boundary
  root: project
  description: Boundary test.
processes:
  ? id: external-tooling
    name: External Tooling
    command: npm test
    cwd: ../outside
    allowOutsideProject: true
`);

    const resolved = new ProjectManifestLoader().loadFromFile(allowedPath);
    expect(resolved.manifest.processes[0].allowOutsideProject).toBe(true);
    expect(resolved.processResolutions[0]).toEqual(expect.objectContaining({
      id: 'external-tooling',
      outsideProject: true,
    }));
  });

  it('applies defaults for mode, restart, policy and health', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const manifestPath = writeManifest(root, `
version: 1
project:
  name: defaults
  root: .
  description: Defaults test.
processes:
  ? id: tests
    name: Tests
    command: npm test
agents:
  ? id: maintainer
    role: project-maintainer
    watches:
      ? tests
hooks:
  ? id: test-failure
    when:
      process: tests
      pattern: FAIL
    action:
      type: agent-run
      prompt: Diagnose the failure.
`);

    const resolved = new ProjectManifestLoader().loadFromFile(manifestPath);

    expect(resolved.manifest.policy).toEqual({
      defaultMode: 'suggest',
      requireApprovalFor: [
        'filesystem.write',
        'process.kill',
        'network.public',
        'selfmod.apply',
      ],
    });
    expect(resolved.manifest.processes[0]).toEqual(expect.objectContaining({
      cwd: '.',
      restart: 'never',
      health: { type: 'none' },
    }));
    expect(resolved.manifest.agents[0].mode).toBe('suggest');
    expect(resolved.manifest.hooks[0].action.mode).toBe('suggest');
  });

  it('accepts manual mode for agents, hooks and policy defaults', () => {
    const root = createTempProject();
    tempRoots.push(root);
    const manifestPath = writeManifest(root, `
version: 1
project:
  name: manual-mode
  root: .
  description: Manual mode test.
processes:
  ? id: app
    name: App
    command: npm test
policy:
  defaultMode: manual
  requireApprovalFor:
    ? filesystem.write
agents:
  ? id: maintainer
    role: project-maintainer
    watches:
      ? app
hooks:
  ? id: app-error
    when:
      process: app
      pattern: Error
    action:
      type: agent-run
      prompt: Diagnose manually.
`);

    const resolved = new ProjectManifestLoader().loadFromFile(manifestPath);

    expect(resolved.manifest.policy.defaultMode).toBe('manual');
    expect(resolved.manifest.agents[0].mode).toBe('manual');
    expect(resolved.manifest.hooks[0].action.mode).toBe('manual');
  });

  it('loads the repository zavorth.yml from a nested cwd', () => {
    const nestedCwd = path.join(process.cwd(), 'src', 'project-workspace');

    const resolved = new ProjectManifestLoader().load({ cwd: nestedCwd });

    expect(resolved.manifest.project.name).toBe('zavorth-core');
    expect(resolved.manifestPath.endsWith('zavorth.yml')).toBe(true);
    expect(resolved.sideEffects).toBe('none');
  });

  it('validates Developer Workspace recipe examples', () => {
    const examplesRoot = path.join(process.cwd(), 'examples', 'workspaces');
    const manifestPaths = fs.readdirSync(examplesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(examplesRoot, entry.name, 'zavorth.yml'));

    expect(manifestPaths.length).toBeGreaterThanOrEqual(3);
    for (const manifestPath of manifestPaths) {
      const resolved = new ProjectManifestLoader().loadFromFile(manifestPath);
      expect(resolved.sideEffects).toBe('none');
      expect(resolved.manifest.processes.length).toBeGreaterThan(0);
      expect(resolved.manifest.hooks.length).toBeGreaterThan(0);
    }
  });
});
