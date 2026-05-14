#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { formatCliHelp, resolveCliHelpTopic } from './cli/ZavorthCliSurfaceHelpers.js';

const entryDir = path.dirname(path.resolve(process.argv[1] || process.cwd()));
const runningFromDist = path.basename(entryDir).toLowerCase() === 'dist';
const projectRoot = runningFromDist ? path.resolve(entryDir, '..') : path.resolve(entryDir, '..');

const PUBLIC_COMMAND_ALIASES: Record<string, string> = {
  ajuda: 'help',
  configurar: 'setup',
  iniciar: 'go',
  abrir: 'go',
  estado: 'status',
  diagnostico: 'doctor',
  diagnóstico: 'doctor',
  conversar: 'chat',
  terminal: 'chat',
};

function normalizePublicCommandAliases(rawArgs: string[]): string[] {
  const first = String(rawArgs[0] || '').trim().toLowerCase();
  const alias = PUBLIC_COMMAND_ALIASES[first];
  if (!alias) {
    return rawArgs;
  }
  return [alias, ...rawArgs.slice(1)];
}

const args = normalizePublicCommandAliases(process.argv.slice(2));

function spawnInherited(command: string, commandArgs: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: 'inherit',
      windowsHide: false,
    });
    child.on('exit', (code) => resolve(code || 0));
    child.on('error', reject);
  });
}

function npmInherited(commandArgs: string[], cwd: string): Promise<number> {
  if (process.platform === 'win32') {
    return spawnInherited('cmd.exe', ['/d', '/s', '/c', 'npm', ...commandArgs], cwd);
  }
  return spawnInherited('npm', commandArgs, cwd);
}

function printBuiltinHelp(target?: string | null): number {
  process.stdout.write(`${formatCliHelp(target)}\n`);
  return 0;
}

function printGeneralHelp(): number {
  process.stdout.write(`${formatCliHelp()}\n`);
  return 0;
}

function readNumberFlag(argv: string[], name: string): number | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  const raw = inline ? inline.slice(prefix.length) : null;
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readStringFlag(argv: string[], name: string): string | null {
  const prefix = `--${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function readFlexibleStringFlag(argv: string[], name: string): string | null {
  const inline = readStringFlag(argv, name);
  if (inline !== null) {
    return inline;
  }
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
}

function readDurationMsFlag(argv: string[], name: string): number | null {
  const raw = readStringFlag(argv, name);
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(\d+)(ms|s|m|h)?$/i);
  if (!match) {
    return readNumberFlag(argv, name);
  }
  const value = Number(match[1]);
  const unit = String(match[2] || 'ms').toLowerCase();
  const factor = unit === 'h' ? 60 * 60 * 1000 : unit === 'm' ? 60 * 1000 : unit === 's' ? 1000 : 1;
  return Number.isFinite(value) ? value * factor : null;
}

async function runRuntimeResourceDoctor(rawArgs: string[], strict: boolean): Promise<number> {
  const { RuntimeResourceBudgetService } = await import('./services/RuntimeResourceBudgetService.js');
  const service = new RuntimeResourceBudgetService();
  const asJson = rawArgs.includes('--json');
  const profileArg = rawArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const profile = service.resolveProfile(
    profileArg || process.env.ZAVORTH_RESOURCE_BUDGET_PROFILE || process.env.ZAVORTH_PROFILE,
  );
  const report = service.buildBudgetReport(profile, undefined, {
    ...(readNumberFlag(rawArgs, 'rss-mb') !== null ? { rssMb: readNumberFlag(rawArgs, 'rss-mb') as number } : {}),
    ...(readNumberFlag(rawArgs, 'heap-used-mb') !== null ? { heapUsedMb: readNumberFlag(rawArgs, 'heap-used-mb') as number } : {}),
    ...(readNumberFlag(rawArgs, 'active-handles') !== null ? { activeHandles: readNumberFlag(rawArgs, 'active-handles') as number } : {}),
    ...(readNumberFlag(rawArgs, 'active-requests') !== null ? { activeRequests: readNumberFlag(rawArgs, 'active-requests') as number } : {}),
    ...(readNumberFlag(rawArgs, 'loaded-cjs-modules') !== null ? { loadedCommonJsModules: readNumberFlag(rawArgs, 'loaded-cjs-modules') as number } : {}),
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const failedChecks = report.checks.filter((check) => !check.ok);
    process.stdout.write([
      '[zavorth-ops] runtime resource doctor',
      `[zavorth-ops] perfil: ${report.profile} | budget: ${report.ok ? 'ok' : 'violado'}`,
      `[zavorth-ops] memoria: rss ${report.snapshot.runtime.rssMb}/${report.thresholds.rssMb} MB | heap ${report.snapshot.runtime.heapUsedMb}/${report.thresholds.heapUsedMb} MB`,
      `[zavorth-ops] runtime: handles ${report.snapshot.runtime.activeHandles}/${report.thresholds.activeHandles} | requests ${report.snapshot.runtime.activeRequests}/${report.thresholds.activeRequests} | cjs modules ${report.snapshot.runtime.loadedCommonJsModules}/${report.thresholds.loadedCommonJsModules}`,
      failedChecks.length > 0 ? `[zavorth-ops] checks violados: ${failedChecks.map((check) => check.id).join(', ')}` : null,
      report.recommendations.length > 0 ? `[zavorth-ops] recomendacoes: ${report.recommendations.join(' ')}` : null,
    ].filter(Boolean).join('\n') + '\n');
  }

  return strict && !report.ok ? 1 : 0;
}

async function runOperationalSecurityDoctor(rawArgs: string[]): Promise<number> {
  const {
    buildOperationalSecurityDoctorReport,
    formatOperationalSecurityDoctorReport,
  } = await import('./security/OperationalSecurityDoctor.js');
  const strict = rawArgs.includes('--strict') || rawArgs.includes('--require-pass');
  const report = buildOperationalSecurityDoctorReport({
    strict,
    workspace: readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot,
    projectRoot,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatOperationalSecurityDoctorReport(report));
  }

  return report.ok ? 0 : 1;
}

async function runContinuousSecurityMonitor(rawArgs: string[]): Promise<number> {
  const {
    buildContinuousSecurityMonitorReport,
    formatContinuousSecurityMonitorReport,
    writeContinuousSecurityBaseline,
  } = await import('./security/ContinuousSecurityMonitor.js');
  const strict = rawArgs.includes('--strict') || rawArgs.includes('--require-pass');
  const updateBaseline = rawArgs.includes('--update-baseline') || rawArgs[0] === 'baseline';
  const baselinePath = readFlexibleStringFlag(rawArgs, 'baseline');
  const workspace = readFlexibleStringFlag(rawArgs, 'workspace') || projectRoot;

  if (updateBaseline) {
    const baseline = writeContinuousSecurityBaseline({
      workspace,
      projectRoot,
      baselinePath,
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({ ok: true, baseline }, null, 2)}\n`);
    } else {
      process.stdout.write('[zavorth-security] baseline de seguranca continua atualizada\n');
      process.stdout.write(`[zavorth-security] updatedAt: ${baseline.updatedAt}\n`);
    }
    return 0;
  }

  const report = buildContinuousSecurityMonitorReport({
    strict,
    requireBaseline: rawArgs.includes('--require-baseline'),
    workspace,
    projectRoot,
    baselinePath,
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatContinuousSecurityMonitorReport(report));
  }

  return report.ok ? 0 : 1;
}

