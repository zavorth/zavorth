#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import type {
  RemoteMeshSandboxComponent,
  RemoteMeshSandboxProbe,
  RemoteMeshSandboxReadinessInput,
  RemoteMeshSandboxReadinessSnapshot,
} from '../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { RemoteMeshSandboxReadinessService } from '../src/services/RemoteMeshSandboxReadinessService.js';

type CommandResult = {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: string | null;
  timedOut: boolean;
};

const args = process.argv.slice(2);
const json = hasFlag('--json');
const noLiveProbes = hasFlag('--no-live-probes');
const requireReady = hasFlag('--require-ready');
const requirePass = hasFlag('--require-pass');
const target =
  valueFor('--target') ||
  process.env.ZAVORTH_REMOTE_MESH_TARGET ||
  process.env.ZAVORTH_REMOTE_NOTEBOOK_TARGET ||
  null;

const input: RemoteMeshSandboxReadinessInput = {
  target: {
    nodeId: target,
    expectedTailnetName: process.env.ZAVORTH_TAILNET_NAME || null,
    expectedPorts: [22],
  },
  probes: noLiveProbes ? buildNoLiveProbeSet() : buildLocalProbeSet(target),
};

const snapshot = new RemoteMeshSandboxReadinessService().buildSnapshot(input);

if (json) {
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} else {
  process.stdout.write(renderSnapshot(snapshot));
}

if ((requireReady && snapshot.status !== 'ready') || (requirePass && snapshot.status === 'blocked')) {
  process.exitCode = 1;
}

function buildNoLiveProbeSet(): RemoteMeshSandboxReadinessInput['probes'] {
  return {
    'policy-guardrails': probe('policy-guardrails', true, 'R0 no-live-probes mode: unsafe authority is disabled by policy.', null),
  };
}

function buildLocalProbeSet(targetNode: string | null): RemoteMeshSandboxReadinessInput['probes'] {
  const probes: RemoteMeshSandboxReadinessInput['probes'] = {
    'policy-guardrails': probe(
      'policy-guardrails',
      true,
      'R0 probes are local/read-only and do not execute remote commands or mutate hosts.',
      null,
    ),
  };

  const tailscaleVersion = run('tailscale', ['--version']);
  probes['tailscale-cli'] = commandProbe(
    'tailscale-cli',
    tailscaleVersion,
    'Tailscale CLI is available.',
    'Tailscale CLI was not found.',
  );

  if (probes['tailscale-cli']?.observed) {
    const status = run('tailscale', ['status', '--json'], 5000);
    probes['tailscale-status'] = tailscaleStatusProbe(status);

    if (targetNode) {
      const route = run('tailscale', ['ping', '--c', '1', targetNode], 8000);
      probes['tailscale-peer-route'] = tailscaleRouteProbe(route, targetNode);
    }
  }

  const sshVersion = run('ssh', ['-V']);
  probes['ssh-cli'] = commandProbe(
    'ssh-cli',
    sshVersion,
    'SSH client is available.',
    'SSH client was not found.',
  );

  probes['mcp-config'] = mcpConfigProbe(process.cwd());
  probes['termux-environment'] = termuxProbe();

  const proot = run('proot-distro', ['--version']);
  probes['proot-distro-cli'] = commandProbe(
    'proot-distro-cli',
    proot,
    'proot-distro CLI is available.',
    'proot-distro CLI was not found.',
  );

  const dockerVersion = run('docker', ['--version']);
  probes['docker-cli'] = commandProbe(
    'docker-cli',
    dockerVersion,
    'Docker CLI is available.',
    'Docker CLI was not found.',
  );

  if (probes['docker-cli']?.observed) {
    probes['docker-rootless'] = dockerRootlessProbe();
  }

  return probes;
}

function commandProbe(
  component: RemoteMeshSandboxComponent,
  result: CommandResult,
  okEvidence: string,
  missingEvidence: string,
): RemoteMeshSandboxProbe {
  const output = compactOutput(result);
  return probe(
    component,
    result.exitCode === 0,
    result.exitCode === 0 ? `${okEvidence}${output ? ` ${output}` : ''}` : missingEvidence,
    result.command,
    result.error ? [result.error] : [],
  );
}

