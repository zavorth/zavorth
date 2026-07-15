#!/usr/bin/env node

import { ZavorthExternalAgentGatewayService } from '../src/services/ZavorthExternalAgentGatewayService.js';
import type {
  ZavorthExternalAgentAdapterKind,
  ZavorthExternalAgentIsolationKind,
  ZavorthExternalAgentNetworkMode,
} from '../src/contracts/ZavorthExternalAgentGatewayContract.js';

type CliOptions = {
  action: string;
  json: boolean;
  id: string | null;
  label: string | null;
  adapter: ZavorthExternalAgentAdapterKind | null;
  root: string | null;
  command: string | null;
  args: string[];
  endpoint: string | null;
  prompt: string | null;
  promptMode: 'stdin' | 'arg' | 'json' | null;
  approvalRegistration: boolean;
  approvalExecution: boolean;
  enableLive: boolean;
  allowRemoteNetwork: boolean;
  isolation: ZavorthExternalAgentIsolationKind | null;
  dockerImage: string | null;
  wslDistro: string | null;
  workspaceMount: string | null;
  sandboxWorkdir: string | null;
  network: ZavorthExternalAgentNetworkMode | null;
  readOnlyRoot: boolean;
  requireStrongIsolation: boolean;
  dryRun: boolean;
  timeoutMs: number | null;
  consent: boolean;
  capabilitiesFile: string | null;
  skillId: string | null;
  allowedCapabilities: string[];
};