async function runSecurityOperationalPreset(rawArgs: string[]): Promise<number> {
  const {
    applySecurityOperationalPreset,
    formatApplySecurityOperationalPresetResult,
    formatSecurityOperationalPresetInspection,
    formatSecurityOperationalPresetList,
    getSecurityOperationalPreset,
    inspectSecurityOperationalPreset,
    listSecurityOperationalPresets,
  } = await import('./security/SecurityOperationalPreset.js');
  const action = String(rawArgs[0] || '').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  if (!action || action === 'list' || action === 'presets') {
    const presets = listSecurityOperationalPresets();
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ presets }, null, 2)}\n`);
    } else {
      process.stdout.write(formatSecurityOperationalPresetList());
    }
    return 0;
  }

  if (action === 'status') {
    const inspection = inspectSecurityOperationalPreset({ projectRoot });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
    } else {
      process.stdout.write(formatSecurityOperationalPresetInspection(inspection));
    }
    return inspection.status === 'ready' ? 0 : 1;
  }

  const preset = getSecurityOperationalPreset(action);
  if (!preset) {
    process.stderr.write(`Preset de seguranca desconhecido: ${action}.\n`);
    return 1;
  }

  if (!rawArgs.includes('--apply') && !rawArgs.includes('apply')) {
    if (asJson) {
      process.stdout.write(`${JSON.stringify({ preset }, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-security] preset preview',
        `[zavorth-security] ${preset.id}: ${preset.label}`,
        `[zavorth-security] perfil: ${preset.securityProfile} | MCP: ${preset.mcpPolicy.profile} | skills: ${preset.skillPolicy.defaultPolicy}`,
        `[zavorth-security] ${preset.summary}`,
        '',
        `Aplicar: zavorth security preset ${preset.id} --apply`,
      ].join('\n') + '\n');
    }
    return 0;
  }

  const result = applySecurityOperationalPreset({
    preset: preset.id,
    projectRoot,
    appliedBy: 'zavorth-cli',
  });
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatApplySecurityOperationalPresetResult(result));
  }
  return 0;
}

async function runMinimalKernel(rawArgs: string[]): Promise<number> {
  const { MinimalRuntimeKernel } = await import('./core/MinimalRuntimeKernel.js');
  const asJson = rawArgs.includes('--json');
  const once = rawArgs.includes('--once') || rawArgs.includes('--dry-run') || rawArgs.includes('--snapshot');
  const profileArg = rawArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
  const kernel = new MinimalRuntimeKernel({ profile: profileArg || 'minimal' });
  const snapshot = await kernel.start();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write([
      '[zavorth-core] minimal runtime kernel',
      `[zavorth-core] status: ${snapshot.status} | profile: ${snapshot.profile}`,
      `[zavorth-core] budget: ${snapshot.budget.ok ? 'ok' : 'violado'} | rss ${snapshot.budget.snapshot.runtime.rssMb}/${snapshot.budget.thresholds.rssMb} MB | heap ${snapshot.budget.snapshot.runtime.heapUsedMb}/${snapshot.budget.thresholds.heapUsedMb} MB`,
      `[zavorth-core] runtime profile: ${snapshot.runtimeProfile.label} | polling ${snapshot.runtimeProfile.pollingMode} | sidecars ${snapshot.runtimeProfile.maxActiveSidecars}`,
      `[zavorth-core] registry: total ${snapshot.capabilityRegistry.total} | boot ${snapshot.capabilityRegistry.activeOnBoot} | on-demand ${snapshot.capabilityRegistry.onDemand} | sidecars ${snapshot.capabilityRegistry.sidecars}`,
      `[zavorth-core] sidecars: total ${snapshot.sidecarManager.total} | launchable ${snapshot.sidecarManager.launchable} | running ${snapshot.sidecarManager.running}`,
      `[zavorth-core] scheduler: tasks ${snapshot.scheduler.taskCount} | event-first ${snapshot.scheduler.eventFirstTasks} | adaptive ${snapshot.scheduler.adaptiveTasks} | active timers ${snapshot.scheduler.activeTimers}`,
      `[zavorth-core] capabilities: ${snapshot.capabilities.map((capability) => capability.id).join(', ')}`,
    ].join('\n') + '\n');
  }

  if (once) {
    await kernel.stop('once');
    return snapshot.budget.ok ? 0 : 1;
  }

  await kernel.runUntilSignal();
  return 0;
}