function tailscaleStatusProbe(result: CommandResult): RemoteMeshSandboxProbe {
  if (result.exitCode !== 0) {
    return probe(
      'tailscale-status',
      false,
      'Tailscale status could not be read.',
      result.command,
      compactOutput(result) ? [compactOutput(result)] : [],
    );
  }

  try {
    const parsed = JSON.parse(result.stdout || '{}') as {
      BackendState?: string;
      Self?: { Online?: boolean; HostName?: string; TailscaleIPs?: string[] };
      Peer?: Record<string, unknown>;
    };
    const peerCount = Object.keys(parsed.Peer || {}).length;
    const online = parsed.Self?.Online === true || parsed.BackendState === 'Running';
    return {
      ...probe(
        'tailscale-status',
        true,
        `Tailscale status was read for ${parsed.Self?.HostName || 'this node'} with ${peerCount} peer(s).`,
        result.command,
        [`backend=${parsed.BackendState || 'unknown'}`, `peerCount=${peerCount}`],
      ),
      authenticated: online,
    };
  } catch {
    return probe(
      'tailscale-status',
      true,
      'Tailscale status returned output, but it was not parseable as JSON.',
      result.command,
      [redact(result.stdout).slice(0, 240)],
    );
  }
}

function tailscaleRouteProbe(result: CommandResult, targetNode: string): RemoteMeshSandboxProbe {
  const output = compactOutput(result);
  const normalized = output.toLowerCase();
  const direct = normalized.includes('direct');
  const relay = normalized.includes('derp') || normalized.includes('relay');
  const latency = /(\d+(?:\.\d+)?)\s*ms/i.exec(output)?.[1] || null;

  return {
    ...probe(
      'tailscale-peer-route',
      result.exitCode === 0,
      result.exitCode === 0
        ? `Route measurement to ${targetNode} completed.${output ? ` ${output}` : ''}`
        : `Route measurement to ${targetNode} failed.`,
      result.command,
      output ? [output] : [],
      relay && !direct ? ['Tailscale route appears to use DERP or relay.'] : [],
    ),
    directConnection: direct,
    relayConnection: relay,
    latencyMs: latency ? Number(latency) : null,
  };
}

function mcpConfigProbe(root: string): RemoteMeshSandboxProbe {
  const candidates = [
    join(root, 'config', 'mcp.json'),
    join(root, 'config', 'mcp-servers.json'),
    join(root, '.zavorth', 'mcp.json'),
    join(root, 'zavorth.mcp.json'),
  ];
  const found = candidates.filter((candidate) => existsSync(candidate));

  if (found.length === 0) {
    return probe('mcp-config', false, 'No local MCP configuration file was found.', null);
  }

  const snippets = found.map((file) => safeReadSnippet(file)).join('\n');
  const lower = snippets.toLowerCase();
  const freeformShell =
    lower.includes('shell.run') ||
    lower.includes('system.exec') ||
    lower.includes('"exec"') ||
    lower.includes('sudo.run');
  const unauthenticated =
    lower.includes('"auth":false') ||
    lower.includes('"auth": false') ||
    lower.includes('"unauthenticated":true') ||
    lower.includes('"unauthenticated": true');

  return {
    ...probe(
      'mcp-config',
      true,
      `Observed ${found.length} MCP config file(s): ${found.map((file) => redactPath(file)).join(', ')}.`,
      null,
      found.map((file) => `config=${redactPath(file)}`),
      [
        ...(freeformShell ? ['MCP config appears to expose shell/system execution.'] : []),
        ...(unauthenticated ? ['MCP config appears to allow unauthenticated access.'] : []),
      ],
    ),
    authenticated: unauthenticated ? false : null,
    freeformShellExposed: freeformShell,
    unauthenticatedMcpExposed: unauthenticated,
  };
}

function termuxProbe(): RemoteMeshSandboxProbe {
  const prefix = process.env.PREFIX || '';
  const termuxVersion = process.env.TERMUX_VERSION || '';
  const envLooksLikeTermux = prefix.includes('/com.termux/') || prefix.includes('com.termux') || Boolean(termuxVersion);

  if (envLooksLikeTermux) {
    return probe(
      'termux-environment',
      true,
      'Termux-like environment variables are present.',
      null,
      [`PREFIX=${redact(prefix) || 'set'}`, termuxVersion ? 'TERMUX_VERSION=set' : 'TERMUX_VERSION=unset'],
    );
  }

  const termuxInfo = run('termux-info', []);
  return commandProbe(
    'termux-environment',
    termuxInfo,
    'Termux tooling is available.',
    'Termux environment was not detected on this node.',
  );
}

