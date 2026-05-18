#!/usr/bin/env node

import { ZavorthExternalAgentOnboardingService } from '../src/services/ZavorthExternalAgentOnboardingService.js';

type CliOptions = {
  json: boolean;
  requirePass: boolean;
  consent: boolean;
  writeSnapshot: boolean;
  pathHint: string | null;
  approximatePathHint: string | null;
  commandHint: string | null;
  endpointHint: string | null;
  requestedBy: string | null;
  maxDepth: number | null;
  materializeCandidateId: string | null;
  approveRegistration: boolean;
  enableLive: boolean;
  commandOverride: string | null;
  argsOverride: string[] | null;
  endpointOverride: string | null;
  isolation: 'local-supervised' | 'wsl' | 'docker' | null;
  dockerImage: string | null;
  wslDistro: string | null;
  requireStrongIsolation: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  return {
    json: argv.includes('--json'),
    requirePass: argv.includes('--require-pass') || argv.includes('--strict'),
    consent: argv.includes('--consent') || argv.includes('--read-only-consent'),
    writeSnapshot: !argv.includes('--no-write'),
    pathHint: readFlexibleStringFlag(argv, 'path'),
    approximatePathHint: readFlexibleStringFlag(argv, 'approx-path') || readFlexibleStringFlag(argv, 'approximate-path'),
    commandHint: readFlexibleStringFlag(argv, 'command') || readFlexibleStringFlag(argv, 'cli'),
    endpointHint: readFlexibleStringFlag(argv, 'endpoint') || readFlexibleStringFlag(argv, 'url'),
    requestedBy: readFlexibleStringFlag(argv, 'requested-by') || readFlexibleStringFlag(argv, 'user-id'),
    maxDepth: readNumberFlag(argv, 'max-depth'),
    materializeCandidateId: readFlexibleStringFlag(argv, 'materialize-candidate') || (argv.includes('--materialize-first') ? 'first' : null),
    approveRegistration: argv.includes('--approve-registration') || argv.includes('--approve'),
    enableLive: argv.includes('--enable-live'),
    commandOverride: readFlexibleStringFlag(argv, 'profile-command') || readFlexibleStringFlag(argv, 'cmd'),
    argsOverride: parseArgsArray(readFlexibleStringFlag(argv, 'profile-args-json') || readFlexibleStringFlag(argv, 'args-json')),
    endpointOverride: readFlexibleStringFlag(argv, 'profile-endpoint'),
    isolation: normalizeIsolation(readFlexibleStringFlag(argv, 'isolation')),
    dockerImage: readFlexibleStringFlag(argv, 'docker-image') || readFlexibleStringFlag(argv, 'sandbox-image'),
    wslDistro: readFlexibleStringFlag(argv, 'wsl-distro'),
    requireStrongIsolation: argv.includes('--require-strong-isolation'),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write([
      'External Agent Onboarding',
      '',
      'Usage:',
      '  zavorth external-agent-onboarding',
      '  zavorth external-agent-onboarding --path <path> --consent',
      '  zavorth external-agent-onboarding --approx-path <path> --consent',
      '  zavorth external-agent-onboarding --command <cli> --consent',
      '  zavorth external-agent-onboarding --endpoint <url> --consent',
      '  zavorth external-agent-onboarding --command claude --consent --materialize-first --approve-registration --enable-live',
      '',
      'Safety:',
      '  No automatic discovery runs by default.',
      '  --consent allows only read-only inspection of the declared scope.',
      '  No process, tool, WSL, Docker, port scan, or network probe is executed.',
      '  --materialize-first registers only a gateway profile and still performs no invocation.',
      '',
      'Options:',
      '  --json',
      '  --no-write',
      '  --require-pass',
      '  --max-depth=N',
      '',
    ].join('\n'));
    return;
  }

  const options = parseArgs(args);
  const service = new ZavorthExternalAgentOnboardingService();
  if (options.materializeCandidateId) {
    const result = service.materializeGatewayProfile({
      consent: options.consent,
      pathHint: options.pathHint,
      approximatePathHint: options.approximatePathHint,
      commandHint: options.commandHint,
      endpointHint: options.endpointHint,
      requestedBy: options.requestedBy,
      maxDepth: options.maxDepth,
      writeSnapshot: options.writeSnapshot,
      candidateId: options.materializeCandidateId === 'first' ? null : options.materializeCandidateId,
      approveRegistration: options.approveRegistration,
      enableLive: options.enableLive,
      commandOverride: options.commandOverride,
      argsOverride: options.argsOverride,
      endpointOverride: options.endpointOverride,
      isolation: options.isolation,
      dockerImage: options.dockerImage,
      wslDistro: options.wslDistro,
      requireStrongIsolation: options.requireStrongIsolation,
    });
    process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : service.renderMaterializeText(result));
    if (options.requirePass && result.status !== 'registered' && result.status !== 'approval-required') {
      process.exitCode = 1;
    }
    return;
  }

  const snapshot = service.buildSnapshot({
    consent: options.consent,
    pathHint: options.pathHint,
    approximatePathHint: options.approximatePathHint,
    commandHint: options.commandHint,
    endpointHint: options.endpointHint,
    requestedBy: options.requestedBy,
    maxDepth: options.maxDepth,
    writeSnapshot: options.writeSnapshot,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  if (
    options.requirePass
    && snapshot.status !== 'ready-for-review'
    && snapshot.status !== 'needs-user-hint'
  ) {
    process.exitCode = 1;
  }
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

function parseArgsArray(rawValue: string | null): string[] | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return rawValue.split(/\s+/).filter(Boolean);
  }
}

function normalizeIsolation(value: string | null): 'local-supervised' | 'wsl' | 'docker' | null {
  if (value === 'docker' || value === 'wsl') return value;
  if (value === 'local' || value === 'local-supervised') return 'local-supervised';
  return null;
}

main().catch((error) => {
  console.error(`[zavorth-external-agent-onboarding] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