async function runAiFirstOwnerControlledDefault(rawArgs: string[]): Promise<number> {
  const { AiFirstOwnerControlledDefaultActivationService } = await import('./services/AiFirstOwnerControlledDefaultActivationService.js');
  const action = String(rawArgs[0] || 'status').trim().toLowerCase();
  if (action === 'prepare') {
    const { AiFirstActivationPreparationService } = await import('./services/AiFirstActivationPreparationService.js');
    const service = new AiFirstActivationPreparationService({
      outputDir: readFlexibleStringFlag(rawArgs, 'output-dir') || undefined,
    });
    const result = service.prepare({
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      outputPath: readFlexibleStringFlag(rawArgs, 'output'),
      write: !rawArgs.includes('--no-write'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(`${service.renderText(result)}\n`);
    }
    return rawArgs.includes('--require-pass') && result.status !== 'ready' ? 1 : 0;
  }
  const service = new AiFirstOwnerControlledDefaultActivationService({
    dataDir: readFlexibleStringFlag(rawArgs, 'data-dir') || undefined,
    statePath: readFlexibleStringFlag(rawArgs, 'state-path') || undefined,
    ledgerPath: readFlexibleStringFlag(rawArgs, 'ledger-path') || undefined,
  });
  let result: import('./contracts/AiFirstOwnerControlledDefaultActivationContract.js').AiFirstOwnerControlledDefaultResult;
  if (action === 'plan' || action === 'activate') {
    const snapshotPath = readFlexibleStringFlag(rawArgs, 'snapshot');
    const snapshot = snapshotPath ? service.readSnapshotFile(snapshotPath) : null;
    const input = {
      snapshot,
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      apply: rawArgs.includes('--apply'),
      confirmOwnerControlledDefault: rawArgs.includes('--confirm-owner-controlled-default'),
    };
    result = action === 'activate' ? service.activate(input) : service.plan(input);
  } else if (action === 'rollback') {
    result = service.rollback({
      ownerApprovalId: readFlexibleStringFlag(rawArgs, 'owner-approval-id'),
      apply: rawArgs.includes('--apply'),
      confirmRollback: rawArgs.includes('--confirm-rollback'),
      reason: readFlexibleStringFlag(rawArgs, 'reason'),
    });
  } else if (action === 'status') {
    result = service.status(readNumberFlag(rawArgs, 'limit') || 20);
  } else {
    process.stderr.write('Use: zavorth ai-first plan|activate|status|rollback\n');
    return 1;
  }

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${service.renderText(result)}\n`);
  }

  return rawArgs.includes('--require-pass') && ['blocked', 'missing'].includes(result.status) ? 1 : 0;
}

async function runPromotedScript(
  scriptBaseName: 'setup-v3' | 'ops-go',
  forwardedArgs: string[] = [],
): Promise<number> {
  const distScript = path.join(projectRoot, 'dist-ops', 'scripts', `${scriptBaseName}.js`);
  if (runningFromDist && existsSync(distScript)) {
    return spawnInherited(process.execPath, [distScript, ...forwardedArgs], projectRoot);
  }

  return npmInherited(['exec', 'tsx', '--', `scripts/${scriptBaseName}.ts`, ...forwardedArgs], projectRoot);
}

function buildQuickSandboxHostReadiness() {
  return {
    inspect: () => {
      const generatedAt = new Date().toISOString();
      return {
        phase: '38' as const,
        generatedAt,
        platform: process.platform,
        osRelease: 'quick-projection',
        summary: {
          ok: true,
          readyTiers: ['local-jail' as const],
          dormantTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          unavailableStrongTiers: ['docker' as const, 'gvisor' as const, 'firecracker' as const],
          blockingIssues: [],
        },
        defaultPolicy: {
          strongSandboxReady: false,
          liveMutationDefault: 'dry-run-only' as const,
          safeWithoutStrongSandbox: ['read-only' as const, 'preview' as const, 'doctor' as const, 'receipt' as const],
          blockedWithoutStrongSandbox: [
            'workspace-write' as const,
            'host-command' as const,
            'network-write' as const,
            'channel-send' as const,
            'live-skill-apply' as const,
          ],
          explanation: 'Quick projection never claims live mutations; use advanced doctor to confirm Docker, gVisor or Firecracker.',
        },
        tiers: [
          {
            id: 'local-jail' as const,
            label: 'Local jail sandbox',
            status: 'ready' as const,
            canRun: true,
            strongBoundary: false,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Quick projection keeps read-only and preview available without probing Docker.'],
            checks: [],
          },
          {
            id: 'docker' as const,
            label: 'Docker hardened sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run zavorth doctor --advanced or zavorth product --view=sandbox --probe to inspect Docker.'],
            checks: [],
          },
          {
            id: 'gvisor' as const,
            label: 'gVisor runsc sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor for runtime-specific details.'],
            checks: [],
          },
          {
            id: 'firecracker' as const,
            label: 'Firecracker MicroVM sandbox',
            status: 'dormant' as const,
            canRun: false,
            strongBoundary: true,
            startsOnRead: false as const,
            platform: process.platform,
            reasons: ['Run the advanced sandbox doctor on a Linux/KVM-capable host.'],
            checks: [],
          },
        ],
        actions: ['Run zavorth doctor --advanced for a live sandbox probe.'],
        contracts: [
          'Quick product projections do not start Docker, VM, sidecar or persistent process.',
          'Mutable actions remain dry-run unless a strong sandbox is confirmed.',
        ],
      };
    },
  };
}

async function runProductizationProtectedRuntime(
  view: 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox',
  rawArgs: string[] = [],
): Promise<number> {
  const { ZavorthProductizationProtectedRuntimeService } = await import('./services/ZavorthProductizationProtectedRuntimeService.js');
  const shouldProbeSandbox = rawArgs.includes('--advanced') || rawArgs.includes('--probe');
  const service = new ZavorthProductizationProtectedRuntimeService(
    shouldProbeSandbox ? {} : { sandboxHostReadiness: buildQuickSandboxHostReadiness() },
  );
  const detailMode = rawArgs.includes('--advanced')
    ? 'advanced'
    : rawArgs.includes('--simple')
      ? 'simple'
      : readFlexibleStringFlag(rawArgs, 'detail');
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode,
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
  });

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'journey' ? snapshot.firstRun
        : view === 'templates' ? snapshot.templates
          : view === 'missions' ? snapshot.mission
            : view === 'receipts' ? snapshot.receipt
              : view === 'sandbox' ? snapshot.sandbox
                : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot, view));
  }

  return 0;
}

async function runGatewaySpine(rawArgs: string[] = []): Promise<number> {
  const { GatewayChannelRegistryService } = await import('./services/GatewayChannelRegistryService.js');
  const { GatewaySpineService } = await import('./services/GatewaySpineService.js');
  const view = String(rawArgs[0] || 'status').trim().toLowerCase();
  const asJson = rawArgs.includes('--json');
  const service = new GatewaySpineService({
    channelRegistry: new GatewayChannelRegistryService({
      hasDispatcher: true,
      canSpawnWeb: true,
    }),
  });
  const snapshot = service.buildSnapshot({
    gatewayRuntimeSnapshot: {
      lifecycle: {
        status: 'attached',
      },
      route: 'gateway-runtime',
      sessions: [],
    },
    approvals: {
      source: 'GatewayApprovalPlane',
      total: 0,
      pending: 0,
    },
    receipts: {
      source: 'GatewayReceiptPlane',
      total: 0,
      pending: 0,
    },
    artifacts: {
      source: 'GatewayArtifactPlane',
      total: 0,
      pending: 0,
    },
  });

  if (asJson) {
    const payload =
      view === 'sessions' ? snapshot.sessions
        : view === 'channels' ? snapshot.channels
          : view === 'approvals' ? snapshot.approvals
            : view === 'receipts' ? snapshot.receipts
              : view === 'artifacts' ? snapshot.artifacts
                : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'sessions') {
    process.stdout.write(`[gateway sessions]\ntotal=${snapshot.sessions.total} active=${snapshot.sessions.active} source=${snapshot.sessions.source}\n`);
    return 0;
  }
  if (view === 'channels') {
    process.stdout.write([
      '[gateway channels]',
      `total=${snapshot.channels.summary.total} ready=${snapshot.channels.summary.ready} partial=${snapshot.channels.summary.partial}`,
      ...snapshot.channels.entries.map((entry) => `- ${entry.id}: ${entry.readiness} | ${entry.transport}`),
      '',
    ].join('\n'));
    return 0;
  }
  if (view === 'approvals') {
    process.stdout.write(`[gateway approvals]\npending=${snapshot.approvals.pending} total=${snapshot.approvals.total} source=${snapshot.approvals.source}\n`);
    return 0;
  }
  if (view === 'receipts') {
    process.stdout.write(`[gateway receipts]\ntotal=${snapshot.receipts.total} source=${snapshot.receipts.source}\n`);
    return 0;
  }
  if (view === 'artifacts') {
    process.stdout.write(`[gateway artifacts]\ntotal=${snapshot.artifacts.total} source=${snapshot.artifacts.source}\n`);
    return 0;
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

async function runUnifiedOnboarding(rawArgs: string[] = []): Promise<number> {
  const { ProviderDoctorService } = await import('./services/ProviderDoctorService.js');
  const { ZavorthUnifiedOnboardingService } = await import('./services/ZavorthUnifiedOnboardingService.js');
  const service = new ZavorthUnifiedOnboardingService({
    providerDoctor: new ProviderDoctorService(),
  });
  const snapshot = service.buildSnapshot({
    dailyMode: readFlexibleStringFlag(rawArgs, 'mode'),
    detailMode: rawArgs.includes('--advanced') ? 'advanced' : rawArgs.includes('--simple') ? 'simple' : readFlexibleStringFlag(rawArgs, 'detail'),
    selectedTemplateId: readFlexibleStringFlag(rawArgs, 'template'),
    request: readFlexibleStringFlag(rawArgs, 'request'),
    includeAdvanced: rawArgs.includes('--advanced'),
  });
  const view = String(rawArgs.find((arg) => !arg.startsWith('--')) || 'journey').trim().toLowerCase();

  if (rawArgs.includes('--json')) {
    const payload =
      view === 'templates' ? snapshot.templates
        : view === 'doctor' ? {
            status: snapshot.status,
            provider: snapshot.provider,
            sandbox: snapshot.sandbox,
            nextAction: snapshot.nextAction,
          }
          : view === 'first-mission' ? snapshot.safeDemo
            : snapshot;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (view === 'templates') {
    process.stdout.write([
      '[zavorth-onboarding templates]',
      ...snapshot.templates.map((template) =>
        `- ${template.id}: ${template.label} | risk=${template.defaultRisk} | mutate=${template.requiresMutation ? 'yes' : 'no'}`,
      ),
      '',
    ].join('\n'));
    return 0;
  }
  if (view === 'doctor') {
    process.stdout.write([
      '[zavorth-onboarding doctor]',
      `status=${snapshot.status}`,
      `provider=${snapshot.provider.status} ready=${snapshot.provider.ready} missing_auth=${snapshot.provider.missingAuth} needs_probe=${snapshot.provider.needsProbe}`,
      `sandbox=${snapshot.sandbox.status} mutation=${snapshot.sandbox.mutationMode}`,
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n'));
    return 0;
  }
  if (view === 'first-mission') {
    process.stdout.write([
      '[zavorth-onboarding first mission]',
      snapshot.safeDemo.command,
      snapshot.safeDemo.summary,
      '',
    ].join('\n'));
    return 0;
  }

  process.stdout.write(service.renderText(snapshot));
  return 0;
}

async function runSensitiveActionFlow(rawArgs: string[] = []): Promise<number> {
  const { ZavorthSensitiveActionFlowService } = await import('./services/ZavorthSensitiveActionFlowService.js');
  const service = new ZavorthSensitiveActionFlowService();
  const request = readFlexibleStringFlag(rawArgs, 'request')
    || rawArgs.filter((arg) => !arg.startsWith('--')).join(' ')
    || 'Review this workspace in read-only mode.';
  const snapshot = service.buildSnapshot({
    request,
    decision: readFlexibleStringFlag(rawArgs, 'decision') as any,
    approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
    sandboxReady: rawArgs.includes('--sandbox-ready'),
    source: 'cli',
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

async function runProviderReadiness(rawArgs: string[] = []): Promise<number> {
  const action = String(rawArgs[0] || 'matrix').trim().toLowerCase();
  if (action === 'cockpit' || action === 'command-center') {
    const { ZavorthCommandCenterProviderCockpitService } = await import('./services/ZavorthCommandCenterProviderCockpitService.js');
    const service = new ZavorthCommandCenterProviderCockpitService();
    const projection = await service.buildProjection({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      live: rawArgs.includes('--live'),
      allowAllLive: rawArgs.includes('--all'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(projection));
    }
    return 0;
  }
  if (action === 'select' || action === 'use' || action === 'choose' || action === 'switch') {
    const { ZavorthProviderSelectionUxService } = await import('./services/ZavorthProviderSelectionUxService.js');
    const service = new ZavorthProviderSelectionUxService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.buildSnapshot({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return 0;
  }
  if (action === 'apply' || action === 'persist' || action === 'save') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const target = readFlexibleStringFlag(rawArgs, 'provider')
      || readFlexibleStringFlag(rawArgs, 'target')
      || rawArgs[1];
    const snapshot = await service.apply({
      includeAdvanced: rawArgs.includes('--advanced'),
      target,
      providerId: target,
      modelId: readFlexibleStringFlag(rawArgs, 'model'),
      intent: readFlexibleStringFlag(rawArgs, 'intent') || readFlexibleStringFlag(rawArgs, 'profile') || rawArgs[2],
      requireLiveEvidence: rawArgs.includes('--require-live') || rawArgs.includes('--live-proof'),
      live: rawArgs.includes('--live'),
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'preference' || action === 'current') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const preference = await service.readPreference();
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify({
        surface: 'provider-preference',
        preference,
        safety: {
          rawSecretsSerialized: false,
          mutatesConfig: false,
        },
      }, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[provider-preference]',
        `provider=${preference?.providerId || 'none'}`,
        `model=${preference?.modelId || 'none'}`,
        `receipt=${preference?.receiptId || 'none'}`,
        '',
      ].join('\n'));
    }
    return 0;
  }
  if (action === 'rollback') {
    const { ZavorthProviderPreferencePersistenceService } = await import('./services/ZavorthProviderPreferencePersistenceService.js');
    const service = new ZavorthProviderPreferencePersistenceService();
    const snapshot = await service.rollback({
      receiptId: readFlexibleStringFlag(rawArgs, 'receipt') || rawArgs[1],
      approvalId: readFlexibleStringFlag(rawArgs, 'approval-id'),
      confirm: rawArgs.includes('--confirm') || rawArgs.includes('--yes'),
      dryRun: rawArgs.includes('--dry-run') || rawArgs.includes('--preview'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(snapshot));
    }
    return snapshot.status === 'denied' ? 2 : 0;
  }
  if (action === 'visual-approval' || action === 'visual-pack' || action === 'approval-pack') {
    const { ZavorthCommandCenterVisualApprovalPackService } = await import('./services/ZavorthCommandCenterVisualApprovalPackService.js');
    const service = new ZavorthCommandCenterVisualApprovalPackService();
    const pack = await service.buildPack({
      includeAdvanced: rawArgs.includes('--advanced'),
      providerId: readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      selectedProviderId: readFlexibleStringFlag(rawArgs, 'selected-provider') || readFlexibleStringFlag(rawArgs, 'provider') || rawArgs[1],
      includeDetailsDrawer: rawArgs.includes('--details-drawer'),
    });
    if (rawArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
    } else {
      process.stdout.write(service.renderText(pack));
    }
    return 0;
  }
  const { ZavorthProviderReadinessMatrixService } = await import('./services/ZavorthProviderReadinessMatrixService.js');
  const providerId = readFlexibleStringFlag(rawArgs, 'provider')
    || (action === 'test' ? rawArgs[1] : rawArgs.find((arg) => !arg.startsWith('--') && arg !== 'matrix' && arg !== 'live'));
  const service = new ZavorthProviderReadinessMatrixService();
  const snapshot = await service.buildLiveSnapshot({
    includeAdvanced: rawArgs.includes('--advanced'),
    providerId: providerId && providerId !== 'test' ? providerId : null,
    probe: action === 'test' || rawArgs.includes('--probe'),
    live: rawArgs.includes('--live') || action === 'live',
    allowAllLive: rawArgs.includes('--all'),
  });

  if (rawArgs.includes('--json')) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } else {
    process.stdout.write(service.renderText(snapshot));
  }

  return 0;
}

function resolveProductizationView(rawArgs: string[]): 'all' | 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox' {
  const view = String(readFlexibleStringFlag(rawArgs, 'view') || rawArgs[0] || '').trim().toLowerCase();
  if (['journey', 'templates', 'missions', 'receipts', 'sandbox'].includes(view)) {
    return view as 'journey' | 'templates' | 'missions' | 'receipts' | 'sandbox';
  }
  return 'all';
}

async function runBuiltinLauncher(rawArgs: string[]): Promise<number | null> {
  const command = String(rawArgs[0] || '').trim().toLowerCase();
  const restArgs = rawArgs.slice(1);
  if (!command) {
    return null;
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    if (restArgs.includes('--json')) {
      return null;
    }
    return printBuiltinHelp(restArgs[0]);
  }

  const helpTopic = resolveCliHelpTopic(command);
  if (helpTopic !== 'root' && (restArgs.includes('--help') || restArgs.includes('-h'))) {
    return printBuiltinHelp(command);
  }

  if (command === 'onboard') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    if (['apply', 'run', 'legacy', 'setup'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      return runPromotedScript('setup-v3', restArgs.slice(1));
    }
    return runUnifiedOnboarding(restArgs);
  }

  if (command === 'setup' || command === 'init') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('onboard');
    }
    return runPromotedScript('setup-v3', restArgs);
  }

  if (command === 'go') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('go');
    }
    return runPromotedScript('ops-go', restArgs);
  }

  if (command === 'templates') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('templates');
    }
    return runProductizationProtectedRuntime('templates', restArgs);
  }

  if (command === 'missions') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('missions');
    }
    return runProductizationProtectedRuntime('missions', restArgs);
  }

  if (command === 'receipts') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      return printBuiltinHelp('receipts');
    }
    return runProductizationProtectedRuntime('receipts', restArgs);
  }

  if (command === 'product' || command === 'daily-use') {
    return runProductizationProtectedRuntime(resolveProductizationView(restArgs), restArgs);
  }

  if (command === 'gateway') {
    if (restArgs.includes('--help') || restArgs.includes('-h')) {
      process.stdout.write([
        'Zavorth Gateway',
        '',
        'Usage:',
        '  zavorth gateway status',
        '  zavorth gateway sessions',
        '  zavorth gateway channels',
        '  zavorth gateway approvals',
        '  zavorth gateway receipts',
        '  zavorth gateway artifacts',
        '',
        'Options:',
        '  --json    Print the same Gateway Spine projection as JSON.',
        '',
      ].join('\n'));
      return 0;
    }
    return runGatewaySpine(restArgs);
  }

  if (command === 'preview' || command === 'sensitive-flow' || command === 'sensitive-action') {
    return runSensitiveActionFlow(restArgs);
  }

  if (command === 'providers' || command === 'models') {
    return runProviderReadiness(restArgs);
  }

  if (
    command === 'doctor'
    && (restArgs.includes('--simple') || restArgs.includes('--advanced'))
  ) {
    return runProductizationProtectedRuntime('all', restArgs);
  }

  if (command === 'doctor' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), restArgs.includes('--budget') || restArgs.includes('--strict'));
  }

  if (
    command === 'doctor'
    && ['security', 'seguranca', 'segurança'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['continuous', 'monitor', 'baseline'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runContinuousSecurityMonitor(restArgs);
  }

  if (
    command === 'security'
    && ['preset', 'presets'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runSecurityOperationalPreset(restArgs.slice(1));
  }

  if (
    command === 'security'
    && ['doctor', 'status', 'check'].includes(String(restArgs[0] || 'doctor').trim().toLowerCase())
  ) {
    return runOperationalSecurityDoctor(restArgs.slice(1));
  }

  if (command === 'budget' && String(restArgs[0] || '').trim().toLowerCase() === 'runtime') {
    return runRuntimeResourceDoctor(restArgs.slice(1), true);
  }

  if (
    (command === 'core' || command === 'start')
    && ['minimal', 'kernel'].includes(String(restArgs[0] || '').trim().toLowerCase())
  ) {
    return runMinimalKernel(restArgs.slice(1));
  }

  if (command === 'ai-first' || command === 'aifirst') {
    return runAiFirstOwnerControlledDefault(restArgs);
  }

  if (command === 'doctor' && ['capabilities', 'capability-registry'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const profileSnapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const snapshot = new MinimalCapabilityRegistry({
      manifestDir,
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability registry doctor',
        `[zavorth-core] profile: ${profileSnapshot.selectedProfile.id} | budget: ${profileSnapshot.selectedProfile.budgetProfile}`,
        `[zavorth-core] total: ${snapshot.total} | boot: ${snapshot.activeOnBoot} | on-demand: ${snapshot.onDemand} | sidecars: ${snapshot.sidecars} | disabled: ${snapshot.disabled} | invalid: ${snapshot.invalid}`,
        `[zavorth-core] capabilities: ${snapshot.capabilities.map((capability) => `${capability.id}:${capability.boot}`).join(', ')}`,
      ].join('\n') + '\n');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['profiles', 'runtime-profiles'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const snapshot = new MinimalRuntimeProfileRegistry({ profileDir }).load(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      const selected = snapshot.selectedProfile;
      process.stdout.write([
        '[zavorth-core] runtime profile doctor',
        `[zavorth-core] selected: ${selected.id} | budget: ${selected.budgetProfile} | posture: ${selected.resourcePosture}`,
        `[zavorth-core] polling: ${selected.pollingMode} | maintenance: ${selected.maintenanceMode} | sidecars: ${selected.maxActiveSidecars}`,
        `[zavorth-core] overrides: ${Object.entries(selected.capabilityBootOverrides).map(([id, boot]) => `${id}:${boot}`).join(', ')}`,
      ].join('\n') + '\n');
    }
    return snapshot.invalid > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['contracts', 'runtime-contracts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeContractService } = await import('./core/MinimalRuntimeContractService.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const report = new MinimalRuntimeContractService({
      projectRoot,
      manifestDir,
      profileDir,
    }).buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] runtime contract doctor',
        `[zavorth-core] status: ${report.status} | selected profile: ${report.selectedProfileId}`,
        `[zavorth-core] capabilities: declared ${report.capabilitySummary.declared} | manifest ${report.capabilitySummary.manifest} | boot ${report.capabilitySummary.activeOnBoot} | sidecars ${report.capabilitySummary.sidecars}`,
        `[zavorth-core] profiles: total ${report.profileSummary.total} | invalid ${report.profileSummary.invalid}`,
        ...report.issues.slice(0, 12).map((issue) => `! ${issue.severity} ${issue.id} ${issue.subject}: ${issue.message}`),
      ].join('\n') + '\n');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.status === 'warning') ? 1 : 0;
  }

  if (command === 'doctor' && ['activation', 'capability-activation'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationPlanner } = await import('./core/MinimalCapabilityActivationPlanner.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const manifestDir = restArgs.find((arg) => arg.startsWith('--manifest-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'capability-manifests');
    const profileDir = restArgs.find((arg) => arg.startsWith('--profile-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'config', 'runtime-profiles');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir,
      profileDir,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    if (capabilityId) {
      const result = await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: restArgs.includes('--apply') ? 'activate' : 'plan',
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write([
          '[zavorth-core] capability activation doctor',
          `[zavorth-core] profile: ${result.plan.profileId} | capability: ${result.plan.capabilityId} | status: ${result.plan.status} | mode: ${result.plan.mode}`,
          `[zavorth-core] action: ${result.plan.action}`,
          `[zavorth-core] result: ${result.message}`,
        ].join('\n') + '\n');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = planner.buildReport(profileArg);
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation doctor',
        `[zavorth-core] status: ${report.status} | profile: ${report.profileId} | contract: ${report.contractStatus}`,
        `[zavorth-core] plans: total ${report.total} | active ${report.active} | ready ${report.ready} | manual ${report.manual} | disabled ${report.disabled} | invalidEnabled ${report.invalidEnabled}`,
      ].join('\n') + '\n');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.invalidEnabled > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-ledger', 'activation-receipts', 'receipts'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationLedger } = await import('./core/MinimalCapabilityActivationLedger.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const snapshot = new MinimalCapabilityActivationLedger({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    }).buildSnapshot({ profile: profileArg || null, capability: capabilityId || null, limit });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation ledger doctor',
        `[zavorth-core] status: ${snapshot.status} | exists: ${snapshot.exists} | total ${snapshot.total} | returned ${snapshot.returned} | invalidLines ${snapshot.invalidLines}`,
        `[zavorth-core] counts: plan ${snapshot.counts.plan} | activate ${snapshot.counts.activate} | dry-run ${snapshot.counts.dryRun} | applied ${snapshot.counts.applied}`,
        ...snapshot.receipts.slice(0, 10).map((receipt) =>
          `- ${receipt.createdAt} ${receipt.operation}/${receipt.profileId}/${receipt.capabilityId}: ${receipt.status}/${receipt.mode}`,
        ),
      ].join('\n') + '\n');
    }
    return restArgs.includes('--strict') && snapshot.invalidLines > 0 ? 1 : 0;
  }

  if (command === 'doctor' && ['activation-replay', 'activation-rollback', 'replay'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityActivationReplayService } = await import('./core/MinimalCapabilityActivationReplayService.js');
    const action = String(restArgs[0] || '').trim().toLowerCase() === 'activation-rollback' || restArgs.includes('--rollback')
      ? 'rollback'
      : 'replay';
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=');
    const capabilityId = restArgs.find((arg) => arg.startsWith('--capability='))?.split('=').slice(1).join('=');
    const receiptId = restArgs.find((arg) => arg.startsWith('--receipt-id='))?.split('=').slice(1).join('=');
    const ledgerFile = restArgs.find((arg) => arg.startsWith('--ledger-file='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl');
    const limit = readNumberFlag(restArgs, 'limit') || 20;
    const service = new MinimalCapabilityActivationReplayService({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      ledgerFile,
    });
    if (restArgs.includes('--execute') || restArgs.includes('--apply')) {
      const result = await service.execute(action, {
        profile: profileArg || null,
        capability: capabilityId || null,
        receiptId: receiptId || null,
        limit,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write([
          '[zavorth-core] capability activation replay doctor',
          `[zavorth-core] action: ${result.action} | apply: ${result.apply} | status: ${result.plan.status} | executable: ${result.plan.executable}`,
          `[zavorth-core] command: ${result.plan.command}`,
          `[zavorth-core] result: ${result.message}`,
        ].join('\n') + '\n');
      }
      return restArgs.includes('--strict') && ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const report = service.buildReport(action, {
      profile: profileArg || null,
      capability: capabilityId || null,
      receiptId: receiptId || null,
      limit,
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation replay doctor',
        `[zavorth-core] action: ${report.action} | status: ${report.status} | total ${report.total} | ready ${report.ready} | noop ${report.noop} | manual ${report.manual}`,
        ...report.plans.slice(0, 10).map((plan) => `- ${plan.profileId}/${plan.capabilityId}: ${plan.status} | ${plan.message}`),
      ].join('\n') + '\n');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.blocked > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['retention', 'runtime-retention'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeRetentionService } = await import('./core/MinimalRuntimeRetentionService.js');
    const dataDir = restArgs.find((arg) => arg.startsWith('--data-dir='))?.split('=').slice(1).join('=')
      || path.join(projectRoot, 'data', 'runtime');
    const report = new MinimalRuntimeRetentionService({
      projectRoot,
      dataDir,
      policy: {
        ...(readNumberFlag(restArgs, 'max-activation-receipts') !== null
          ? { maxActivationReceipts: readNumberFlag(restArgs, 'max-activation-receipts') as number }
          : {}),
        ...(readNumberFlag(restArgs, 'max-jsonl-kb') !== null
          ? { maxGenericJsonlBytes: (readNumberFlag(restArgs, 'max-jsonl-kb') as number) * 1024 }
          : {}),
      },
    }).buildReport({ apply: restArgs.includes('--apply') });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] runtime retention doctor',
        `[zavorth-core] status: ${report.status} | applied: ${report.applied} | files ${report.totals.files} | bytes ${report.totals.bytes}`,
        `[zavorth-core] actions: planned ${report.totals.planned} | manual ${report.totals.manual} | applied ${report.totals.applied} | skipped ${report.totals.skipped} | errors ${report.totals.errors}`,
        ...report.actions.filter((action) => action.status !== 'kept').slice(0, 12)
          .map((action) => `- ${action.status} ${path.basename(action.filePath)}: ${action.message}`),
      ].join('\n') + '\n');
    }
    return report.status === 'failed' || (restArgs.includes('--strict') && report.totals.errors > 0) ? 1 : 0;
  }

  if (command === 'doctor' && ['mode', 'runtime-mode', 'mode-governor'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('./core/MinimalRuntimeModeGovernor.js');
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (restArgs.includes('--ledger')) {
      const snapshot = governor.buildLedgerSnapshot({
        limit: readNumberFlag(restArgs, 'limit') || 20,
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
      } else {
        process.stdout.write([
          '[zavorth-core] runtime mode ledger',
          `[zavorth-core] status: ${snapshot.status} | total ${snapshot.total} | active ${snapshot.active} | released ${snapshot.released} | dry-run ${snapshot.dryRun}`,
          ...snapshot.leases.slice(0, 10).map((lease) => `- ${lease.id}: ${lease.status} ${lease.fromProfile}->${lease.toProfile} ${lease.capabilityId} expires=${lease.expiresAt}`),
        ].join('\n') + '\n');
      }
      return snapshot.status === 'failed' ? 1 : 0;
    }
    const plan = governor.plan({
      fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
      toProfile: readStringFlag(restArgs, 'to'),
      capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
      reason: readStringFlag(restArgs, 'reason'),
      ttlMs: readDurationMsFlag(restArgs, 'ttl'),
    });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] runtime mode governor',
        `[zavorth-core] status: ${plan.status} | action: ${plan.action} | ${plan.fromProfile}->${plan.toProfile} | capability: ${plan.capabilityId}`,
        `[zavorth-core] ttl: ${plan.ttlMs}ms | expires: ${plan.expiresAt} | budget: ${plan.budgetOk ? 'ok' : 'blocked'}`,
        `[zavorth-core] result: ${plan.message}`,
      ].join('\n') + '\n');
    }
    return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
  }

  if (command === 'capability' && ['plan', 'activate', 'replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    if (['replay', 'rollback'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
      const { MinimalCapabilityActivationReplayService } = await import('./core/MinimalCapabilityActivationReplayService.js');
      const action = String(restArgs[0] || '').trim().toLowerCase() === 'rollback' ? 'rollback' : 'replay';
      const capabilityId = String(restArgs[1] || '').trim();
      const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
        || process.env.ZAVORTH_RUNTIME_PROFILE
        || process.env.ZAVORTH_PROFILE
        || null;
      const result = await new MinimalCapabilityActivationReplayService({
        projectRoot,
        dataDir: path.join(projectRoot, 'data', 'runtime'),
        ledgerFile: path.join(projectRoot, 'data', 'runtime', 'capability-activation-ledger.jsonl'),
      }).execute(action, {
        profile: profileArg,
        capability: capabilityId || null,
        apply: restArgs.includes('--apply'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        process.stdout.write([
          '[zavorth-core] capability replay',
          `[zavorth-core] action: ${result.action} | profile: ${result.plan.profileId} | capability: ${result.plan.capabilityId} | status: ${result.plan.status}`,
          `[zavorth-core] command: ${result.plan.command}`,
          `[zavorth-core] result: ${result.message}`,
        ].join('\n') + '\n');
      }
      return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
    }
    const { MinimalCapabilityActivationPlanner } = await import('./core/MinimalCapabilityActivationPlanner.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const capabilityId = String(restArgs[1] || '').trim();
    if (!capabilityId) {
      process.stderr.write('Informe o id da capability.\n');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const planner = new MinimalCapabilityActivationPlanner({
      projectRoot,
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
      dataDir: path.join(projectRoot, 'data', 'runtime'),
    });
    const result = action === 'activate'
      ? await planner.activate(capabilityId, {
        profile: profileArg,
        apply: restArgs.includes('--apply'),
        operation: 'activate',
      })
      : await planner.activate(capabilityId, {
        profile: profileArg,
        apply: false,
        operation: 'plan',
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] capability activation',
        `[zavorth-core] profile: ${result.plan.profileId} | capability: ${result.plan.capabilityId} | status: ${result.plan.status} | mode: ${result.plan.mode}`,
        `[zavorth-core] action: ${result.plan.action}`,
        `[zavorth-core] result: ${result.message}`,
      ].join('\n') + '\n');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'mode' && ['plan', 'elevate', 'release'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalRuntimeModeGovernor } = await import('./core/MinimalRuntimeModeGovernor.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const governor = new MinimalRuntimeModeGovernor({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    });
    if (action === 'plan') {
      const plan = governor.plan({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
      });
      if (restArgs.includes('--json')) {
        process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      } else {
        process.stdout.write([
          '[zavorth-core] runtime mode plan',
          `[zavorth-core] status: ${plan.status} | action: ${plan.action} | ${plan.fromProfile}->${plan.toProfile} | capability: ${plan.capabilityId}`,
          `[zavorth-core] result: ${plan.message}`,
        ].join('\n') + '\n');
      }
      return ['blocked', 'missing'].includes(plan.status) ? 1 : 0;
    }
    const result = action === 'release'
      ? governor.release(String(restArgs[1] || readStringFlag(restArgs, 'lease') || '').trim(), {
        apply: restArgs.includes('--apply'),
        reason: readStringFlag(restArgs, 'reason'),
      })
      : governor.elevate({
        fromProfile: readStringFlag(restArgs, 'from') || readStringFlag(restArgs, 'profile') || process.env.ZAVORTH_RUNTIME_PROFILE || process.env.ZAVORTH_PROFILE || 'safe-8gb',
        toProfile: readStringFlag(restArgs, 'to'),
        capability: readStringFlag(restArgs, 'capability') || String(restArgs[1] || 'browser'),
        reason: readStringFlag(restArgs, 'reason'),
        ttlMs: readDurationMsFlag(restArgs, 'ttl'),
        apply: restArgs.includes('--apply'),
      });
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] runtime mode',
        `[zavorth-core] applied: ${result.applied} | dryRun: ${result.dryRun} | status: ${result.plan.status} | action: ${result.plan.action}`,
        `[zavorth-core] lease: ${result.lease?.id || 'none'} | ${result.plan.fromProfile}->${result.plan.toProfile} | return ${result.plan.returnProfile}`,
        `[zavorth-core] result: ${result.message}`,
      ].join('\n') + '\n');
    }
    return ['blocked', 'missing'].includes(result.plan.status) ? 1 : 0;
  }

  if (command === 'doctor' && ['sidecars', 'sidecar-manager'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('./core/MinimalSidecarManager.js');
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'minimal';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const snapshot = await new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    }).inspectLive();
    if (restArgs.includes('--json')) {
      process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      process.stdout.write([
        '[zavorth-core] sidecar manager doctor',
        `[zavorth-core] profile: ${snapshot.profileId} | total ${snapshot.total} | launchable ${snapshot.launchable} | running ${snapshot.running} | ready ${snapshot.ready}`,
        ...snapshot.sidecars.map((sidecar) => `- ${sidecar.id}: ${sidecar.state} | launchable=${sidecar.launchable} | ${sidecar.message}`),
      ].join('\n') + '\n');
    }
    return 0;
  }

  if (command === 'sidecar' && ['start', 'stop'].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalCapabilityRegistry } = await import('./core/MinimalCapabilityRegistry.js');
    const { MinimalRuntimeProfileRegistry } = await import('./core/MinimalRuntimeProfileRegistry.js');
    const { MinimalSidecarManager } = await import('./core/MinimalSidecarManager.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const sidecarId = String(restArgs[1] || '').trim();
    if (!sidecarId) {
      process.stderr.write('Informe o id do sidecar.\n');
      return 1;
    }
    const profileArg = restArgs.find((arg) => arg.startsWith('--profile='))?.split('=').slice(1).join('=')
      || process.env.ZAVORTH_RUNTIME_PROFILE
      || process.env.ZAVORTH_PROFILE
      || 'desktop';
    const profileSnapshot = new MinimalRuntimeProfileRegistry({
      profileDir: path.join(projectRoot, 'config', 'runtime-profiles'),
    }).load(profileArg);
    const capabilityRegistry = new MinimalCapabilityRegistry({
      manifestDir: path.join(projectRoot, 'config', 'capability-manifests'),
      profileId: profileSnapshot.selectedProfile.id,
      bootOverrides: profileSnapshot.selectedProfile.capabilityBootOverrides,
    }).load();
    const manager = new MinimalSidecarManager({
      projectRoot,
      dataDir: path.join(projectRoot, 'data', 'runtime'),
      runtimeProfile: profileSnapshot.selectedProfile,
      capabilityRegistry,
    });
    const result = action === 'start'
      ? await manager.start(sidecarId, { dryRun: !restArgs.includes('--apply') })
      : await manager.stop(sidecarId, { dryRun: !restArgs.includes('--apply') });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'browser' && [
    'health',
    'navigate',
    'screenshot',
    'extract-text',
    'click',
    'type',
    'close',
    'shutdown',
  ].includes(String(restArgs[0] || '').trim().toLowerCase())) {
    const { MinimalBrowserSidecarClient } = await import('./core/MinimalBrowserSidecarClient.js');
    const action = String(restArgs[0] || '').trim().toLowerCase();
    const baseUrl = restArgs.find((arg) => arg.startsWith('--base-url='))?.split('=').slice(1).join('=');
    const timeoutMs = Number(restArgs.find((arg) => arg.startsWith('--timeout-ms='))?.split('=').slice(1).join('=') || 30_000);
    const client = new MinimalBrowserSidecarClient({ baseUrl, timeoutMs });
    let result: unknown;
    if (action === 'health') {
      result = await client.health();
    } else if (action === 'navigate') {
      const url = restArgs[1] || restArgs.find((arg) => arg.startsWith('--url='))?.split('=').slice(1).join('=');
      if (!url) {
        process.stderr.write('Informe a URL para navegar.\n');
        return 1;
      }
      result = await client.navigate(url, {
        waitUntil: restArgs.find((arg) => arg.startsWith('--wait-until='))?.split('=').slice(1).join('='),
        timeoutMs,
      });
    } else if (action === 'screenshot') {
      result = await client.screenshot({
        fullPage: !restArgs.includes('--viewport-only'),
        base64: restArgs.includes('--base64'),
      });
    } else if (action === 'extract-text') {
      result = await client.extractText({
        maxChars: Number(restArgs.find((arg) => arg.startsWith('--max-chars='))?.split('=').slice(1).join('=') || 20_000),
        timeoutMs,
      });
    } else if (action === 'click') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      if (!selector) {
        process.stderr.write('Informe o selector para clicar.\n');
        return 1;
      }
      result = await client.click(selector, { timeoutMs });
    } else if (action === 'type') {
      const selector = restArgs[1] || restArgs.find((arg) => arg.startsWith('--selector='))?.split('=').slice(1).join('=');
      const text = restArgs[2] || restArgs.find((arg) => arg.startsWith('--text='))?.split('=').slice(1).join('=') || '';
      if (!selector) {
        process.stderr.write('Informe o selector para digitar.\n');
        return 1;
      }
      result = await client.type(selector, text, { timeoutMs });
    } else if (action === 'close') {
      result = await client.close();
    } else {
      result = await client.shutdown();
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  if (command === 'echo' || command === 'voice' || command === 'voz') {
    return npmInherited(['start'], path.join(projectRoot, 'agent'));
  }

  if (command === 'serve' || command === 'server' || command === 'api') {
    if (runningFromDist) {
      return spawnInherited(process.execPath, [path.join(entryDir, 'echo-server.js')], projectRoot);
    }
    return npmInherited(['exec', 'tsx', '--', 'src/echo-server.ts'], projectRoot);
  }

  if (command === 'ui') {
    return spawnInherited(process.execPath, [path.join(projectRoot, 'scripts', 'start-echo-stack.mjs')], projectRoot);
  }

  return null;
}

void runBuiltinLauncher(args)
  .then(async (handledExitCode) => {
    if (handledExitCode !== null) {
      return handledExitCode;
    }
    const { runZavorthCli } = await import('./cli/ZavorthCli.js');
    return runZavorthCli(args);
  })
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error([
      'Zavorth could not finish this command.',
      `Cause: ${message}`,
      'Next: run zavorth doctor',
      process.env.ZAVORTH_DEBUG === '1' && error instanceof Error && error.stack
        ? `Debug:\n${error.stack}`
        : null,
    ].filter(Boolean).join('\n'));
    process.exit(1);
  });