function parseArgs(argv: string[]): CliOptions {
  const action = String(argv[0] || 'list')
    .trim()
    .toLowerCase();
  const knownActions = new Set([
    'register',
    'run',
    'invoke',
    'list',
    'list-capabilities',
    'capabilities',
    'import-capabilities',
    'import-caps',
    'import',
  ]);
  const args = knownActions.has(action) ? argv.slice(1) : argv;
  return {
    action: knownActions.has(action) ? action : 'list',
    json: args.includes('--json'),
    id: readFlexibleStringFlag(args, 'id'),
    label: readFlexibleStringFlag(args, 'label'),
    adapter: normalizeAdapter(readFlexibleStringFlag(args, 'adapter')),
    root: readFlexibleStringFlag(args, 'root') || readFlexibleStringFlag(args, 'cwd'),
    command: readFlexibleStringFlag(args, 'command') || readFlexibleStringFlag(args, 'cmd'),
    args: parseArgsArray(readFlexibleStringFlag(args, 'args-json'), readFlexibleStringFlag(args, 'args')),
    endpoint: readFlexibleStringFlag(args, 'endpoint') || readFlexibleStringFlag(args, 'url'),
    prompt: readFlexibleStringFlag(args, 'prompt') || readFlexibleStringFlag(args, 'message'),
    promptMode: normalizePromptMode(readFlexibleStringFlag(args, 'prompt-mode')),
    approvalRegistration: args.includes('--approve-registration') || args.includes('--approve'),
    approvalExecution:
      args.includes('--approve-external-execution') || args.includes('--approve-run') || args.includes('--approve'),
    enableLive: args.includes('--enable-live'),
    allowRemoteNetwork: args.includes('--allow-remote-network'),
    isolation: normalizeIsolation(readFlexibleStringFlag(args, 'isolation') || readFlexibleStringFlag(args, 'sandbox')),
    dockerImage: readFlexibleStringFlag(args, 'docker-image') || readFlexibleStringFlag(args, 'sandbox-image'),
    wslDistro: readFlexibleStringFlag(args, 'wsl-distro'),
    workspaceMount: readFlexibleStringFlag(args, 'workspace-mount') || readFlexibleStringFlag(args, 'mount'),
    sandboxWorkdir:
      readFlexibleStringFlag(args, 'sandbox-workdir') || readFlexibleStringFlag(args, 'container-workdir'),
    network: normalizeNetwork(readFlexibleStringFlag(args, 'network')),
    readOnlyRoot: args.includes('--read-only-root'),
    requireStrongIsolation: args.includes('--require-strong-isolation'),
    dryRun: args.includes('--dry-run'),
    timeoutMs: readNumberFlag(args, 'timeout-ms'),
    consent: args.includes('--consent') || args.includes('--yes'),
    capabilitiesFile: readFlexibleStringFlag(args, 'capabilities-file') || readFlexibleStringFlag(args, 'caps-file'),
    skillId: readFlexibleStringFlag(args, 'skill-id') || readFlexibleStringFlag(args, 'skill'),
    allowedCapabilities: parseArgsArray(
      readFlexibleStringFlag(args, 'capabilities-json'),
      readFlexibleStringFlag(args, 'capabilities'),
    ),
  };
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    process.stdout.write(
      [
        'External Agent Gateway',
        '',
        'Usage:',
        '  zavorth external-agent list',
        '  zavorth external-agent register --id my-agent --adapter cli|http|acp|mcp --command … --approve-registration --enable-live',
        '  zavorth external-agent register --id safe-agent --adapter cli --command agent --isolation docker --docker-image my-agent:latest --approve-registration --enable-live',
        '  zavorth external-agent register --id local-acp --adapter acp --approve-registration --enable-live',
        '  zavorth external-agent run --id my-agent --prompt "review this module" --approve-external-execution',
        '  zavorth external-agent list-capabilities --id my-agent [--capabilities-file path]',
        '  zavorth external-agent import-capabilities --id my-agent --consent [--skill-id name]',
        '',
        'Safety:',
        '  Registration previews unless --approve-registration is present.',
        '  Invocation previews unless --approve-external-execution is present.',
        '  Capability list/import is offline (no process spawn); live invoke stays approval-gated.',
        '  Import requires --consent and writes a SkillIR pack under skills/ (never auto-import).',
        '  CLI runs use spawn without shell interpolation and receive a reduced environment.',
        '  Untrusted CLI profiles can require strong isolation via --require-strong-isolation and --isolation docker|wsl.',
        '  HTTP/MCP remote network endpoints are blocked unless --allow-remote-network is set on registration.',
        '',
      ].join('\n'),
    );
    return;
  }

  const options = parseArgs(rawArgs);
  const service = new ZavorthExternalAgentGatewayService();

  if (options.action === 'register') {
    const receipt = service.registerProfile({
      id: options.id,
      label: options.label,
      adapter: options.adapter,
      root: options.root,
      command: options.command,
      args: options.args,
      endpoint: options.endpoint,
      promptMode: options.promptMode,
      allowedCapabilities: options.allowedCapabilities.length ? options.allowedCapabilities : undefined,
      enableLive: options.enableLive,
      allowRemoteNetwork: options.allowRemoteNetwork,
      isolation: options.isolation,
      dockerImage: options.dockerImage,
      wslDistro: options.wslDistro,
      workspaceMount: options.workspaceMount,
      sandboxWorkdir: options.sandboxWorkdir,
      network: options.network,
      readOnlyRoot: options.readOnlyRoot,
      requireStrongIsolation: options.requireStrongIsolation,
      approvalGranted: options.approvalRegistration,
      requestedBy: 'cli-operator',
    });
    process.stdout.write(
      options.json ? `${JSON.stringify(receipt, null, 2)}\n` : `${service.renderReceiptText(receipt)}\n`,
    );
    return;
  }

  if (options.action === 'run' || options.action === 'invoke') {
    const receipt = await service.invoke({
      profileId: options.id || '',
      prompt: options.prompt || '',
      approvalGranted: options.approvalExecution,
      dryRun: options.dryRun || !options.approvalExecution,
      timeoutMs: options.timeoutMs,
      requestedBy: 'cli-operator',
    });
    process.stdout.write(
      options.json ? `${JSON.stringify(receipt, null, 2)}\n` : `${service.renderReceiptText(receipt)}\n`,
    );
    return;
  }

  if (options.action === 'list-capabilities' || options.action === 'capabilities') {
    if (!options.id) {
      process.stderr.write('Usage: zavorth external-agent list-capabilities --id <profile>\n');
      process.exitCode = 1;
      return;
    }
    const listed = service.listCapabilities({
      profileId: options.id,
      capabilitiesFile: options.capabilitiesFile,
    });
    process.stdout.write(options.json ? `${JSON.stringify(listed, null, 2)}\n` : `${listed.formatText()}\n`);
    if (!listed.ok) process.exitCode = 1;
    return;
  }

  if (options.action === 'import-capabilities' || options.action === 'import-caps' || options.action === 'import') {
    if (!options.id) {
      process.stderr.write('Usage: zavorth external-agent import-capabilities --id <profile> --consent\n');
      process.exitCode = 1;
      return;
    }
    const imported = service.importCapabilities({
      profileId: options.id,
      consent: options.consent,
      capabilitiesFile: options.capabilitiesFile,
      skillId: options.skillId,
    });
    process.stdout.write(
      options.json ? `${JSON.stringify(imported.receipt, null, 2)}\n` : `${imported.formatText()}\n`,
    );
    if (!imported.ok) process.exitCode = 1;
    return;
  }

  const snapshot = service.buildRegistrySnapshot();
  process.stdout.write(options.json ? `${JSON.stringify(snapshot, null, 2)}\n` : service.renderRegistryText(snapshot));
}

function normalizeAdapter(value: string | null): ZavorthExternalAgentAdapterKind | null {
  if (value === 'cli' || value === 'http' || value === 'acp' || value === 'mcp') return value;
  return null;
}

function normalizeIsolation(value: string | null): ZavorthExternalAgentIsolationKind | null {
  if (value === 'docker' || value === 'wsl') return value;
  if (value === 'local' || value === 'local-supervised') return 'local-supervised';
  return null;
}

function normalizeNetwork(value: string | null): ZavorthExternalAgentNetworkMode | null {
  if (value === 'disabled' || value === 'local-only' || value === 'profile') return value;
  return null;
}

function normalizePromptMode(value: string | null): 'stdin' | 'arg' | 'json' | null {
  if (value === 'stdin' || value === 'arg' || value === 'json') return value;
  return null;
}

function parseArgsArray(jsonValue: string | null, rawValue: string | null): string[] {
  if (jsonValue) {
    try {
      const parsed = JSON.parse(jsonValue);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
    } catch {
      return [];
    }
  }
  return rawValue
    ? rawValue
        .split(/[\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function readNumberFlag(argv: string[], name: string): number | null {
  const raw = readFlexibleStringFlag(argv, name);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

main().catch((error) => {
  console.error(`[zavorth-external-agent-gateway] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
