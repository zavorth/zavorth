import type { RemoteMeshSandboxComponent, RemoteMeshSandboxProbe } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { RemoteMeshSandboxReadinessService } from '../../src/services/RemoteMeshSandboxReadinessService.js';

const makeProbe = (
  component: RemoteMeshSandboxComponent,
  overrides: Partial<RemoteMeshSandboxProbe> = {},
): RemoteMeshSandboxProbe => ({
  component,
  observed: true,
  evidence: `${component} observed`,
  command: null,
  mutationPerformed: false,
  secretsSerialized: false,
  ...overrides,
});

const readyProbes = (): Record<RemoteMeshSandboxComponent, RemoteMeshSandboxProbe> => ({
  'policy-guardrails': makeProbe('policy-guardrails'),
  'tailscale-cli': makeProbe('tailscale-cli', { command: 'tailscale --version' }),
  'tailscale-status': makeProbe('tailscale-status', {
    command: 'tailscale status --json',
    authenticated: true,
  }),
  'tailscale-peer-route': makeProbe('tailscale-peer-route', {
    command: 'tailscale ping --c 1 notebook',
    directConnection: true,
    relayConnection: false,
    latencyMs: 42,
  }),
  'ssh-cli': makeProbe('ssh-cli', { command: 'ssh -V' }),
  'mcp-config': makeProbe('mcp-config', {
    authenticated: true,
    freeformShellExposed: false,
    unauthenticatedMcpExposed: false,
  }),
  'termux-environment': makeProbe('termux-environment'),
  'proot-distro-cli': makeProbe('proot-distro-cli', { command: 'proot-distro --version' }),
  'docker-cli': makeProbe('docker-cli', { command: 'docker --version' }),
  'docker-rootless': makeProbe('docker-rootless', {
    command: 'docker info --format ...',
    rootless: true,
    dockerGroupPrivilegeDetected: false,
  }),
});

describe('RemoteMeshSandboxReadinessService R0', () => {
  it('builds a ready snapshot when mesh, mobile sandbox, scoped MCP, and rootless Docker are observed', () => {
    const snapshot = new RemoteMeshSandboxReadinessService({
      now: () => new Date('2026-05-05T12:00:00.000Z'),
    }).buildSnapshot({
      target: {
        nodeId: 'notebook',
        expectedTailnetName: 'zavorth-tailnet',
        expectedPorts: [22],
      },
      probes: readyProbes(),
    });

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r0');
    expect(snapshot.phase).toBe('R0');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        checks: 10,
        passed: 10,
        blocked: 0,
        directRouteObserved: true,
        relayRouteObserved: false,
        remoteMutationPerformed: false,
        remoteExecutionRequiredToBuildSnapshot: false,
        freeformShellAllowed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        allowRemoteMutationDuringReadiness: false,
        allowFreeformShell: false,
        allowUnauthenticatedMcp: false,
        allowDockerGroupPrivilege: false,
      }),
    );
    expect(snapshot.receipts).toHaveLength(10);
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
  });

  it('keeps early desktop-only probes as attention instead of pretending mobile sandbox is ready', () => {
    const snapshot = new RemoteMeshSandboxReadinessService().buildSnapshot({
      probes: {
        'policy-guardrails': makeProbe('policy-guardrails'),
        'tailscale-cli': makeProbe('tailscale-cli'),
        'tailscale-status': makeProbe('tailscale-status', { authenticated: true }),
        'ssh-cli': makeProbe('ssh-cli'),
      },
    });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.blocked).toBe(0);
    expect(snapshot.checks.find((check) => check.component === 'tailscale-peer-route')).toEqual(
      expect.objectContaining({
        status: 'not-required',
        evidence: 'No target node was configured for route measurement.',
      }),
    );
    expect(snapshot.checks.find((check) => check.component === 'termux-environment')?.status).toBe('warning');
    expect(snapshot.checks.find((check) => check.component === 'proot-distro-cli')?.status).toBe('warning');
  });

  it('blocks MCP configs that expose freeform shell or unauthenticated transports', () => {
    const probes = readyProbes();
    probes['mcp-config'] = makeProbe('mcp-config', {
      evidence: 'Unsafe MCP config observed',
      freeformShellExposed: true,
      unauthenticatedMcpExposed: true,
      authenticated: false,
    });

    const snapshot = new RemoteMeshSandboxReadinessService().buildSnapshot({
      target: { nodeId: 'notebook' },
      probes,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.blocked).toBe(2);
    expect(snapshot.checks.find((check) => check.component === 'policy-guardrails')).toEqual(
      expect.objectContaining({
        status: 'blocked',
      }),
    );
    expect(snapshot.checks.find((check) => check.component === 'mcp-config')).toEqual(
      expect.objectContaining({
        status: 'blocked',
      }),
    );
  });

  it('blocks root-equivalent Docker group authority unless policy explicitly allows it', () => {
    const probes = readyProbes();
    probes['docker-rootless'] = makeProbe('docker-rootless', {
      evidence: 'Docker group authority observed',
      rootless: false,
      dockerGroupPrivilegeDetected: true,
    });

    const snapshot = new RemoteMeshSandboxReadinessService().buildSnapshot({
      target: { nodeId: 'notebook' },
      probes,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.checks.find((check) => check.component === 'docker-rootless')).toEqual(
      expect.objectContaining({
        status: 'blocked',
      }),
    );
    expect(snapshot.nextActions).toContain(
      'Remove broad Docker group authority from the Zavorth executor user or switch to Docker rootless.',
    );
  });
});