function dockerRootlessProbe(): RemoteMeshSandboxProbe {
  const info = run('docker', ['info', '--format', '{{json .SecurityOptions}}'], 7000);
  const output = compactOutput(info);
  const rootless = output.toLowerCase().includes('rootless');
  const dockerGroupPrivilegeDetected = currentUserHasDockerGroup();

  return {
    ...probe(
      'docker-rootless',
      info.exitCode === 0,
      info.exitCode === 0
        ? `Docker security options were read.${output ? ` ${output}` : ''}`
        : 'Docker rootless status could not be read from the local Docker daemon.',
      info.command,
      [
        ...(output ? [output] : []),
        dockerGroupPrivilegeDetected ? 'currentUserGroup=docker' : 'currentUserGroup=docker-not-observed',
      ],
      dockerGroupPrivilegeDetected ? ['Current user appears to belong to the docker group.'] : [],
    ),
    rootless,
    dockerGroupPrivilegeDetected,
  };
}

function currentUserHasDockerGroup(): boolean {
  if (process.platform === 'win32') {
    return false;
  }

  const groups = run('id', ['-nG']);
  return groups.exitCode === 0 && groups.stdout.split(/\s+/).includes('docker');
}

function probe(
  component: RemoteMeshSandboxComponent,
  observed: boolean,
  evidence: string,
  command: string | null,
  details: string[] = [],
  risks: string[] = [],
): RemoteMeshSandboxProbe {
  return {
    component,
    observed,
    evidence,
    command,
    details,
    risks,
    mutationPerformed: false,
    secretsSerialized: false,
  };
}

function run(command: string, commandArgs: string[], timeoutMs = 3000): CommandResult {
  const commandLabel = [command, ...commandArgs].join(' ');
  try {
    const result = spawnSync(command, commandArgs, {
      encoding: 'utf8',
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 256 * 1024,
    });

    return {
      command: commandLabel,
      exitCode: typeof result.status === 'number' ? result.status : null,
      stdout: redact(result.stdout || ''),
      stderr: redact(result.stderr || ''),
      error: result.error ? redact(result.error.message) : null,
      timedOut: Boolean(result.error && result.error.message.toLowerCase().includes('timed out')),
    };
  } catch (error) {
    return {
      command: commandLabel,
      exitCode: null,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? redact(error.message) : 'unknown spawn error',
      timedOut: false,
    };
  }
}

function compactOutput(result: CommandResult): string {
  return redact([result.stdout.trim(), result.stderr.trim()].filter(Boolean).join(' ')).replace(/\s+/g, ' ').slice(0, 500);
}

function safeReadSnippet(file: string): string {
  try {
    return redact(readFileSync(file, 'utf8').slice(0, 64 * 1024));
  } catch {
    return '';
  }
}

function redactPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^.*?(\/(?:config|\.zavorth)\/)/i, '$1');
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, 'sk-[redacted]')
    .replace(/xox[baprs]-[A-Za-z0-9-]{12,}/g, 'xox-[redacted]')
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(authorization:\s*bearer\s+)[^\s]+/gi, '$1[redacted]');
}

function renderSnapshot(snapshot: RemoteMeshSandboxReadinessSnapshot): string {
  const lines = [
    `Zavorth Remote Mesh Sandbox R0: ${snapshot.status}`,
    `checks=${snapshot.summary.checks} passed=${snapshot.summary.passed} warnings=${snapshot.summary.warnings} missing=${snapshot.summary.missing} blocked=${snapshot.summary.blocked}`,
    `target=${snapshot.target.nodeId || 'not-configured'} direct=${snapshot.summary.directRouteObserved} relay=${snapshot.summary.relayRouteObserved}`,
    '',
  ];

  for (const check of snapshot.checks) {
    lines.push(`[${check.status}] ${check.component}: ${check.evidence}`);
    for (const risk of check.risks) {
      lines.push(`  risk: ${risk}`);
    }
  }

  lines.push('', 'Next actions:');
  snapshot.nextActions.forEach((action) => lines.push(`- ${action}`));
  return `${lines.join('\n')}\n`;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function valueFor(flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}
